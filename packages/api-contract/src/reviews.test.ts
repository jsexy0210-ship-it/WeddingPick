import { loungeReviewListResponseSchema } from './reviews';

describe('라운지 후기 계약', () => {
  const review = {
    id: '00000000-0000-4000-8000-000000000001',
    role: 'contractor',
    roleLabel: '계약자',
    overall: 4,
    title: '상담이 편했어요',
    body: '상담 순서와 추가 비용을 차분하게 설명해줘서 비교하기 편했습니다.',
    pros: null,
    cons: null,
    verification: 'reported',
    verificationLabel: '상담제보',
    aspects: [],
    createdAt: '2026-09-18T03:00:00.000Z',
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
      id: '00000000-0000-4000-8000-000000000002',
      name: '가온웨딩홀',
      category: 'hall',
    },
  } as const;

  it('업체 정보가 붙은 기존 후기 모양을 받는다', () => {
    const parsed = loungeReviewListResponseSchema.parse({
      reviews: [review],
      nextCursor: 'cursor',
      caveat: '한 사람의 경험이에요.',
    });

    expect(parsed.reviews[0]?.vendor).toEqual(review.vendor);
    expect(parsed.nextCursor).toBe('cursor');
  });

  it('업종은 공용 업체 업종 계약을 따른다', () => {
    const parsed = loungeReviewListResponseSchema.safeParse({
      reviews: [{ ...review, vendor: { ...review.vendor, category: 'not-a-category' } }],
      nextCursor: null,
      caveat: '한 사람의 경험이에요.',
    });

    expect(parsed.success).toBe(false);
  });

  it('cursor가 끝나면 null을 받는다', () => {
    expect(
      loungeReviewListResponseSchema.parse({
        reviews: [],
        nextCursor: null,
        caveat: '한 사람의 경험이에요.',
      }).nextCursor
    ).toBeNull();
  });
});
