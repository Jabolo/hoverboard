import { describe, expect, it } from '@jest/globals';
import { PostData } from './post';
import { defaultPosts } from './test-fixtures';
import { allKeys } from './utils';

describe('post', () => {
  it('matches the shape of the default data', () => {
    const posts: PostData[] = defaultPosts;
    const keys: Array<keyof PostData> = [
      'backgroundColor',
      'brief',
      'content',
      'image',
      'published',
      'source',
      'title',
    ];

    expect(posts).toHaveLength(5);
    expect(allKeys(posts)).toStrictEqual(keys);
  });
});
