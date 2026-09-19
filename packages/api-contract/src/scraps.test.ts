import { z } from 'zod';

import {
  weddingFeedScrapListResponseSchema,
  weddingFeedScrapStateSchema,
} from './scraps';

describe('wedding feed scraps contract', () => {
  it('accepts a saved public feed item', () => {
    expect(
      weddingFeedScrapListResponseSchema.parse({
        items: [{
          id: '00000000-0000-4000-8000-000000000001',
          categoryLabel: '드레스',
          title: '드레스 고르는 법',
          summary: '요약',
          imageUrl: null,
          savedAt: '2026-09-19T00:00:00.000Z',
        }],
      }).items
    ).toHaveLength(1);
  });

  it('keeps scrap state boolean-only', () => {
    expect(weddingFeedScrapStateSchema.parse({ saved: true })).toEqual({ saved: true });
    expect(() => weddingFeedScrapStateSchema.parse({ saved: 'yes' })).toThrow(z.ZodError);
  });
});
