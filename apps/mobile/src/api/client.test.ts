import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, getComparison } from '@/api/client';
import { loadToken, saveToken } from '@/api/session';

// EXPO_PUBLIC_* 값은 빌드 시점에 박히므로 테스트에서는 설정 모듈을 갈아 끼운다.
jest.mock('@/api/config', () => ({
  API_URL: 'http://localhost:3000',
  isServerConfigured: true,
}));

const VALID_COMPARISON = {
  available: true,
  docType: 'contract',
  myAmount: 32_800_000,
  stat: {
    sampleCount: 9,
    periodStart: '2026-01-10',
    periodEnd: '2026-06-10',
    median: 28_800_000,
    p25: 27_000_000,
    p75: 30_000_000,
    p90: 31_000_000,
    minVerificationLevel: 'L2',
  },
  judgement: 'high',
};

function respondWith(body: unknown, status = 200) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await saveToken('token');
});

describe('서버 응답 검사', () => {
  it('계약대로 온 응답은 그대로 쓴다', async () => {
    respondWith(VALID_COMPARISON);

    await expect(getComparison('quote-1')).resolves.toMatchObject({ judgement: 'high' });
  });

  it('실 제보 건수 없이 중앙값만 온 응답은 거부한다', async () => {
    // 사업계획서 9번: 가격은 실 제보 건수·기준 기간과 함께여야 한다.
    const { sampleCount, ...statWithoutSampleCount } = VALID_COMPARISON.stat;
    respondWith({ ...VALID_COMPARISON, stat: statWithoutSampleCount });

    await expect(getComparison('quote-1')).rejects.toThrow(ApiError);
  });

  it('비교 불가에 이유가 없으면 거부한다', async () => {
    respondWith({ available: false, docType: 'contract' });

    await expect(getComparison('quote-1')).rejects.toThrow(ApiError);
  });

  it('이유가 있으면 비교 불가도 받는다', async () => {
    respondWith({ available: false, docType: 'contract', reason: 'not_enough_samples' });

    await expect(getComparison('quote-1')).resolves.toMatchObject({
      available: false,
      reason: 'not_enough_samples',
    });
  });

  it('세션이 끊기면 토큰을 버린다', async () => {
    respondWith(
      { error: { code: 'unauthenticated', message: '로그인이 필요합니다.' } },
      401
    );

    await expect(getComparison('quote-1')).rejects.toThrow('로그인이 필요합니다.');
    expect(await loadToken()).toBeNull();
  });
});
