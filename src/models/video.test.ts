import { describe, expect, it } from '@jest/globals';
import { allKeys } from './utils';
import { defaultVideos } from './test-fixtures';
import { Video } from './video';

describe('video', () => {
  it('matches the shape of the default data', () => {
    const videos: Video[] = defaultVideos;
    const keys: Array<keyof Video> = ['speakers', 'thumbnail', 'title', 'youtubeId'];

    expect(videos).toHaveLength(22);
    expect(allKeys(videos)).toStrictEqual(keys);
  });
});
