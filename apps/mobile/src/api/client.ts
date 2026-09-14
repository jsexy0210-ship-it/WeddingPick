import {
  analysisSchema,
  candidateListResponseSchema,
  decisionListResponseSchema,
  expenseDetailSchema,
  expenseSummaryResponseSchema,
  visitNoteListResponseSchema,
  weddingEventListResponseSchema,
  weddingNoteListResponseSchema,
  weddingTaskListResponseSchema,
  authProvidersResponseSchema,
  comparisonResponseSchema,
  completeUploadResponseSchema,
  createSessionResponseSchema,
  createUploadResponseSchema,
  currentUserSchema,
  displayNameResponseSchema,
  top3ResponseSchema,
  errorResponseSchema,
  createVerificationResponseSchema,
  quoteSchema,
  createInquiryResponseSchema,
  inquiryListResponseSchema,
  registerDeviceResponseSchema,
  settingsSchema,
  signupStateSchema,
  tasteListResponseSchema,
  myReportListResponseSchema,
  notificationListResponseSchema,
  notificationSummaryResponseSchema,
  rebuttalListResponseSchema,
  registerPaymentProofResponseSchema,
  createReviewReportResponseSchema,
  createReviewResponseSchema,
  reportReasonListResponseSchema,
  reviewFormSchema,
  reviewListResponseSchema,
  plannerDetailSchema,
  plannerRegionsResponseSchema,
  plannerSearchResponseSchema,
  vendorComparisonResponseSchema,
  vendorDetailSchema,
  vendorRegionsResponseSchema,
  createInviteResponseSchema,
  invitePreviewResponseSchema,
  vendorSearchResponseSchema,
  conditionStatsSchema,
  myRewardsResponseSchema,
  myMonthlyDrawResponseSchema,
  vendorClaimListResponseSchema,
  weddingInviteListResponseSchema,
  verificationRequestSchema,
  weddingDetailSchema,
  type CandidateListResponse,
  type ConditionStats,
  type DecideCategoryRequest,
  type MyRewardsResponse,
  type MyMonthlyDrawResponse,
  type CreateRebuttalRequest,
  type CreateVendorClaimRequest,
  type VendorClaimListResponse,
  type MyReportListResponse,
  type NotificationListResponse,
  type NotificationSummaryResponse,
  type RebuttalListResponse,
  type UpdateReviewRequest,
  type Settings,
  type UpdateSettingsRequest,
  type TasteListResponse,
  type UpdateTasteRequest,
  type VendorSort,
  type UpdateRebuttalRequest,
  type CreateExpenseRequest,
  type CreateVisitNoteRequest,
  type CreateWeddingNoteRequest,
  type DecisionListResponse,
  type ExpenseDetail,
  type ExpenseSummaryResponse,
  type UpdateExpenseRequest,
  type UpdateWeddingNoteRequest,
  type UpdateWeddingTaskRequest,
  type VisitNoteListResponse,
  type WeddingNoteListResponse,
  type WeddingTaskListResponse,
  type CreateWeddingEventRequest,
  type UpdateWeddingEventRequest,
  type WeddingEventListResponse,
  type Analysis,
  type ComparisonResponse,
  type AuthProvidersResponse,
  type CreateVerificationRequest,
  type CreateVerificationResponse,
  type ErrorCode,
  type CreateInquiryRequest,
  type RegisterDeviceRequest,
  type RegisterDeviceResponse,
  type RegisterPaymentProofRequest,
  type RegisterPaymentProofResponse,
  type OriginalKind,
  type CreateReviewReportRequest,
  type CreateReviewReportResponse,
  type CreateReviewRequest,
  type CreateReviewResponse,
  type ReportReasonListResponse,
  type ReviewForm,
  type ReviewListResponse,
  type CreateInquiryResponse,
  type InquiryListResponse,
  type PlannerDetail,
  type PlannerRegionsResponse,
  type PlannerSearchResponse,
  type Quote,
  type VendorComparisonResponse,
  type VendorDetail,
  type VendorRegionsResponse,
  type CreateInviteResponse,
  type InvitePreviewResponse,
  type VendorSearchResponse,
  type WeddingInviteListResponse,
  type VerificationRequest,
  createPriceReportResponseSchema,
  quoteListResponseSchema,
  type CreatePriceReportRequest,
  type CreatePriceReportResponse,
  type QuoteListResponse,
  withdrawalNoticeSchema,
  withdrawalResultSchema,
  type WithdrawalNotice,
  type WithdrawalResult,
  expoListResponseSchema,
  expoDetailSchema,
  weddingInfoListResponseSchema,
  weddingInfoDetailSchema,
  type ExpoListResponse,
  type ExpoDetail,
  type WeddingInfoListResponse,
  type WeddingInfoDetail,
  vendorPhotosResponseSchema,
  type VendorPhotosResponse,
  type CompleteSetupRequest,
  appBootstrapResponseSchema,
  type AppBootstrapResponse,
  type CurrentUser,
  myRewardPayoutResponseSchema,
  rewardPayoutSchema,
  type MyRewardPayoutResponse,
  type RequestRewardPayoutRequest,
  type RewardPayout,
} from '@weddingpick/api-contract';
import { z, type ZodType } from 'zod';

import type { BudgetBandKey, VendorCategory } from '@weddingpick/domain';

import { API_URL } from '@/api/config';
import { clearToken, loadToken, saveToken } from '@/api/session';
import { rememberCurrentUser } from '@/features/loading/current-user-snapshot';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    /**
     * 응답의 HTTP 상태. 서버에 닿지 못했으면 `null`이다.
     *
     * 전면 오류 화면이 «연결 안 됨»과 «점검 중»을 가르는 데 쓴다
     * (`features/errors/kind.ts`). 코드만으로는 둘이 같은 `internal`이라 갈리지
     * 않는다 — 그래서 지금까지 점검 화면을 띄울 방법이 없었다.
     */
    readonly status: number | null = null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function requireBaseUrl(): string {
  if (!API_URL) {
    throw new ApiError('internal', '서버 주소가 설정되지 않았습니다.');
  }

  return API_URL.replace(/\/$/, '');
}

/**
 * 한 요청을 얼마나 기다리는가.
 *
 * Render 무료 요금제는 잠들었다 깨는 데 30초 넘게 걸린다 — 그보다 짧게 잡으면
 * 첫 요청이 늘 실패한다. 그보다 훨씬 길면 사용자는 화면이 멈춘 줄 안다.
 */
const REQUEST_TIMEOUT_MS = 45_000;

const READ_FRESH_MS = 3_000;
const READ_TTL_MS = 30_000;
// 최신 응답을 현재 화면에 반영하는 업체 검색에서만 재방문 대기를 줄인다.
const OBSERVED_READ_TTL_MS = 120_000;
// 거래 상태가 아닌 선택지는 5분 동안 재사용한다.
const REFERENCE_TTL_MS = 5 * 60_000;
const REFERENCE_PATHS = new Set(['/v1/vendors/regions', '/v1/planners/regions', '/v1/review-report-reasons']);

