import type { LoungeReviewListResponse } from '@weddingpick/api-contract';

import { appendLoungeReviewPage, loungeReviewCategory } from './lounge-reviews';

const baseReview = {
  id: '00000000-0000-4000-8000-000000000001',
  role: 'contractor' as const,
  roleLabel: '계약자',
  overall: 4,
  title: '후기',
  body: '충분히 긴 후기 본문입니다.',
  pros: null,
  cons: null,
  verification: 'contract' as const,
  verificationLabel: '계약 확인',
  aspects: [],
  createdAt: '2026-09-18T00:00:00.000Z',
  mine: false,
  rebuttal: null,
  vendor: {
    id: '00000000-0000-4000-8000-000000000010',
    name: 'A 웨딩홀',
    category: 'hall' as const,
  },
};

describe('라운지 후기 페이지 연결', () => {
  it('정본 칩 중 실제 업체 업종만 서버 category로 보낸다', () => {
    expect(loungeReviewCategory('전체')).toBeUndefined();
    expect(loungeReviewCategory('예산')).toBeUndefined();
    expect(loungeReviewCategory('웨딩홀')).toBe('hall');
    expect(loungeReviewCategory('드레스')).toBe('dress');
    expect(loungeReviewCategory('스튜디오')).toBe('studio');
    expect(loungeReviewCategory('메이크업')).toBe('makeup');
    expect(loungeReviewCategory('허니문')).toBe('honeymoon');
  });

  it('cursor 다음 쪽을 순서대로 붙이고 중복 id는 제거한다', () => {
    const second = {
      ...baseReview,
      id: '00000000-0000-4000-8000-000000000002',
      vendor: { ...baseReview.vendor, id: '00000000-0000-4000-8000-000000000011' },
    };
    const current: LoungeReviewListResponse = {
      reviews: [baseReview],
      nextCursor: 'cursor-a',
      caveat: '기존 안내',
    };
    const next: LoungeReviewListResponse = {
      reviews: [baseReview, second],
      nextCursor: 'cursor-b',
      caveat: '최신 안내',
    };

    expect(appendLoungeReviewPage(current, next)).toEqual({
      reviews: [baseReview, second],
      nextCursor: 'cursor-b',
      caveat: '최신 안내',
    });
  });
});
