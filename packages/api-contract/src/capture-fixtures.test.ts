/**
 * 화면 캡처용 가짜 응답(`scripts/fixtures/api.cjs`)이 계약을 만족하는가.
 *
 * **왜 시험으로 두는가.** 앱은 계약에 어긋난 응답과 서버 장애를 구별하지 않는다 —
 * `apps/mobile/src/api/client.ts`가 zod 실패를 「서버 응답을 이해하지 못했습니다」
 * 하나로 묶어 던지고, 화면에는 「연결이 불안정해요」만 뜬다. 칸 하나가 빠진 것을
 * 찍는 사람은 네트워크 문제로 읽고, 화면은 영영 안 찍힌다.
 *
 * 계약이 바뀌면 여기가 먼저 빨개진다. 그때 `scripts/fixtures/api.cjs`를 고친다.
 */
import type { ZodType } from 'zod';

import { appBootstrapResponseSchema } from './app';
import { authProvidersResponseSchema } from './auth';
import { candidateListResponseSchema } from './candidates';
import { signupStateSchema } from './signup';
import { vendorRegionsResponseSchema, vendorSearchResponseSchema } from './vendors';
import { currentUserSchema } from './weddings';

/*
 * fixture는 캡처 도구(ESM)와 이 시험(ts-jest·CJS)이 같이 읽어야 해서 `.cjs`다.
 * 이 패키지의 tsconfig에는 node 타입이 없으므로 쓰는 만큼만 여기서 알려 준다 —
 * 패키지 전체의 타입 범위를 캡처 도구 사정으로 넓히지 않는다.
 */
declare const require: (id: string) => { routes: Record<string, unknown> };

const { routes } = require('../../../scripts/fixtures/api.cjs');

/** 경로 → 그 경로가 지켜야 할 계약. 새 fixture를 더하면 여기에도 한 줄 더한다. */
const CONTRACTS = new Map<string, ZodType>([
  ['GET /v1/me/signup', signupStateSchema],
  ['GET /v1/me', currentUserSchema],
  ['GET /v1/app/bootstrap', appBootstrapResponseSchema],
  ['GET /v1/auth/providers', authProvidersResponseSchema],
  ['GET /v1/weddings/:weddingId/candidates', candidateListResponseSchema],
  ['GET /v1/vendors/regions', vendorRegionsResponseSchema],
  ['GET /v1/vendors', vendorSearchResponseSchema],
]);

/**
 * 계약이 없는 경로. 관리자 콘솔 응답은 `packages/api-contract`가 아니라
 * `apps/api`의 타입이 정하므로 여기서 검사할 스키마가 없다 — 그래도 **적어는
 * 둔다.** 빠뜨린 것과 일부러 뺀 것을 구별하려고.
 */
const NO_CONTRACT = new Set(['GET /v1/admin/ads-gate', 'GET /v1/admin/ad-tiers']);

/**
 * 함수 fixture는 한 번 불러 본다 — 조건 없이 부른 결과가 기본 응답이다.
 *
 * 질의 문자열은 비워서 넘긴다. 찾는 칸이 없을 때 무엇을 돌려주는지가 여기서 볼 값이다.
 */
function bodyOf(key: string): unknown {
  const entry = routes[key];

  if (typeof entry !== 'function') return entry;

  const call = entry as (input: { url: { searchParams: { get: () => null } } }) => unknown;

  return call({ url: { searchParams: { get: () => null } } });
}

describe('캡처용 가짜 응답', () => {
  it('광고 자리를 비워 두지 않는다', () => {
    /*
     * 비워 두면 광고 칸이 없는 화면만 찍히고, 「코드에 자리가 있다」와 「실제로
     * 그려진다」가 구별되지 않는다 — 2026-09-11에 그 차이로 하루를 썼다.
     */
    const search = bodyOf('GET /v1/vendors') as { sponsored: unknown[] };

    expect(search.sponsored.length).toBeGreaterThan(0);
  });


  it.each([...CONTRACTS.keys()])('%s 가 계약을 만족한다', (key) => {
    const schema = CONTRACTS.get(key);

    if (!schema) throw new Error(`계약이 없다: ${key}`);

    const parsed = schema.safeParse(bodyOf(key));

    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it('계약을 적어두지 않은 fixture를 남기지 않는다', () => {
    expect(
      Object.keys(routes).filter((key) => !CONTRACTS.has(key) && !NO_CONTRACT.has(key))
    ).toEqual([]);
  });
});
