import { Storage, UploadOptions } from '@google-cloud/storage';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import * as functions from 'firebase-functions/v1';
import { storage } from 'firebase-functions/v1';
import fs from 'fs';
import os from 'os';
import path from 'path';

const gcs = new Storage();
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const optimizeImages = storage.object().onFinalize((object) => {
  const { contentType } = object;
  if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    functions.logger.log('File is not a supported image format:', contentType);
    return null;
  }

  if (object.size && Number(object.size) > MAX_FILE_SIZE_BYTES) {
    functions.logger.warn(`Image size exceeds ${MAX_FILE_SIZE_BYTES} bytes:`, object.name);
    return null;
  }

  return optimizeImage(object);
});

async function optimizeImage(object: functions.storage.ObjectMetadata) {
  const filePath = object.name;
  if (!filePath) {
    return null;
  }

  // Prevent path traversal by isolating the temp file within os.tmpdir() using a UUID
  const fileId = crypto.randomUUID();
  const safeBaseName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
  const tempLocalFile = path.join(os.tmpdir(), `${fileId}_${safeBaseName}`);

  const bucket = gcs.bucket(object.bucket);
  const file = bucket.file(filePath);

  const [metadata] = await file.getMetadata();
  if (metadata.metadata && metadata.metadata.optimized) {
    functions.logger.log('Image has been already optimized');
    return null;
  }

  try {
    await file.download({ destination: tempLocalFile });
    functions.logger.log('The file has been downloaded to', tempLocalFile);

    // Generate optimized image using ImageMagick with bounded resources
    spawnSync('convert', [
      '-limit',
      'memory',
      '128MB',
      '-limit',
      'disk',
      '512MB',
      tempLocalFile,
      '-strip',
      '-interlace',
      'Plane',
      '-quality',
      '82',
      tempLocalFile,
    ]);
    functions.logger.log('Optimized image created at', tempLocalFile);

    const destination = bucket.file(filePath);
    const options: UploadOptions = {
      destination,
      metadata: {
        metadata: {
          optimized: 'true',
        },
      },
    };
    const [newFile] = await bucket.upload(tempLocalFile, options);

    // Only expose publicly if in designated public or gallery paths
    if (filePath.startsWith('gallery/') || filePath.startsWith('public/')) {
      await newFile.makePublic();
    }
    functions.logger.log('Optimized image uploaded to Storage');
    return null;
  } finally {
    if (fs.existsSync(tempLocalFile)) {
      await fs.promises
        .unlink(tempLocalFile)
        .catch((err) => functions.logger.warn('Failed to delete temp file:', err));
    }
  }
}