/**
 * 캐시하지 않는 주소.
 *
 * 분석 진행 상황(`/v1/analyses/:id`)은 2초마다 다시 물어 «끝났는가»를 본다
 * (capture/analysis/[id].tsx). 캐시가 끼면 끝난 줄 모르고 계속 돈다. 서류 · 견적 ·
 * 확인 요청도 같은 흐름 위에 있어 함께 뺀다 — 이 화면들은 값이 바뀌기를 기다리는
 * 자리라 «방금 받은 답»이 오히려 틀린 답이다.
 */
const NEVER_CACHED = ['/v1/me/signup', '/v1/analyses/', '/v1/documents/', '/v1/quotes/', '/v1/verification-requests/'];

type ReadRefresh<T> = {
  force?: boolean;
  onValue: (value: T) => void;
  onError: (error: Error) => void;
  onRefreshing: (refreshing: boolean) => void;
};

type ReadEntry = { at: number; value: unknown };

/** 주소 → 마지막으로 받은 답. 앱이 살아 있는 동안만이고 기기에 남기지 않는다. */
const readCache = new Map<string, ReadEntry>();
/** 지금 서버에 가 있는 읽기. 같은 주소를 동시에 두 번 묻지 않게 하나로 합친다. */
const inFlightReads = new Map<string, Promise<unknown>>();

/**
 * 몇 번째 캐시인가. 버릴 때마다 하나 오른다.
 *
 * 버리는 순간 이미 서버에 가 있던 읽기가 있다. 그것이 돌아와 캐시에 적으면,
 * 방금 버린 이유(내가 무언가를 바꿨다)보다 **먼저 떠난 답**이 새 캐시로 앉는다 —
 * 바꾸기 전 목록이 다시 붙는 것이다. 떠날 때의 번호를 들고 갔다가 돌아와서
 * 달라졌으면 적지 않는다.
 */
let cacheGeneration = 0;
const pathGenerations = new Map<string, number>();
const matchesPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
function readGeneration(path: string): string {
  let version = 0;
  for (const [prefix, value] of pathGenerations) if (matchesPrefix(path, prefix)) version += value;
  return `${cacheGeneration}:${version}`;
}
let cacheToken: string | null | undefined;

/** 계정이 바뀌거나 영향 범위를 모르는 쓰기는 전체 캐시를 버린다. */
export function clearReadCache(): void {
  cacheGeneration += 1;
  pathGenerations.clear();
  readCache.clear();
  inFlightReads.clear();
  rememberCurrentUser(null);
}

/** 영향이 명확한 쓰기만 좁게 지운다. 새 API는 기본적으로 전체 무효화한다. */
function invalidateAfterWrite(path: string): void {
  const affected = path === '/v1/me/display-name'
    ? ['/v1/me', '/v1/app/bootstrap']
    : path.startsWith('/v1/me/notifications/')
      ? ['/v1/me/notifications', '/v1/app/bootstrap']
      : path === '/v1/devices' ? [] : null;
  if (affected === null) {
    clearReadCache();
    return;
  }
  for (const prefix of affected) pathGenerations.set(prefix, (pathGenerations.get(prefix) ?? 0) + 1);
  const matches = (key: string) => affected.some((prefix) => matchesPrefix(key, prefix));
  for (const key of readCache.keys()) if (matches(key)) readCache.delete(key);
  for (const key of inFlightReads.keys()) if (matches(key)) inFlightReads.delete(key);
  if (affected.includes('/v1/me')) rememberCurrentUser(null);
}

/** 이미 받아둔 답을 캐시에 넣어둔다. 같은 것을 다시 묻지 않게. */
function seedReadCache(path: string, value: unknown): void {
  readCache.set(path, { at: Date.now(), value });
}

function isCacheableRead(path: string, method: string): boolean {
  if (method !== 'GET') return false;

  return !NEVER_CACHED.some((prefix) => path.startsWith(prefix));
}

/**
 * 서버 응답을 계약 스키마로 검사한 뒤에 쓴다.
 *
 * 서버가 계약을 어기면 화면이 이상한 값을 그리기 전에 여기서 걸린다. 특히 가격은
 * 실 제보 건수·기준 기간과 한 덩어리로만 오게 돼 있어(사업계획서 9번), 중앙값만 담긴 응답은
 * 통과하지 못한다.
 */
