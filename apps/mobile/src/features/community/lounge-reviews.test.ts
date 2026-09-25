import type { LoungeReviewListResponse } from '@weddingpick/api-contract';

import {
  appendLoungeReviewPage,
  loungeFeedMatches,
  loungeReviewCategory,
  loungeVendorMatches,
} from './lounge-reviews';

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
  media: [],
  helpful: {
    count: 0,
    mine: false,
  },
  comments: {
    count: 0,
    items: [],
  },
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
    /* 묶음 칩은 서버에 한 업종으로 보낼 수 없다 — 전체를 받아 화면에서 거른다. */
    expect(loungeReviewCategory('스드메')).toBeUndefined();
    expect(loungeReviewCategory('본식')).toBeUndefined();
    expect(loungeReviewCategory('예물 · 신혼')).toBeUndefined();
  });

  it('묶음 칩은 준비 현황 그룹의 업종을 모두 담는다', () => {
    expect(loungeVendorMatches('전체', 'hall')).toBe(true);
    expect(loungeVendorMatches('스드메', 'dress')).toBe(true);
    expect(loungeVendorMatches('스드메', 'hair')).toBe(true);
    expect(loungeVendorMatches('본식', 'snap')).toBe(true);
    expect(loungeVendorMatches('예물 · 신혼', 'honeymoon')).toBe(true);
    expect(loungeVendorMatches('예산', 'hall')).toBe(false);
    expect(loungeFeedMatches('스드메', '드레스')).toBe(true);
    expect(loungeFeedMatches('예산', '예산')).toBe(true);
    expect(loungeFeedMatches('웨딩홀', '드레스')).toBe(false);
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
