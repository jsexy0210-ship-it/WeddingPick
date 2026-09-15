import { MAX_COMPARED_VENDORS, computePriceStat, judgePrice } from '@weddingpick/domain';
import type { PriceSample } from '@weddingpick/domain';

import { analysisSchema } from './analyses';
import { comparisonResponseSchema, priceStatSchema } from './comparison';
import { createUploadRequestSchema } from './documents';
import { ENDPOINTS, buildPath } from './endpoints';
import { createVerificationResponseSchema } from './verification';
import { COMPARE_IDS_MAX_LENGTH, vendorCompareQuerySchema } from './vendors';

describe('가격 비교 응답', () => {
  const stat = {
    sampleCount: 12,
    periodStart: '2026-01-01',
    periodEnd: '2026-06-30',
    median: 10_000_000,
    p25: 9_000_000,
    p75: 11_000_000,
    p90: 12_000_000,
    minVerificationLevel: 'L2' as const,
  };

  it('가격이 있으면 표본 수와 기준 기간이 함께 온다', () => {
    // 사업계획서 9번: 표본 수와 기준 기간은 항상 동반 표시한다.
    const { sampleCount, ...withoutSampleCount } = stat;

    expect(priceStatSchema.safeParse(stat).success).toBe(true);
    expect(priceStatSchema.safeParse(withoutSampleCount).success).toBe(false);
  });

  it('비교 불가 응답에는 이유가 반드시 붙는다', () => {
    expect(
      comparisonResponseSchema.safeParse({
        available: false,
        docType: 'contract',
        reason: 'not_enough_samples',
        sampleCount: 2,
      }).success
    ).toBe(true);

    // 이유 없이 "비교 불가"만 보내면 화면이 빈 가격을 그릴 수 있다.
    expect(
      comparisonResponseSchema.safeParse({ available: false, docType: 'contract' }).success
    ).toBe(false);
  });

  it('중앙값만 들어 있는 응답은 계약을 통과하지 못한다', () => {
    expect(
      comparisonResponseSchema.safeParse({
        available: true,
        docType: 'contract',
        myAmount: 10_500_000,
        stat: { median: 10_000_000 },
        judgement: 'similar',
      }).success
    ).toBe(false);
  });

  it('도메인 계산 결과가 그대로 계약에 실린다', () => {
    const samples: PriceSample[] = Array.from({ length: 8 }, (_, index) => ({
      amount: 9_000_000 + index * 250_000,
      verificationLevel: 'L2',
      contractDate: '2026-03-01',
    }));

    const computed = computePriceStat(samples);
    expect(computed).not.toBeNull();

    const payload = {
      available: true as const,
      docType: 'contract' as const,
      myAmount: 12_000_000,
      stat: {
        sampleCount: computed!.sampleCount,
        periodStart: computed!.periodStart,
        periodEnd: computed!.periodEnd,
        median: computed!.median,
        p25: computed!.p25,
        p75: computed!.p75,
        p90: computed!.p90,
        minVerificationLevel: computed!.minVerificationLevel,
      },
      judgement: judgePrice(12_000_000, computed!),
    };

    expect(comparisonResponseSchema.safeParse(payload).success).toBe(true);
  });
});

describe('인증 신청', () => {
  it('접수 응답에는 승인이 들어갈 수 없다', () => {
    // 서비스정책서 7번: 자동승인 금지. 증빙 확인 후에만 등급이 오른다.
    expect(
      createVerificationResponseSchema.safeParse({
        requestId: '00000000-0000-4000-8000-000000000000',
        status: 'received',
        receivedAt: '2026-08-28T00:00:00Z',
      }).success
    ).toBe(true);

    expect(
      createVerificationResponseSchema.safeParse({
        requestId: '00000000-0000-4000-8000-000000000000',
        status: 'approved',
        receivedAt: '2026-08-28T00:00:00Z',
      }).success
    ).toBe(false);
  });
});