async function send<T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const token = auth ? await loadToken() : null;
  const generation = readGeneration(path);

  /*
   * 서버에 닿지 못한 것과 서버가 거절한 것은 다르다. fetch가 던지는 것을 그대로
   * 흘려보내면 화면은 `ApiError`만 볼 줄 알아서 «서버 응답을 이해하지 못했습니다»
   * 같은 엉뚱한 말을 하게 된다. 닿지 못했으면 status를 null로 남겨 전면 오류 화면이
   * «연결이 불안정해요»로 읽게 한다.
   */
  let response: Response;
  try {
    response = await fetch(`${requireBaseUrl()}${path}`, {
      ...rest,
      /*
       * 답이 오지 않는 요청을 영원히 기다리지 않는다.
       *
       * **타임아웃이 없었다**(Release Audit 1차 P1-4). `AbortController`도
       * `AbortSignal`도 저장소 전체에 0건이라, 응답이 끊긴 요청은 무한 로딩으로
       * 남았고 사용자가 할 수 있는 일은 앱을 껐다 켜는 것뿐이었다.
       *
       * 끊긴 요청은 «닿지 못한 것»으로 다룬다 — 아래 catch가 status를 null로
       * 남기고, 전면 오류 화면이 「연결이 불안정해요」로 읽는다.
       *
       * 호출하는 쪽이 `signal`을 주면 그쪽이 이긴다(업로드 취소 등).
       */
      signal: rest.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        // 본문이 없는데 JSON이라고 말하면 서버가 빈 본문을 파싱하려다 막힌다.
        ...(rest.body !== undefined && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('internal', '서버와 연결하지 못했습니다.', null);
  }

  // 이전 계정의 응답은 새 토큰이나 화면을 건드리지 않는다.
  if (auth && token !== await loadToken()) {
    throw new ApiError('internal', '계정이 변경되어 요청을 다시 확인해야 합니다.', 401);
  }

  if (!response.ok) {
    const body = errorResponseSchema.safeParse(await response.json().catch(() => null));

    if (auth && token !== await loadToken()) {
      throw new ApiError('internal', '계정이 변경되어 요청을 다시 확인해야 합니다.', 401);
    }
    if (response.status === 403) {
      readCache.delete(path);
      inFlightReads.delete(path);
    }
    if (auth && (response.status === 401 || (body.success && body.data.error.code === 'unauthenticated'))) {
      await clearToken();
      clearReadCache();
    }
    if (body.success) {
      throw new ApiError(body.data.error.code, body.data.error.message, response.status);
    }

    throw new ApiError('internal', '서버와 통신하지 못했습니다.', response.status);
  }

  // 204는 본문이 없다. json()을 부르면 거기서 터진다.
  const parsed = schema.safeParse(response.status === 204 ? null : await response.json());

  if (auth && token !== await loadToken()) {
    throw new ApiError('internal', '계정이 변경되어 요청을 다시 확인해야 합니다.', 401);
  }

  if (!parsed.success) {
    throw new ApiError('internal', '서버 응답을 이해하지 못했습니다.');
  }

  if (generation === readGeneration(path)) {
    if (path === '/v1/me') rememberCurrentUser(parsed.data as CurrentUser);
    if (path === '/v1/app/bootstrap') {
      const boot = parsed.data as AppBootstrapResponse;
      if (boot.member) {
        rememberCurrentUser(boot.member);
        seedReadCache('/v1/me', boot.member);
      }
    }
  }
  return parsed.data;
}

/** 서버에 한 번만 가고, 받은 답을 캐시에 적어둔다. 같은 주소가 겹치면 하나로 합친다. */
function startRead<T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit & { auth?: boolean }
): Promise<T> {
  const existing = inFlightReads.get(path);

  if (existing) return existing as Promise<T>;

  const generation = readGeneration(path);
  const pending = send(path, schema, init).then((value) => {
    // 떠난 뒤에 캐시를 버린 일이 있으면 적지 않는다 — 옛 답이 새 캐시가 된다.
    if (generation === readGeneration(path) && inFlightReads.get(path) === pending) {
      readCache.set(path, { at: Date.now(), value });
    }

    return value;
  });

  inFlightReads.set(path, pending);
  // 실패도 «가 있는 중»에서 지운다. 붙잡아두면 다음 화면이 같은 실패를 물려받는다.
  void pending
    .catch(() => undefined)
    .finally(() => {
      // 그새 다시 떠난 요청이 있으면 그쪽 것을 지우지 않는다.
      if (inFlightReads.get(path) === pending) inFlightReads.delete(path);
    });

  return pending;
}

/**
 * 서버에 묻는다. 읽기는 캐시를 거치고, 쓰기는 거치지 않는다.
 *
 * **화면을 다시 열 때 처음부터 다시 받지 않는다.** 탭을 옮길 때마다 같은 주소를
 * 새로 물어서 화면이 비었다가 채워지던 것을(2026-09-09 감사: `/v1/me`만 한 번의
 * 둘러보기에서 62번) 캐시가 있는 동안에는 바로 그린다. 오래된 값을 그대로 두지는
 * 않는다 — `READ_FRESH_MS`를 넘긴 값은 화면에 즉시 주면서 뒤에서 다시 받아 고친다.
 *
 * **무언가를 바꾼 뒤에는 영향받는 캐시를 버린다.** 쓰기가 성공하든
 * 실패하든 지운다 — 실패한 줄 알았는데 서버에는 남는 경우가 있고, 그때 옛 목록을
 * 계속 보여주면 사람이 같은 일을 두 번 한다.
 */
async function request<T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit & { auth?: boolean } = {},
  refresh?: ReadRefresh<T>
): Promise<T> {
  const token = await loadToken();
  refresh?.onRefreshing(false);
  if (token !== cacheToken) {
    clearReadCache();
    cacheToken = token;
  }
  const method = (init.method ?? 'GET').toUpperCase();

  if (!isCacheableRead(path, method)) {
    try {
      return await send(path, schema, init);
    } finally {
      if (method !== 'GET') invalidateAfterWrite(path);
    }
  }

  const hit = readCache.get(path);
  const age = hit ? Date.now() - hit.at : Number.POSITIVE_INFINITY;

  const reference = REFERENCE_PATHS.has(path);
  const ttl = reference ? REFERENCE_TTL_MS : refresh ? OBSERVED_READ_TTL_MS : READ_TTL_MS;
  if (hit && age < ttl && !refresh?.force) {
    // 조금 지난 값은 화면에 바로 주고, 다음 화면이 새 값을 받도록 뒤에서 고쳐둔다.
    if (!reference && age >= READ_FRESH_MS) {
      const generation = readGeneration(path);
      refresh?.onRefreshing(true);
      void startRead(path, schema, init)
        .then((value) => { if (generation === readGeneration(path)) refresh?.onValue(value); })
        .catch(async (error: Error) => {
          const currentToken = await loadToken();
          const revoked = currentToken === null && error instanceof ApiError && error.status === 401;
          if ((currentToken === token && generation === readGeneration(path)) || revoked) refresh?.onError(error);
        })
        .finally(async () => {
          const currentToken = await loadToken();
          if (currentToken === token || currentToken === null) refresh?.onRefreshing(false);
        });
    }

    return hit.value as T;
  }

  refresh?.onRefreshing(true);
  try {
    return await startRead(path, schema, init);
  } finally {
    refresh?.onRefreshing(false);
  }
}

/** 서버가 켜둔 로그인 방법. 앱이 짐작하지 않는다. */
export async function listAuthProviders(): Promise<AuthProvidersResponse> {
  return request('/v1/auth/providers', authProvidersResponseSchema, { auth: false });
}

/**
 * 로그인 직후 어디로 갈지 세션 응답이 바로 알려준다(2026-09-08) — /v1/me/signup을
 * 다시 묻느라 로그인 화면에 머물지 않는다.
 */
export type SessionEntry = { activated: boolean; setupComplete: boolean };

export async function signIn(
  provider: 'apple' | 'google',
  idToken: string,
  profileName?: string,
  ageAcknowledged?: boolean
): Promise<SessionEntry> {
  const session = await request(
    '/v1/auth/sessions',
    createSessionResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({ provider, idToken, profileName, ageAcknowledged }),
      auth: false,
    }
  );

  await saveToken(session.token);
  // 로그인 전에 비로그인으로 받아둔 답은 이 사람의 것이 아니다.
  clearReadCache();

  return { activated: session.activated, setupComplete: session.setupComplete };
}

/** 네이버·카카오. 앱은 일회용 인가 코드만 넘기고 토큰 교환은 서버가 한다. */
export async function signInWithAuthorizationCode(input: {
  provider: 'naver' | 'kakao';
  authorizationCode: string;
  state: string;
  redirectUri: string;
  codeVerifier?: string;
  /**
   * 로그인 화면의 «만 14세 이상이에요» 확인. 서버는 **제공자가 연령대를 주지
   * 않았을 때만** 이 값을 본다 — 제공자가 미달로 판정한 사람을 이 값이 뒤집지
   * 못한다. 보내지 않으면 확인받지 못한 것으로 본다.
   */
  ageAcknowledged?: boolean;
}): Promise<SessionEntry> {
  const session = await request('/v1/auth/sessions', createSessionResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
    auth: false,
  });

  await saveToken(session.token);
  clearReadCache();

  return { activated: session.activated, setupComplete: session.setupComplete };
}

