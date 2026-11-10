import process from 'node:process';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';
import fs from 'fs';
import { RollupOptions } from 'rollup';
import copy from 'rollup-plugin-copy';
import livereload from 'rollup-plugin-livereload';
import { generateSW } from 'rollup-plugin-workbox';
import { compileBufferTemplate, production, watch } from './utils/build';
import { workboxConfig } from './workbox.config';

const previewMode = process.env['SPEAKERS_PREVIEW'];
const speakersTomek = previewMode === 'tomek';
const speakersComparison = previewMode === 'comparison';
const speakersReview = previewMode === 'review' || speakersComparison || speakersTomek;
const speakersPreview = speakersReview || previewMode === '1';
const agendaPreview = process.env['AGENDA_PREVIEW'] === '1';
if (agendaPreview && speakersPreview)
  throw new Error('Agenda and legacy speaker previews cannot be combined');
const outputDir = agendaPreview
  ? 'dist-agenda-preview'
  : speakersTomek
    ? 'dist-review-tomek'
    : speakersComparison
      ? 'dist-review-v2'
      : speakersReview
        ? 'dist-review'
        : speakersPreview
          ? 'dist-preview'
          : 'dist';
const previewFlag = {
  name: 'speakers-preview-flag',
  transform(code: string, id: string) {
    if (!id.endsWith('/utils/speakers-preview.ts')) return null;
    return {
      code: code.replace(
        "'__SPEAKERS_PREVIEW_BUILD__'",
        JSON.stringify(speakersPreview ? previewMode : '0'),
      ),
      map: null,
    };
  },
};
const agendaFlag = {
  name: 'agenda-preview-flag',
  transform(code: string, id: string) {
    if (!id.endsWith('/utils/agenda-preview-mode.ts')) return null;
    return {
      code: code.replace("'__AGENDA_PREVIEW_BUILD__'", JSON.stringify(agendaPreview ? '1' : '0')),
      map: null,
    };
  },
};
const config: RollupOptions[] = [
  {
    input: 'src/firebase-messaging-sw.ts',
    treeshake: production,
    output: {
      dir: outputDir,
      sourcemap: production,
    },
    plugins: [
      previewFlag,
      agendaFlag,
      nodeResolve(),
      typescript({
        noEmitOnError: true,
        outDir: `${outputDir}/.build`,
        sourceMap: production,
      }),
      production && terser(),
    ],
  },
  {
    treeshake: production,
    output: {
      dir: outputDir,
      entryFileNames: production ? '[name]-[hash].js' : '[name].js',
      chunkFileNames: production ? '[name]-[hash].js' : '[name].js',
      sourcemap: production,
    },
    plugins: [
      previewFlag,
      agendaFlag,
      nodeResolve(),
      json(),
      typescript({
        noEmitOnError: true,
        outDir: `${outputDir}/.build`,
        sourceMap: production,
      }),
      html({
        input: {
          html: compileBufferTemplate(fs.readFileSync('index.html')),
        },
        extractAssets: false,
        minify: production,
      }),
      copy({
        targets: [
          {
            src: 'public/*',
            dest: outputDir,
          },
          {
            src: 'public/manifest.json',
            dest: outputDir,
            transform: compileBufferTemplate,
          },
          {
            src: 'public/data/*.md',
            dest: `${outputDir}/data`,
            transform: compileBufferTemplate,
          },
          ...(agendaPreview
            ? [{ src: 'preview/agenda-draft-2026.json', dest: `${outputDir}/data` }]
            : []),
        ],
      }),
      production && !speakersPreview && !agendaPreview && generateSW(workboxConfig),
      production && terser(),
      watch && livereload({ watch: 'dist' }),
    ],
  },
];

export default speakersPreview || agendaPreview ? config.slice(1) : config;
