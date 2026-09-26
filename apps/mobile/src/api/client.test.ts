import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ApiError,
  clearReadCache,
  completeSetup,
  refreshReads,
  listVendorRegions,
  setDisplayName,
  searchVendors,
  getCurrentUser,
  getAppBootstrap,
  getSignupState,
  getWeddingFeed,
  updateSettings,
} from '@/api/client';
import { clearToken, loadToken, saveToken } from '@/api/session';
import { readCurrentUserSnapshot } from '@/features/loading/current-user-snapshot';
import { prefetchHomeBootstrap } from '@/features/home/home-handoff';
import { listWeddingContent } from '@/features/home/content';

// EXPO_PUBLIC_* 값은 빌드 시점에 박히므로 테스트에서는 설정 모듈을 갈아 끼운다.
jest.mock('@/api/config', () => ({
  API_URL: 'http://localhost:3000',
  isServerConfigured: true,
}));

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
  // 캐시는 앱이 사는 동안 남는다 — 시험끼리 섞이지 않게 비우고 시작한다.
  clearReadCache();
});

describe('서버 응답 검사', () => {
  it('가입 상태는 직전 응답이 있어도 서버에서 다시 확인한다', async () => {
    const state = { activated: false, ageVerified: true, minimumAge: 14, items: [], missingRequired: ['terms', 'privacy'] };
    respondWith(state);
    await expect(getSignupState()).resolves.toMatchObject({ activated: false });
    jest.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ ...state, activated: true, missingRequired: [] }),
    } as Response);
    await expect(getSignupState()).resolves.toMatchObject({ activated: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('세션이 끊기면 토큰을 버린다', async () => {
    respondWith(
      { error: { code: 'unauthenticated', message: '로그인이 필요합니다.' } },
      401
    );

    await expect(getCurrentUser()).rejects.toThrow('로그인이 필요합니다.');
    expect(await loadToken()).toBeNull();
  });
});

/**
 * 홈 「웨딩 준비 팁」은 준비 단계 순서로 묻는다(2026-09-26 대표 오더). 순서는 서버가 로그인한
 * 사람의 단계로 매기므로 토큰을 싣고, 라운지 목록과는 주소가 달라 캐시를 섞지 않는다.
 */
describe('웨딩피드 순서', () => {
  const FEED = { items: [], tabs: [{ key: 'all', label: '전체', categories: [] }] };

  it('홈 미리보기는 준비 단계 순서를 토큰과 함께 묻는다', async () => {
    respondWith(FEED);

    await listWeddingContent(2);

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/v1/wedding-feed?limit=2&order=stage');
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer token' });
  });

  it('라운지 목록은 순서를 묻지 않는다 — 홈 미리보기와 캐시를 나눠 쓴다', async () => {
    respondWith(FEED);

    await listWeddingContent(2);
    await getWeddingFeed();

    expect(jest.mocked(globalThis.fetch).mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3000/v1/wedding-feed?limit=2&order=stage',
      'http://localhost:3000/v1/wedding-feed',
    ]);
  });
});

/**
 * 읽기 캐시. 화면을 다시 열 때 서버를 다시 묻지 않게 하되, 내가 바꾼 것은 바로
 * 보여야 하고, 답이 바뀌기를 기다리는 주소는 캐시에 걸리면 안 된다.
 */