/** 로그아웃. 서버 세션을 지우고 기기의 토큰도 버린다. */
export async function signOut(): Promise<void> {
  try {
    await request('/v1/auth/sessions', z.null(), { method: 'DELETE' });
  } finally {
    // 서버를 못 불러도 기기의 토큰은 버린다. 남겨두면 로그아웃한 척만 한 것이 된다.
    await clearToken();
    clearReadCache();
    rememberCurrentUser(null);
  }
}

/**
 * 초기 설정 — 5개 질문(예식일 · 지역 · 준비 현황 · 예산 · 스타일)을 한 번에 보낸다
 * (핸드오프 v3.19~v3.22 · SPEC §13.6). 5/5 스타일은 `styleTags`(최소 1 · 최대 2)로
 * 같이 가고, MY «스타일 다시 고르기»도 예식일 · 지역을 그대로 돌려보내며 이 경로를 쓴다.
 *
 * 이름은 보내지 않는다 — 닉네임은 최초 필수입력에서 빠졌고 MY에서 정한다.
 *
 * **미정을 억지로 받지 않는다.** 예식일 · 지역은 null(«아직 정하지 않았어요»),
 * 준비 현황은 빈 배열(«아직 시작 전이에요»), 예산은 `unknown`(«아직 모르겠어요»).
 * 예산과 준비 현황은 키를 아예 안 보내면 서버가 건드리지 않는다 — 안 고른 것과
 * 모르겠다고 고른 것은 다른 상태다.
 */