describe('분석 상태', () => {
  it('성공했으면 문서 id가 반드시 있다', () => {
    expect(
      analysisSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000000',
        status: 'succeeded',
        startedAt: '2026-08-28T00:00:00Z',
        finishedAt: '2026-08-28T00:00:10Z',
      }).success
    ).toBe(false);
  });

  it('실패했으면 이유가 반드시 있다', () => {
    expect(
      analysisSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000000',
        status: 'failed',
        startedAt: '2026-08-28T00:00:00Z',
        finishedAt: '2026-08-28T00:00:10Z',
      }).success
    ).toBe(false);
  });
});

describe('업로드 요청', () => {
  const weddingId = '00000000-0000-4000-8000-000000000000';

  it('장이 하나도 없으면 거절한다', () => {
    expect(createUploadRequestSchema.safeParse({ weddingId, pages: [] }).success).toBe(false);
  });

  it('견적서로 쓰이지 않는 형식은 거절한다', () => {
    expect(
      createUploadRequestSchema.safeParse({
        weddingId,
        pages: [{ mimeType: 'video/mp4', sizeBytes: 100 }],
      }).success
    ).toBe(false);
  });

  it('사진과 PDF는 받는다', () => {
    expect(
      createUploadRequestSchema.safeParse({
        weddingId,
        pages: [
          { mimeType: 'image/jpeg', sizeBytes: 2_000_000 },
          { mimeType: 'application/pdf', sizeBytes: 500_000 },
        ],
      }).success
    ).toBe(true);
  });
});

describe('경로', () => {
  it('파라미터를 채워 경로를 만든다', () => {
    expect(buildPath('getQuote', { quoteId: 'abc' })).toBe('/v1/quotes/abc');
  });

  it('파라미터가 빠지면 부르기 전에 막는다', () => {
    expect(() => buildPath('getQuote')).toThrow(/quoteId/);
  });

  it('모든 경로는 버전으로 시작한다', () => {
    for (const endpoint of Object.values(ENDPOINTS)) {
      expect(endpoint.path.startsWith('/v1/')).toBe(true);
    }
  });
});

describe('업체 비교 질의', () => {
  const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const ids = (count: number) =>
    Array.from({ length: count }, (_, index) => uuid(index)).join(',');

  it('한도만큼은 통과한다', () => {
    expect(vendorCompareQuerySchema.safeParse({ ids: ids(MAX_COMPARED_VENDORS) }).success).toBe(
      true
    );
  });

  it('한 곳 넘긴 요청도 길이에서 막지 않는다', () => {
    /*
     * **이것을 안 보면 안내 문구가 죽는다.** 길이를 딱 맞게 끊으면 여섯 곳 요청이
     * 「요청 형식이 올바르지 않습니다」로 튕기고, 서버가 준비해 둔 「한 번에 N곳까지
     * 견줄 수 있습니다」는 한 번도 나가지 못한다. 사용자는 몇 곳까지 되는지 모른다.
     *
     * 2026-09-14에 실제로 그랬다 — 200자로 박아 둔 값이 한도를 셋에서 다섯으로
     * 올린 뒤 여섯 곳 요청(221자)을 먼저 잡았고, CI가 그제서야 잡아냈다.
     */
    expect(vendorCompareQuerySchema.safeParse({ ids: ids(MAX_COMPARED_VENDORS + 1) }).success).toBe(
      true
    );
  });

  it('상한은 상한 노릇을 한다', () => {
    // 넉넉히 열어두면 막는 값이 아니게 된다. 두 곳을 더 보내면 거기서 끊긴다.
    expect(vendorCompareQuerySchema.safeParse({ ids: ids(MAX_COMPARED_VENDORS + 2) }).success).toBe(
      false
    );
  });

  it('길이를 숫자로 박아두지 않는다', () => {
    // 한도가 움직이면 길이도 따라 움직여야 한다. 안 그러면 조용히 어긋난다.
    expect(COMPARE_IDS_MAX_LENGTH).toBe(37 * (MAX_COMPARED_VENDORS + 1));
  });
});