describe('읽기 캐시', () => {
  const REGIONS = { regions: [{ name: '서울', vendorCount: 3 }] };

  it('같은 주소를 두 번 물어도 서버에는 한 번만 간다', async () => {
    respondWith(REGIONS);

    await listVendorRegions();
    await listVendorRegions();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('동시에 부르면 하나로 합친다', async () => {
    respondWith(REGIONS);

    await Promise.all([listVendorRegions(), listVendorRegions(), listVendorRegions()]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('표시명 변경은 업체 지역 캐시를 지우지 않는다', async () => {
    respondWith(REGIONS);
    await listVendorRegions();

    respondWith({ displayName: '우리' });
    await setDisplayName('우리');

    respondWith(REGIONS);
    await listVendorRegions();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

});


function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
});
const SEARCH = { vendors: [], sponsored: [], total: 0, nextCursor: null };
const MEMBER = {
  userId: '11111111-1111-4111-8111-111111111111', weddingId: null,
  displayName: '테스트', weddingDate: null, region: null, preparedCategories: [],
  budgetBracket: null, budgetAmount: null, setupComplete: true, styleTags: [],
  spouseLinked: false, partnerDisplayName: null, hasPaymentProof: false, hasPick: false,
  hasCompared: false, tier: 'mate', tierLabel: '메이트',
};

// 서버에 도착한 시점을 기다린다. 실제 네트워크나 운영 데이터는 사용하지 않는다.
async function untilCalled(mock: jest.Mock, count = 1) {
  /*
   * Response.json() + AsyncStorage가 섞인 경로는 Promise microtask만 30번 비운다고
   * CI에서 끝난다는 보장이 없다. 실제 이벤트 루프를 한 틱씩 넘기며 콜백 자체를
   * 기다린다. 제품 지연을 흉내 내는 것이 아니라 테스트가 관찰 대상을 기다리는 자리다.
   */
  for (let i = 0; i < 100 && mock.mock.calls.length < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(mock).toHaveBeenCalledTimes(count);
}

describe('재방문과 계정 변경 회귀', () => {
  it('45초 뒤 같은 업체 조건은 서버 응답 전에 표시하고 최신 결과를 전달한다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith(SEARCH);
    await searchVendors({ region: '서울' });
    now.mockReturnValue(45_000);
    const network = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn().mockReturnValue(network.promise);
    globalThis.fetch = fetch;
    const onValue = jest.fn();
    const onError = jest.fn();
    const onRefreshing = jest.fn();
    await expect(searchVendors({ region: '서울' }, { onValue, onError, onRefreshing })).resolves.toEqual(SEARCH);
    expect(onValue).not.toHaveBeenCalled();
    expect(onRefreshing).toHaveBeenCalledWith(true);
    await untilCalled(fetch);
    const updated = { ...SEARCH, total: 2 };
    network.resolve(response(updated));
    await untilCalled(onValue);
    expect(onValue).toHaveBeenCalledWith(updated);
    expect(onRefreshing).toHaveBeenLastCalledWith(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it('구독 없는 호출은 30초를 넘기면 기존대로 서버를 기다린다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith(SEARCH);
    await searchVendors({});
    now.mockReturnValue(45_000);
    respondWith({ ...SEARCH, total: 2 });
    await expect(searchVendors({})).resolves.toMatchObject({ total: 2 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('지역 목록은 45초 뒤에도 추가 요청 없이 재사용한다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith({ regions: [] });
    await listVendorRegions();
    now.mockReturnValue(45_000);
    await listVendorRegions();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('토큰 교체는 같은 주소의 이전 계정 캐시를 재사용하지 않는다', async () => {
    respondWith(SEARCH);
    await searchVendors({});
    await saveToken('new-token');
    respondWith({ ...SEARCH, total: 4 });
    await expect(searchVendors({})).resolves.toMatchObject({ total: 4 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('이전 계정의 늦은 401은 새 토큰을 지우지 않는다', async () => {
    const network = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn().mockReturnValue(network.promise);
    globalThis.fetch = fetch;
    const pending = searchVendors({});
    await untilCalled(fetch);
    await saveToken('new-token');
    network.resolve(response({ error: { code: 'unauthenticated', message: '로그인이 필요합니다.' } }, 401));
    await expect(pending).rejects.toBeInstanceOf(ApiError);
    expect(await loadToken()).toBe('new-token');
  });

  it('로그아웃 후 도착한 회원·bootstrap은 snapshot을 다시 채우지 않는다', async () => {
    const network = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn().mockReturnValue(network.promise);
    globalThis.fetch = fetch;
    const pending = getAppBootstrap();
    await untilCalled(fetch);
    await clearToken();
    clearReadCache();
    network.resolve(response({ member: MEMBER, notifications: null, popularVendors: [], candidates: null, recommendations: [] }));
    await expect(pending).rejects.toBeInstanceOf(ApiError);
    expect(readCurrentUserSnapshot()).toBeNull();
  });

  it('쓰기 전 출발한 읽기는 쓰기 후 캐시를 다시 채우지 않는다', async () => {
    const network = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn().mockReturnValue(network.promise);
    globalThis.fetch = fetch;
    const old = getCurrentUser();
    await untilCalled(fetch);
    respondWith({ displayName: '새 이름' });
    await setDisplayName('새 이름');
    network.resolve(response(MEMBER));
    await old;
    expect(readCurrentUserSnapshot()).toBeNull();
    respondWith({ ...MEMBER, displayName: '새 이름' });
    await expect(getCurrentUser()).resolves.toMatchObject({ displayName: '새 이름' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('영향 범위를 모르는 쓰기는 실패해도 전체 캐시를 무효화한다', async () => {
    respondWith({ regions: [] });
    await listVendorRegions();
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(updateSettings({})).rejects.toBeInstanceOf(ApiError);
    respondWith({ regions: [] });
    await listVendorRegions();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});


describe('최신 업체 응답의 경계', () => {
  const observer = () => ({ onValue: jest.fn(), onError: jest.fn(), onRefreshing: jest.fn() });

  it('2분이 지나면 이전 업체 목록을 반환하지 않는다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith(SEARCH);
    await searchVendors({});
    now.mockReturnValue(120_000);
    respondWith({ ...SEARCH, total: 7 });
    await expect(searchVendors({}, observer())).resolves.toMatchObject({ total: 7 });
  });

  it('수동 새로고침은 3초 이내 캐시도 새로 확인한다', async () => {
    respondWith(SEARCH);
    await searchVendors({});
    respondWith({ ...SEARCH, total: 7 });
    await expect(searchVendors({}, { ...observer(), force: true })).resolves.toMatchObject({ total: 7 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('갱신 중 권한이 거절되면 오류를 전달하고 캐시를 버린다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith(SEARCH);
    await searchVendors({});
    now.mockReturnValue(45_000);
    respondWith({ error: { code: 'forbidden', message: '권한을 확인해 주세요.' } }, 403);
    const refresh = observer();
    await searchVendors({}, refresh);
    await untilCalled(refresh.onError);
    expect(refresh.onError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    expect(refresh.onValue).not.toHaveBeenCalled();
    respondWith({ ...SEARCH, total: 5 });
    await expect(searchVendors({})).resolves.toMatchObject({ total: 5 });
  });

  it('갱신 중 로그아웃하면 이전 계정의 결과를 콜백에 주지 않는다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith(SEARCH);
    await searchVendors({});
    now.mockReturnValue(45_000);
    const network = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn().mockReturnValue(network.promise);
    globalThis.fetch = fetch;
    const refresh = observer();
    await searchVendors({}, refresh);
    await untilCalled(fetch);
    await clearToken();
    clearReadCache();
    network.resolve(response({ ...SEARCH, total: 8 }));
    await untilCalled(refresh.onError);
    expect(refresh.onValue).not.toHaveBeenCalled();
    expect(refresh.onError).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('계정 교체 후 이전 갱신의 오류와 완료 신호는 전달하지 않는다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith(SEARCH);
    await searchVendors({});
    now.mockReturnValue(45_000);
    const network = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn().mockReturnValue(network.promise);
    globalThis.fetch = fetch;
    const refresh = observer();
    await searchVendors({}, refresh);
    await untilCalled(fetch);
    const signalsBeforeSwitch = refresh.onRefreshing.mock.calls.length;
    await saveToken('new-account');
    respondWith({ ...SEARCH, total: 3 });
    await searchVendors({});
    network.resolve(response({ error: { code: 'unauthenticated', message: '로그인이 필요합니다.' } }, 401));
    for (let i = 0; i < 40; i += 1) await Promise.resolve();
    expect(refresh.onValue).not.toHaveBeenCalled();
    expect(refresh.onError).not.toHaveBeenCalled();
    expect(refresh.onRefreshing).toHaveBeenCalledTimes(signalsBeforeSwitch);
    expect(await loadToken()).toBe('new-account');
  });

  it('갱신 중 쓰기가 끝나면 쓰기 전 목록을 콜백에 주지 않는다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    respondWith(SEARCH);
    await searchVendors({});
    now.mockReturnValue(45_000);
    const network = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn().mockReturnValue(network.promise);
    globalThis.fetch = fetch;
    const refresh = observer();
    await searchVendors({}, refresh);
    await untilCalled(fetch);
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(updateSettings({})).rejects.toBeInstanceOf(ApiError);
    network.resolve(response({ ...SEARCH, total: 8 }));
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
    expect(refresh.onValue).not.toHaveBeenCalled();
    respondWith({ ...SEARCH, total: 3 });
    await expect(searchVendors({})).resolves.toMatchObject({ total: 3 });
  });

  it('오류 본문을 읽는 중 계정이 바뀌면 새 계정 캐시를 지우지 않는다', async () => {
    const body = deferred<unknown>();
    const json = jest.fn().mockReturnValue(body.promise);
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json });
    const pending = searchVendors({});
    await untilCalled(json);
    await saveToken('next-token');
    respondWith({ ...SEARCH, total: 6 });
    await searchVendors({});
    body.resolve({ error: { code: 'forbidden', message: '권한을 확인해 주세요.' } });
    await expect(pending).rejects.toBeInstanceOf(ApiError);
    respondWith({ ...SEARCH, total: 9 });
    await expect(searchVendors({})).resolves.toMatchObject({ total: 6 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('계약 밖의 401도 캐시와 토큰을 지운다', async () => {
    respondWith(SEARCH);
    await searchVendors({});
    respondWith({ message: 'unauthorized' }, 401);
    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiError);
    expect(await loadToken()).toBeNull();
    respondWith({ ...SEARCH, total: 9 });
    await expect(searchVendors({})).resolves.toMatchObject({ total: 9 });
  });

  it('응답 본문을 읽는 중 계정이 바뀌어도 snapshot을 쓰지 않는다', async () => {
    const body = deferred<typeof MEMBER>();
    const json = jest.fn().mockReturnValue(body.promise);
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json });
    const pending = getCurrentUser();
    await untilCalled(json);
    await saveToken('next-token');
    body.resolve(MEMBER);
    await expect(pending).rejects.toBeInstanceOf(ApiError);
    expect(readCurrentUserSnapshot()).toBeNull();
  });
});

/**
 * 온보딩 저장 → 홈(2026-09-26 대표 감사 4). 설정 화면이 저장 직후 홈 자료를 먼저
 * 띄우고(`prefetchHomeBootstrap`) 홈이 같은 주소를 부른다. 화면이 두 번 마운트돼도
 * 서버에는 한 번만 가야 한다 — 짐작하지 않고 fetch 횟수를 센다.
 */
describe('온보딩 저장 뒤 홈 bootstrap', () => {
  const BOOT = {
    member: MEMBER, notifications: null, popularVendors: [], candidates: null, recommendations: [],
    budget: null, bracketAnswered: false, partnerInvitePending: false,
  };

  it('설정 저장 → 미리 띄운 bootstrap → 홈의 bootstrap은 서버에 한 번만 간다', async () => {
    const boot = deferred<ReturnType<typeof response>>();
    const fetch = jest.fn((url: string) => {
      if (url.endsWith('/v1/me/setup')) return Promise.resolve(response(MEMBER));
      if (url.endsWith('/v1/app/bootstrap')) return boot.promise;
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

    await completeSetup({ weddingDate: null, region: '서울', preparedCategories: [], budgetBracket: 'unknown', styleTags: ['URBAN'] } as never);

    prefetchHomeBootstrap();
    const bootstrapCalls = () => fetch.mock.calls.filter(([url]) => url.endsWith('/v1/app/bootstrap')).length;
    for (let i = 0; i < 100 && bootstrapCalls() < 1; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    /* 홈이 마운트되며 같은 주소를 부른다 — 가 있는 요청에 합쳐진다. */
    const home = getAppBootstrap();
    boot.resolve(response(BOOT));
    await expect(home).resolves.toMatchObject({ member: { userId: MEMBER.userId } });

    /* 홈이 다시 포커스를 받아도 30초 캐시가 답한다. */
    await getAppBootstrap();

    expect(bootstrapCalls()).toBe(1);
  });
});

/**
 * 당겨서 새로 고침(2026-09-26 대표 지시 「화면 자체를 밑으로 내리면 새로고침 진행한다」).
 * 창이 열린 동안 떠난 읽기는 캐시를 건너뛰고, 창은 그 읽기가 — 앞 답을 받고 이어 떠난 것까지 —
 * 전부 돌아와야 닫힌다. 받은 답은 캐시에 다시 적혀 다음 화면도 새 값을 본다.
 */
describe('당겨서 새로 고침 — 캐시 우회', () => {
  const REGIONS = { regions: [{ name: '서울', vendorCount: 3 }] };
  const UPDATED = { regions: [{ name: '서울', vendorCount: 4 }] };

  it('5분 캐시 안의 주소도 창 안에서는 서버에 다시 묻고, 새 답을 캐시에 적는다', async () => {
    respondWith(REGIONS);
    await listVendorRegions();
    await listVendorRegions();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    respondWith(UPDATED);
    let seen: unknown = null;
    await refreshReads(async () => {
      seen = await listVendorRegions();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(UPDATED);

    // 창이 닫히면 다시 캐시 — 방금 받은 새 값이다.
    await expect(listVendorRegions()).resolves.toEqual(UPDATED);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('앞 답을 받고 이어 떠나는 읽기(bootstrap → 일정 같은)까지 기다리고, 그것도 새로 받는다', async () => {
    respondWith(REGIONS);
    await listVendorRegions();
    respondWith(MEMBER);
    await getCurrentUser();

    const fetch = jest.fn()
      .mockResolvedValueOnce(response(MEMBER))
      .mockResolvedValueOnce(response(UPDATED));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    const chained = jest.fn();

    // load가 약속을 돌려주지 않아도(화면의 load는 대개 void) 창이 끝까지 기다린다.
    await refreshReads(() => {
      void getCurrentUser().then(() => listVendorRegions()).then(chained);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[0][0])).toContain('/v1/me');
    expect(String(fetch.mock.calls[1][0])).toContain('/v1/vendors/regions');
    expect(chained).toHaveBeenCalledWith(UPDATED);
  });

  it('창 밖의 읽기는 그대로 캐시를 쓴다 — 새로 고침이 다른 화면의 캐시를 버리지 않는다', async () => {
    respondWith(REGIONS);
    await listVendorRegions();
    await refreshReads(() => undefined);
    await listVendorRegions();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('load가 던져도 창은 닫힌다 — 오류는 화면이 보여준다', async () => {
    await expect(refreshReads(() => {
      throw new Error('화면 오류');
    })).resolves.toBeUndefined();
    respondWith(REGIONS);
    await listVendorRegions();
    await listVendorRegions();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