export async function completeSetup(input: CompleteSetupRequest) {
  return request('/v1/me/setup', currentUserSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** 부를 이름. MY에서 정한다. null이면 안 부른다. */
export async function setDisplayName(displayName: string | null) {
  return request('/v1/me/display-name', displayNameResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export async function getCurrentUser() {
  return request('/v1/me', currentUserSchema);
}

/** 홈 데이터를 미리 받으면 인증 확인과 병렬로 준비할 수 있다. */
export async function getAppBootstrap(): Promise<AppBootstrapResponse> {
  return request('/v1/app/bootstrap', appBootstrapResponseSchema);
}

/**
 * 가입 상태. 통합정책 v3.13 §N.
 *
 * 로그인 직후 이걸 먼저 본다. 소셜 로그인 성공만으로는 가입이 끝나지 않아서,
 * `activated`가 false면 다른 경로는 전부 막혀 있다.
 */
export async function getSignupState() {
  return request('/v1/me/signup', signupStateSchema);
}

/**
 * 필수 동의로 가입을 마무리한다. 통합정책 v3.13 §3.5.
 *
 * **나이는 보내지 않는다**(2026-09-10). 만 14세 확인은 로그인이 이미 했고 결과는
 * 서버에 있다 — 예전에는 이 자리에 `ageVerified: true`를 늘 넣어 보냈고, 서버가
 * 그것으로 관문을 지켰다. 앱이 채우는 값은 관문이 될 수 없다.
 */
export async function completeSignup(input: { consents: string[] }) {
  return request('/v1/me/signup', signupStateSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createWedding() {
  return request('/v1/weddings', weddingDetailSchema, { method: 'POST', body: '{}' });
}

export async function getWedding(weddingId: string) {
  return request(`/v1/weddings/${weddingId}`, weddingDetailSchema);
}

/** 웨딩이 없으면 하나 만든다. 사용자에게 물어보지 않는다 — 제품 원칙 1. */
export async function ensureWedding(): Promise<string> {
  const me = await getCurrentUser();

  return me.weddingId ?? (await createWedding()).id;
}

export async function createUpload(input: {
  weddingId: string;
  /** 무엇을 찍은 것인가. 보관 기간이 이 값으로 갈린다 — 결제내역 24시간, 그 밖 30일. */
  kind?: OriginalKind;
  pages: { mimeType: string; sizeBytes: number }[];
}) {
  return request('/v1/documents/uploads', createUploadResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** 업로드가 끝났음을 알린다. 분석 작업이 만들어진다. */
export async function completeUpload(rawDocumentId: string, weddingId: string) {
  return request(`/v1/documents/${rawDocumentId}/complete`, completeUploadResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ weddingId }),
  });
}

export async function getAnalysis(analysisId: string): Promise<Analysis> {
  return request(`/v1/analyses/${analysisId}`, analysisSchema);
}

export async function getQuote(quoteId: string): Promise<Quote> {
  return request(`/v1/quotes/${quoteId}`, quoteSchema);
}

export async function confirmFields(
  quoteId: string,
  fields: { path: string }[]
): Promise<Quote> {
  return request(`/v1/quotes/${quoteId}/confirmations`, quoteSchema, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
}

export async function getComparison(quoteId: string): Promise<ComparisonResponse> {
  return request(`/v1/quotes/${quoteId}/comparison`, comparisonResponseSchema);
}

/**
 * A-13 인증 신청 접수.
 *
 * 응답에 'received' 말고는 들어올 수 없다 — 계약이 그렇게 되어 있다. 등급은 사람이
 * 증빙을 확인한 뒤에야 오른다 (서비스정책서 7번).
 */
export async function createVerificationRequest(
  quoteId: string,
  body: CreateVerificationRequest
): Promise<CreateVerificationResponse> {
  return request(`/v1/quotes/${quoteId}/verification-requests`, createVerificationResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getVerificationRequest(requestId: string): Promise<VerificationRequest> {
  return request(`/v1/verification-requests/${requestId}`, verificationRequestSchema);
}

export async function createPriceReport(
  body: CreatePriceReportRequest
): Promise<CreatePriceReportResponse> {
  return request('/v1/price-reports', createPriceReportResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listQuotes(
  weddingId: string,
  cursor?: string
): Promise<QuoteListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const qs = params.toString();
  return request(
    `/v1/weddings/${weddingId}/quotes${qs ? `?${qs}` : ''}`,
    quoteListResponseSchema
  );
}

/**
 * A-16 업체 검색.
 *
 * 빈 검색어는 보내지 않는다 — 서버가 조건 없이 전부 훑는다.
 */
export async function searchVendors(input: {
  q?: string;
  category?: VendorCategory;
  region?: string;
  cursor?: string;
  sort?: VendorSort;
  /** 예산 구간(WP-SRCH-005). 키는 `BUDGET_BANDS`가 정한다. */
  budget?: BudgetBandKey;
  /** 금액을 볼 수 있는 곳만(WP-SRCH-005 «실 제보가 있는 곳만»). 꺼져 있으면 안 보낸다. */
  onlyVerified?: boolean;
  /** 몇 곳까지 받을 것인가. 안 넘기면 서버 기본값(20). 수만 필요하면 1로 줄인다. */
  limit?: number;
}, refresh?: ReadRefresh<VendorSearchResponse>): Promise<VendorSearchResponse> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      query.set(key, String(value));
    }
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request(`/v1/vendors${suffix}`, vendorSearchResponseSchema, {}, refresh);
}

/**
 * 그 업종에 업체가 몇 곳인가. 목록은 안 쓴다.
 *
 * Pick 화면의 업종 줄이 꼬리에 수를 적으려고 업종마다 검색을 부르는데, 그동안은
 * 스무 곳을 전부 받아 `total` 하나만 쓰고 버렸다(2026-09-09 감사: 화면 한 번에
 * 열한 번). 한 곳만 달라고 하면 서버도 한 곳 몫만 셈한다 — `total`은 조건에
 * 맞는 전체 수라 줄여도 값이 달라지지 않는다.
 */
export async function countVendors(category: VendorCategory): Promise<number> {
  return (await searchVendors({ category, limit: 1 })).total;
}

/**
 * TOP3 추천. v3.10 §2.
 *
 * 지역은 넘길 수 있다 — 지연 로그인이라 로그인 전에도 홈이 뜨고, 그때 지역은
 * 기기에만 있다. 안 넘기면 서버가 로그인한 사람의 웨딩에서 읽는다.
 */
export async function getTop3(input: { region?: string; category?: VendorCategory } = {}) {
  const query = new URLSearchParams();

  if (input.region) query.set('region', input.region);
  if (input.category) query.set('category', input.category);

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request(`/v1/recommendations/top3${suffix}`, top3ResponseSchema);
}

export async function listVendorRegions(): Promise<VendorRegionsResponse> {
  return request('/v1/vendors/regions', vendorRegionsResponseSchema);
}

export async function getVendor(vendorId: string): Promise<VendorDetail> {
  return request(`/v1/vendors/${vendorId}`, vendorDetailSchema);
}

/**
 * WP-VEND-002 업체 이미지 전체보기. 승인된 이미지만 온다.
 *
 * 대표 이미지가 배열 맨 앞이다 — 화면이 따로 찾을 필요 없이 `photos[0]`을 쓸 수
 * 있다.
 */
export async function listVendorPhotos(vendorId: string): Promise<VendorPhotosResponse> {
  return request(`/v1/vendors/${vendorId}/images`, vendorPhotosResponseSchema);
}

/**
 * 조건이 비슷한 결제 사례. v2.0 D-1.
 *
 * 제보 금액 구간(`getVendor`)과 다른 자리다 — 그건 누구나 보고, 이것은 결제인증이
 * 여는 깊이다.
 */
export async function getVendorConditions(vendorId: string): Promise<ConditionStats> {
  return request(`/v1/vendors/${vendorId}/conditions`, conditionStatsSchema);
}

/** A-17 업체 비교. 단서는 결과와 한 응답으로 온다. */
export async function compareVendors(ids: string[]): Promise<VendorComparisonResponse> {
  return request(
    `/v1/vendors/compare?ids=${ids.map(encodeURIComponent).join(',')}`,
    vendorComparisonResponseSchema
  );
}

/* -------------------------------------------------------------------------- */
/* 웨딩일정 — 웨딩 스케줄 · 지출내역 · 방문노트                                */
/* -------------------------------------------------------------------------- */

/** 처음 부르면 서버가 기본 열넷을 깔아준다. */
export async function listWeddingTasks(weddingId: string): Promise<WeddingTaskListResponse> {
  return request(`/v1/weddings/${weddingId}/tasks`, weddingTaskListResponseSchema);
}

export async function addWeddingTask(
  weddingId: string,
  body: { label: string; dueDate?: string; vendorLabel?: string }
): Promise<{ taskId: string }> {
  return request(`/v1/weddings/${weddingId}/tasks`, z.object({ taskId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 보낸 칸만 고친다. `state: null`은 자동 판정으로 되돌린다는 뜻이다. */
export async function updateWeddingTask(
  weddingId: string,
  taskId: string,
  body: UpdateWeddingTaskRequest
): Promise<void> {
  await request(`/v1/weddings/${weddingId}/tasks/${taskId}`, z.object({ ok: z.boolean() }), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function removeWeddingTask(weddingId: string, taskId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/tasks/${taskId}`, z.null(), { method: 'DELETE' });
}

export async function getExpenses(weddingId: string): Promise<ExpenseSummaryResponse> {
  return request(`/v1/weddings/${weddingId}/expenses`, expenseSummaryResponseSchema);
}

export async function addExpense(
  weddingId: string,
  body: CreateExpenseRequest
): Promise<{ expenseId: string }> {
  return request(`/v1/weddings/${weddingId}/expenses`, z.object({ expenseId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 직접 입력한 항목만 지워진다. 결제인증에서 온 줄은 404다. */
export async function removeExpense(weddingId: string, expenseId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/expenses/${expenseId}`, z.null(), { method: 'DELETE' });
}

/** 지출 상세. WP-OUR-010. */
export async function getExpenseDetail(
  weddingId: string,
  expenseId: string
): Promise<ExpenseDetail> {
  return request(`/v1/weddings/${weddingId}/expenses/${expenseId}`, expenseDetailSchema);
}

/** 환불 상태만 고친다. 직접 입력한 항목만 — 결제인증에서 온 줄은 404다. */
export async function updateExpense(
  weddingId: string,
  expenseId: string,
  body: UpdateExpenseRequest
): Promise<void> {
  await request(`/v1/weddings/${weddingId}/expenses/${expenseId}`, z.object({ ok: z.boolean() }), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function setBudget(weddingId: string, budget: number | null): Promise<void> {
  await request(`/v1/weddings/${weddingId}/budget`, z.object({ budget: z.number().nullable() }), {
    method: 'PUT',
    body: JSON.stringify({ budget }),
  });
}

export async function listVisitNotes(weddingId: string): Promise<VisitNoteListResponse> {
  return request(`/v1/weddings/${weddingId}/visit-notes`, visitNoteListResponseSchema);
}

export async function addVisitNote(
  weddingId: string,
  body: CreateVisitNoteRequest
): Promise<{ noteId: string }> {
  return request(`/v1/weddings/${weddingId}/visit-notes`, z.object({ noteId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function removeVisitNote(weddingId: string, noteId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/visit-notes/${noteId}`, z.null(), { method: 'DELETE' });
}

/** 웨딩 스케줄(체크리스트)과 다른 개념이다 — 일시·장소가 있는 캘린더 이벤트. */
export async function listWeddingEvents(weddingId: string): Promise<WeddingEventListResponse> {
  return request(`/v1/weddings/${weddingId}/events`, weddingEventListResponseSchema);
}

export async function addWeddingEvent(
  weddingId: string,
  body: CreateWeddingEventRequest
): Promise<{ eventId: string }> {
  return request(`/v1/weddings/${weddingId}/events`, z.object({ eventId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 보낸 칸만 고친다. */
export async function updateWeddingEvent(
  weddingId: string,
  eventId: string,
  body: UpdateWeddingEventRequest
): Promise<void> {
  await request(`/v1/weddings/${weddingId}/events/${eventId}`, z.object({ ok: z.boolean() }), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function removeWeddingEvent(weddingId: string, eventId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/events/${eventId}`, z.null(), { method: 'DELETE' });
}

/**
 * 담아둔 업체.
 *
 * 사람이 아니라 웨딩에 매달려 있다 — 배우자가 담은 곳이 함께 온다.
 */
export async function listCandidates(weddingId: string): Promise<CandidateListResponse> {
  return request(`/v1/weddings/${weddingId}/candidates`, candidateListResponseSchema);
}

export async function addCandidate(
  weddingId: string,
  vendorId: string,
  note?: string
): Promise<{ candidateId: string }> {
  return request(`/v1/weddings/${weddingId}/candidates`, z.object({ candidateId: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ vendorId, ...(note ? { note } : {}) }),
  });
}

/** 빼기. 배우자가 담은 것도 뺄 수 있다 — 함께 고르는 것이라서. */
export async function removeCandidate(weddingId: string, candidateId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/candidates/${candidateId}`, z.null(), {
    method: 'DELETE',
  });
}

/** 결정한 업체. WP-OUR-003. 업종별 결정정보 · 관련 일정 · 관련 지출을 묶어 준다. */
export async function listDecisions(weddingId: string): Promise<DecisionListResponse> {
  return request(`/v1/weddings/${weddingId}/decisions`, decisionListResponseSchema);
}

/** 웨딩일정 — 메모. WP-OUR-011. 업체별 또는 자유 메모. */
export async function listWeddingNotes(weddingId: string): Promise<WeddingNoteListResponse> {
  return request(`/v1/weddings/${weddingId}/notes`, weddingNoteListResponseSchema);
}

export async function addWeddingNote(
  weddingId: string,
  body: CreateWeddingNoteRequest
): Promise<{ noteId: string }> {
  return request(`/v1/weddings/${weddingId}/notes`, z.object({ noteId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * 고치기. `version`이 배우자가 먼저 고친 뒤의 값과 다르면 서버가 conflict(409)를
 * 돌려준다 — 부르는 화면이 `ApiError`의 `code === 'conflict'`를 잡아 충돌 화면으로
 * 보낸다.
 */
export async function updateWeddingNote(
  weddingId: string,
  noteId: string,
  body: UpdateWeddingNoteRequest
): Promise<void> {
  await request(`/v1/weddings/${weddingId}/notes/${noteId}`, z.object({ ok: z.boolean() }), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function removeWeddingNote(weddingId: string, noteId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/notes/${noteId}`, z.null(), { method: 'DELETE' });
}

/**
 * 결제인증 등록 — **사진 한 장.**
 *
 * 올린 원본 하나만 보낸다(v3.24). 금액·업체·날짜를 보낼 자리가 요청 타입에 없어
 * 화면이 지어낸 값을 넣을 수 없고, 못 읽은 제보는 접수는 되되 검수를 기다린다.
 *
 * 심사가 아니라 등록이다 — 사람이 등급을 올리지 않는다. 카드번호를 보낼 자리도 없다.
 */
export async function registerPaymentProof(
  body: RegisterPaymentProofRequest
): Promise<RegisterPaymentProofResponse> {
  return request('/v1/payment-proofs', registerPaymentProofResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * 내가 낸 결제인증과, 그것으로 열린 것.
 *
 * **가격을 여는 값이 아니다.** v2.0 K-6이 그 잠금을 폐기했다 — 제보 금액 구간은
 * 누구나 본다. 여기서 열리는 것은 조건이 비슷한 사례다.
 */
export async function getDataUnlock() {
  return request(
    '/v1/me/data-unlock',
    z.object({
      deepData: z.boolean(),
      paymentProofCount: z.number(),
      retentionHours: z.number(),
    })
  );
}

/**
 * 후기 쓰기 화면에 필요한 것.
 *
 * 물어볼 항목을 앱이 정하지 않는다. 업종마다 다르고 역할마다 다르며, 그 규칙은
 * 서버에 있다 — 앱에 박아두면 항목이 늘 때마다 앱을 새로 내야 한다.
 */
export async function getReviewForm(vendorId: string): Promise<ReviewForm> {
  return request(`/v1/vendors/${vendorId}/review-form`, reviewFormSchema);
}

/** 후기 쓰기. 확인 단계는 보내지 않는다 — 서버가 정한다. */
export async function createReview(
  vendorId: string,
  body: CreateReviewRequest
): Promise<CreateReviewResponse> {
  return request(`/v1/vendors/${vendorId}/reviews`, createReviewResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 업체의 후기와 이용점수. 단서는 목록과 한 응답으로 온다. */
/**
 * 후기 고치기. 자기 글만.
 *
 * 규칙이 위험정보를 찾아 가린 글은 고치면 되살아난다 — 그래야 "지우고 다시
 * 올려주세요"가 지킬 수 있는 말이 된다.
 */
export async function updateReview(
  reviewId: string,
  body: UpdateReviewRequest
): Promise<void> {
  await request(`/v1/reviews/${reviewId}`, z.null(), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** 후기 삭제. 한 사람이 한 업체에 하나라, 지울 수 없으면 다시 쓸 수도 없다. */
export async function deleteReview(reviewId: string): Promise<void> {
  await request(`/v1/reviews/${reviewId}`, z.null(), { method: 'DELETE' });
}

export async function listVendorReviews(
  vendorId: string,
  cursor?: string
): Promise<ReviewListResponse> {
  const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

  return request(`/v1/vendors/${vendorId}/reviews${suffix}`, reviewListResponseSchema);
}

export async function listReportReasons(): Promise<ReportReasonListResponse> {
  return request('/v1/review-report-reasons', reportReasonListResponseSchema);
}

/** 후기 신고. 접수만 된다 — 내릴지는 사람이 정한다. */
export async function reportReview(
  reviewId: string,
  body: CreateReviewReportRequest
): Promise<CreateReviewReportResponse> {
  return request(`/v1/reviews/${reviewId}/reports`, createReviewReportResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * A-16 플래너 검색.
 *
 * 공개 근거가 있는 플래너만 내려온다. 조건은 서버의 뷰 안에 있어 앱이 걸러줄 것이 없다.
 */
export async function searchPlanners(input: {
  q?: string;
  region?: string;
  cursor?: string;
}): Promise<PlannerSearchResponse> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      query.set(key, value);
    }
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request(`/v1/planners${suffix}`, plannerSearchResponseSchema);
}

export async function listPlannerRegions(): Promise<PlannerRegionsResponse> {
  return request('/v1/planners/regions', plannerRegionsResponseSchema);
}

export async function getPlanner(plannerId: string): Promise<PlannerDetail> {
  return request(`/v1/planners/${plannerId}`, plannerDetailSchema);
}

/**
 * 문의 접수.
 *
 * 응답에 'received' 말고는 들어올 수 없다 — 계약이 그렇게 되어 있다. 결론은 사람이
 * 낸다 (서비스정책서 6번).
 */
export async function createInquiry(
  body: CreateInquiryRequest
): Promise<CreateInquiryResponse> {
  return request('/v1/inquiries', createInquiryResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listMyInquiries(): Promise<InquiryListResponse> {
  return request('/v1/inquiries', inquiryListResponseSchema);
}

/** A-18 배우자 초대. 코드는 이 응답에서 한 번만 내려온다 — 서버가 다시 보여줄 수 없다. */
export async function createWeddingInvite(weddingId: string): Promise<CreateInviteResponse> {
  return request(`/v1/weddings/${weddingId}/invites`, createInviteResponseSchema, {
    method: 'POST',
  });
}

export async function getWeddingInvite(weddingId: string): Promise<WeddingInviteListResponse> {
  return request(`/v1/weddings/${weddingId}/invites`, weddingInviteListResponseSchema);
}

export async function revokeWeddingInvite(weddingId: string, inviteId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/invites/${inviteId}`, z.null(), { method: 'DELETE' });
}

/** 받아들이기 전에 무엇에 동의하는지 본다. */
export async function previewWeddingInvite(code: string): Promise<InvitePreviewResponse> {
  return request('/v1/wedding-invites/preview', invitePreviewResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function acceptWeddingInvite(code: string): Promise<{ weddingId: string }> {
  return request('/v1/wedding-invites/accept', z.object({ weddingId: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** 연결 끊기. 어느 쪽이든 할 수 있다. */
export async function unlinkPartner(weddingId: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/partner`, z.null(), { method: 'DELETE' });
}

/**
 * 푸시 받을 기기를 등록한다.
 *
 * 등록한다고 알림을 받게 되는 것은 아니다 — 파기 알림은 운영자에게만 가고,
 * 운영자인지는 서버가 판단한다. 앱은 자기가 운영자인지 알 필요가 없고,
 * 알려고 하지도 않는다.
 */
export async function registerDevice(
  body: RegisterDeviceRequest
): Promise<RegisterDeviceResponse> {
  return request('/v1/devices', registerDeviceResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/*
 * ---------------------------------------------------------------------------
 * 알림 · 내 제보 내역 · 업체 반론 (디자인 핸드오프 20번)
 * ---------------------------------------------------------------------------
 */

export async function listNotifications(): Promise<NotificationListResponse> {
  return request('/v1/me/notifications', notificationListResponseSchema);
}

/** 홈의 벨. 목록 전체를 받지 않고 개수만 묻는다. */
export async function getNotificationSummary(): Promise<NotificationSummaryResponse> {
  return request('/v1/me/notifications/summary', notificationSummaryResponseSchema);
}

export async function readNotification(
  notificationId: string
): Promise<NotificationSummaryResponse> {
  return request(
    `/v1/me/notifications/${notificationId}/read`,
    notificationSummaryResponseSchema,
    { method: 'POST' }
  );
}

export async function readAllNotifications(): Promise<NotificationSummaryResponse> {
  return request('/v1/me/notifications/read-all', notificationSummaryResponseSchema, {
    method: 'POST',
  });
}

/** 내가 낸 자료. 결제인증·가격제보·후기가 종류를 달고 한 목록에 선다. */
export async function listMyReports(): Promise<MyReportListResponse> {
  return request('/v1/me/reports', myReportListResponseSchema);
}

/**
 * 업체 반론 등록.
 *
 * **여기서 게시되지 않는다.** 사람이 확인한 뒤에 후기 옆에 붙는다 — 요청 타입에
 * 상태를 정할 자리가 없는 것이 그 사실을 말해준다.
 */
export async function createRebuttal(body: CreateRebuttalRequest): Promise<{ rebuttalId: string }> {
  return request('/v1/rebuttals', z.object({ rebuttalId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listMyRebuttals(): Promise<RebuttalListResponse> {
  return request('/v1/me/rebuttals', rebuttalListResponseSchema);
}

export async function updateRebuttal(
  rebuttalId: string,
  body: UpdateRebuttalRequest
): Promise<void> {
  await request(`/v1/rebuttals/${rebuttalId}`, z.null(), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function removeRebuttal(rebuttalId: string): Promise<void> {
  await request(`/v1/rebuttals/${rebuttalId}`, z.null(), { method: 'DELETE' });
}

/*
 * ---------------------------------------------------------------------------
 * 업체 관계자 인증 (최종통합정책 v2.0 26·27번)
 * ---------------------------------------------------------------------------
 */

/**
 * 업체 관계자 인증 신청.
 *
 * **여기서 확인되지 않는다.** 이메일 도메인이 맞아떨어져도 담당자가 그 주소로
 * 연락해 확인한 뒤에야 관계자가 된다 — 요청 타입에 상태를 정할 자리가 없는 것이
 * 그 사실을 말해준다.
 */
export async function createVendorClaim(
  body: CreateVendorClaimRequest
): Promise<{ claimId: string }> {
  return request('/v1/vendor-claims', z.object({ claimId: z.string() }), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listMyVendorClaims(): Promise<VendorClaimListResponse> {
  return request('/v1/me/vendor-claims', vendorClaimListResponseSchema);
}

/*
 * ---------------------------------------------------------------------------
 * 이벤트 보상 (최종통합정책 v2.0 I장)
 * ---------------------------------------------------------------------------
 */

/**
 * 최종 결정. v3.2 §6.
 *
 * Pick한 곳 중에서만 정할 수 있다. 다시 부르면 그 업종의 결정이 바뀐다 —
 * 마음이 바뀌는 일이라 되돌릴 수 없게 두지 않는다.
 */
export async function decideCategory(
  weddingId: string,
  body: DecideCategoryRequest
): Promise<void> {
  await request(`/v1/weddings/${weddingId}/decisions`, z.null(), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * 비교했다는 사실을 남긴다. 미션 ③이 이 기록을 본다.
 *
 * 실패해도 부르는 쪽을 막지 않는다 — 미션 체크 하나 때문에 비교 화면이 오류로
 * 바뀌면 잃는 것이 더 크다.
 */
export async function recordComparison(weddingId: string, category: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/comparisons`, z.null(), {
    method: 'POST',
    body: JSON.stringify({ category }),
  });
}

export async function removeDecision(weddingId: string, category: string): Promise<void> {
  await request(`/v1/weddings/${weddingId}/decisions/${category}`, z.null(), { method: 'DELETE' });
}

export async function getMyRewards(): Promise<MyRewardsResponse> {
  return request('/v1/me/rewards', myRewardsResponseSchema);
}

export async function getMyMonthlyDraw(): Promise<MyMonthlyDrawResponse> {
  return request('/v1/me/monthly-draw', myMonthlyDrawResponseSchema);
}

/** Npay 리워드 수령 현황(WP-EVT-006). 번호는 가린 꼴만 온다. */
export async function getMyRewardPayout(): Promise<MyRewardPayoutResponse> {
  return request('/v1/me/rewards/payout', myRewardPayoutResponseSchema);
}

/** 수령 요청 — 그 순간 지급 대기인 보상 전부가 한 요청으로 묶인다. */
export async function requestRewardPayout(body: RequestRewardPayoutRequest): Promise<RewardPayout> {
  return request('/v1/me/rewards/payout', rewardPayoutSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * 초대 코드 넣기.
 *
 * **여기서 보상이 생기지 않는다.** 결제내역을 처음 등록할 때 초대한 분의 조건이
 * 찬다 — 가입만으로 돈을 주면 가입만 하는 계정이 모인다(v2.0 K-7).
 */
export async function redeemReferral(code: string): Promise<void> {
  await request('/v1/referrals/redeem', z.null(), {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

// ──────────────────────────────────────────────────────────
// 박람회 (Expos)
// ──────────────────────────────────────────────────────────

export async function listExpos(params?: {
  sort?: 'date' | 'region';
  region?: string;
  cursor?: string;
}): Promise<ExpoListResponse> {
  const q = new URLSearchParams();
  if (params?.sort) q.set('sort', params.sort);
  if (params?.region && params.region !== '전체') q.set('region', params.region);
  if (params?.cursor) q.set('cursor', params.cursor);
  const suffix = q.size > 0 ? `?${q.toString()}` : '';
  return request(`/v1/expos${suffix}`, expoListResponseSchema);
}

export async function getExpo(expoId: string): Promise<ExpoDetail> {
  return request(`/v1/expos/${expoId}`, expoDetailSchema);
}

export async function toggleExpoNotify(expoId: string, enabled: boolean): Promise<void> {
  await request(`/v1/expos/${expoId}/notify`, z.null(), {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

// ──────────────────────────────────────────────────────────
// 웨딩 정보 (Wedding Info)
// ──────────────────────────────────────────────────────────

export async function listWeddingInfo(params?: {
  sort?: string;
  stage?: string;
  category?: string;
  cursor?: string;
}): Promise<WeddingInfoListResponse> {
  const q = new URLSearchParams();
  if (params?.sort) q.set('sort', params.sort);
  if (params?.stage) q.set('stage', params.stage);
  if (params?.category) q.set('category', params.category);
  if (params?.cursor) q.set('cursor', params.cursor);
  const suffix = q.size > 0 ? `?${q.toString()}` : '';
  return request(`/v1/wedding-info${suffix}`, weddingInfoListResponseSchema);
}

export async function getWeddingInfo(infoId: string): Promise<WeddingInfoDetail> {
  return request(`/v1/wedding-info/${infoId}`, weddingInfoDetailSchema);
}

export async function submitPromotion(url: string): Promise<{ promotionId: string }> {
  return request('/v1/promotions', z.object({ promotionId: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/** 내 초대 코드와 사용 횟수. */
export async function getMyInviteCode(): Promise<{ code: string; uses: number }> {
  return request('/v1/me/invite-code', z.object({ code: z.string(), uses: z.number() }));
}

/** 지도용 — 좌표가 있는 Pick 업체 목록. */
export async function getMapVendors(weddingId: string): Promise<{
  vendors: {
    vendorId: string;
    vendorName: string;
    category: string;
    lat: number;
    lng: number;
    address: string;
    picked: boolean;
  }[];
}> {
  return request(
    `/v1/weddings/${weddingId}/map-vendors`,
    z.object({
      vendors: z.array(
        z.object({
          vendorId: z.string(),
          vendorName: z.string(),
          category: z.string(),
          lat: z.number(),
          lng: z.number(),
          address: z.string(),
          picked: z.boolean(),
        })
      ),
    })
  );
}

/** 제외한 후보 목록. 카테고리별로 묶여 온다. */
export async function getRemovedCandidates(weddingId: string): Promise<{
  groups: {
    category: string;
    categoryLabel: string;
    items: { id: string; vendorName: string; removedAt: string }[];
  }[];
}> {
  return request(
    `/v1/weddings/${weddingId}/candidates/removed`,
    z.object({
      groups: z.array(
        z.object({
          category: z.string(),
          categoryLabel: z.string(),
          items: z.array(
            z.object({ id: z.string(), vendorName: z.string(), removedAt: z.string() })
          ),
        })
      ),
    })
  );
}

/*
 * ---------------------------------------------------------------------------
 * 설정 (디자인 핸드오프 19번)
 * ---------------------------------------------------------------------------
 */

export async function getSettings(): Promise<Settings> {
  return request('/v1/me/settings', settingsSchema);
}

export async function updateSettings(body: UpdateSettingsRequest): Promise<Settings> {
  return request('/v1/me/settings', settingsSchema, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * 취향. 홈 C-1 시안 1 · 온보딩 5/5. 한 업종의 세트만 저장돼 있다 — 아직 안
 * 골랐으면 `category`가 null이고 `keys`는 빈 배열이다.
 */
export async function getTaste(): Promise<TasteListResponse> {
  return request('/v1/me/taste', tasteListResponseSchema);
}

/**
 * 고른 전체를 그대로 보낸다 — "추가"가 아니라 "지금 고른 전체"다. 업종과 그 업종
 * 세트의 키만 받는다(최소 1장).
 */
export async function updateTaste(input: UpdateTasteRequest): Promise<TasteListResponse> {
  return request('/v1/me/taste', tasteListResponseSchema, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/** 탈퇴하면 무엇이 어떻게 되는지. 화면이 개수를 짐작하지 않는다. */
export async function getWithdrawalNotice(): Promise<WithdrawalNotice> {
  return request('/v1/me/withdrawal', withdrawalNoticeSchema);
}

/** 탈퇴. 되돌릴 수 없어서 화면이 시트로 한 번 더 묻고 부른다. */
export async function withdraw(): Promise<WithdrawalResult> {
  return request('/v1/me/withdrawal', withdrawalResultSchema, { method: 'POST' });
}

/** 결제인증 동의. 최초 1회만 — 두 번 눌러도 한 번만 남는다. */
export async function grantPaymentConsent(): Promise<Settings> {
  return request('/v1/me/payment-consent', settingsSchema, { method: 'POST' });
}

export async function revokePaymentConsent(): Promise<Settings> {
  return request('/v1/me/payment-consent', settingsSchema, { method: 'DELETE' });
}

/** 견적서 업로드 동의. 결제인증과 따로 받는다 — 읽어가는 것도 쓰는 곳도 다르다. */
export async function grantDocumentConsent(): Promise<Settings> {
  return request('/v1/me/document-consent', settingsSchema, { method: 'POST' });
}

export async function revokeDocumentConsent(): Promise<Settings> {
  return request('/v1/me/document-consent', settingsSchema, { method: 'DELETE' });
}

// ──────────────────────────────────────────────────────────────────────────────
// 타입 재내보내기 — 화면이 @weddingpick/api-contract 직접 의존 없이 쓸 수 있다.
// ──────────────────────────────────────────────────────────────────────────────
export type { ExpoItem, ExpoStatus, ExpoDetail } from '@weddingpick/api-contract';
export type { WeddingInfoListResponse, WeddingInfoDetail } from '@weddingpick/api-contract';
export type { BudgetBracket } from '@weddingpick/api-contract';

