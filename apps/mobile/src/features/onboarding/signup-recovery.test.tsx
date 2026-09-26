import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import SetupScreen from '@/app/setup';
import { ApiError, completeSetup, completeSignup, getAppBootstrap, getCurrentUser, getSignupState } from '@/api/client';
import { endHomeHandoff, isHomeHandoffActive } from '@/features/home/home-handoff';
import { clearSignupPending, hasFreshSignupPending } from '@/features/auth/sign-in-handoff';
import { loadToken } from '@/api/session';
import { clearOnboardingAnswers, clearWeddingDraft, loadOnboardingAnswers, saveOnboardingAnswers, saveWeddingDraft } from './wedding-draft';
import type { Answers } from './flow';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/api/config', () => ({ isServerConfigured: true }));
jest.mock('@/api/session', () => ({ loadToken: jest.fn() }));
jest.mock('@/api/client', () => ({
  ApiError: class extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
  },
  completeSetup: jest.fn(), completeSignup: jest.fn(), getAppBootstrap: jest.fn(), getCurrentUser: jest.fn(), getSignupState: jest.fn(),
}));
jest.mock('./wedding-draft', () => ({
  clearOnboardingAnswers: jest.fn(), clearWeddingDraft: jest.fn(), loadOnboardingAnswers: jest.fn(),
  saveOnboardingAnswers: jest.fn(), saveWeddingDraft: jest.fn(),
}));
jest.mock('@/features/home/home-skeleton', () => ({ HomeSkeleton: 'HomeSkeleton' }));
jest.mock('./budget-amount', () => ({ BudgetAmount: 'BudgetAmount' }));
jest.mock('./date-picker-sheet', () => ({ OnboardingDatePickerSheet: 'OnboardingDatePickerSheet' }));
jest.mock('./option-row', () => ({ OptionRow: 'OptionRow' }));
jest.mock('./question-head', () => ({ QuestionHead: 'QuestionHead' }));
jest.mock('./region-picker-sheet', () => ({ RegionPickerSheet: 'RegionPickerSheet' }));
jest.mock('./step-frame', () => ({ StepFrame: 'StepFrame' }));
/* 로그인 · 온보딩 사이의 원형 고리 화면(2026-09-26) — 이 시험은 화면 흐름만 본다. */
jest.mock('@/features/auth/signing-in-view', () => ({ SigningInView: 'SigningInView', SigningInOverlay: () => null }));
jest.mock('@/features/loading/auth-progress', () => ({ beginAuthProgress: jest.fn() }));
jest.mock('@weddingpick/ui', () => ({
  Border: { selected: 1.5 },
  CanonGray: {},
  ErrorView: 'ErrorView',
  FontSize: { dateWheel: 17 },
  Layout: {},
  LineHeight: {},
  ProductSymbol: 'ProductSymbol',
  Radius: {},
  Spacing: {},
  ThemedText: 'ThemedText',
  ThemedView: 'ThemedView',
  useTheme: () => ({}),
}));

const answers: Answers = {
  date: { value: null }, region: { region: null, district: null },
  prep: { categories: [] }, budget: { amount: null }, style: ['URBAN'],
};
const pendingSignup = { activated: false } as Awaited<ReturnType<typeof getSignupState>>;
const activeSignup = { activated: true } as Awaited<ReturnType<typeof getSignupState>>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
let tree: ReactTestRenderer;
async function mount() {
  await act(async () => { tree = create(<SetupScreen />); });
  expect(frame().props.stepKey).toBe('style');
}
function frame() {
  return tree.root.findByType('StepFrame' as never);
}
/**
 * 3/3에서 «다음». 2026-09-11 대표 지시 이후 이 누름은 **결과 화면으로 갈 뿐이고
 * 서버에 아무것도 보내지 않는다** — 저장은 결과 화면의 «완료»가 시작한다.
 */
async function toResult() {
  /*
   * 마운트할 때 스타일 복원이 가입 상태를 한 번 읽는다(그 자체는 이 오더와 무관).
   * 여기서 보는 것은 «다음»이 그 위에 왕복을 **더 얹지 않는가**다.
   */
  const before = jest.mocked(getSignupState).mock.calls.length;

  await act(async () => { frame().props.onNext(); });

  expect(frame().props.stepKey).toBe('done');
  expect(jest.mocked(getSignupState).mock.calls.length).toBe(before);
  expect(completeSignup).not.toHaveBeenCalled();
  expect(completeSetup).not.toHaveBeenCalled();
  expect(saveWeddingDraft).not.toHaveBeenCalled();
}
/** 결과 화면의 «완료». 가입 확인 → 가입 → 초기 설정은 여기서 일어난다. */
async function finish() {
  await toResult();
  await act(async () => { frame().props.onNext(); });
}
beforeEach(() => {
  jest.mocked(loadToken).mockResolvedValue('session-token');
  jest.mocked(loadOnboardingAnswers).mockResolvedValue(answers);
  for (const save of [clearOnboardingAnswers, clearWeddingDraft, saveOnboardingAnswers, saveWeddingDraft]) {
    jest.mocked(save).mockResolvedValue(undefined);
  }
  jest.mocked(getSignupState).mockResolvedValue(pendingSignup);
  jest.mocked(getCurrentUser).mockResolvedValue({ styleTags: [] } as never);
  jest.mocked(completeSignup).mockResolvedValue(activeSignup);
  jest.mocked(completeSetup).mockResolvedValue({} as never);
  jest.mocked(getAppBootstrap).mockResolvedValue({} as never);
  endHomeHandoff();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

/*
 * 2026-09-26 대표 결정 「강제한다」 — 필수 다섯이 모두 가입 관문이다. 초기 설정은 가입 전
 * 계정의 동의를 사용자 대신 보내지 않는다(전에는 terms · privacy를 대신 보냈다). 약관
 * 동의로 보내고, 적어 둔 답은 지우지 않는다.
 */
it('완료 시 가입 상태를 다시 읽어 가입 전이면 동의를 대신 보내지 않고 약관 동의로 보낸다', async () => {
  jest.useFakeTimers();
  try {
    clearSignupPending();
    const first = deferred<Awaited<ReturnType<typeof getSignupState>>>();
    jest.mocked(getSignupState).mockReturnValueOnce(first.promise).mockResolvedValue(pendingSignup);
    await mount();
    await finish();
    expect(getSignupState).toHaveBeenCalledTimes(2);
    expect(completeSignup).not.toHaveBeenCalled();
    expect(completeSetup).not.toHaveBeenCalled();
    expect(clearOnboardingAnswers).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/login/consent');
    /* 약관 동의가 로더 없이 폼부터 서게 깃발을 넘긴다. 골격은 걷었다. */
    expect(hasFreshSignupPending()).toBe(true);
    expect(isHomeHandoffActive()).toBe(false);
    await act(async () => first.resolve(pendingSignup));
    clearSignupPending();
  } finally {
    jest.useRealTimers();
  }
});

it('첫 조회가 실패했어도 완료 시 가입 상태를 다시 읽어 가입 전이면 약관 동의로 보낸다', async () => {
  jest.mocked(getSignupState).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(pendingSignup);
  await mount();
  await finish();
  expect(getSignupState).toHaveBeenCalledTimes(2);
  expect(completeSignup).not.toHaveBeenCalled();
  expect(completeSetup).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/login/consent');
  clearSignupPending();
});

it('완료 시 가입 상태 조회가 500이면 초기 설정을 보내지 않고 답과 오류를 남긴다', async () => {
  jest.mocked(getSignupState).mockResolvedValueOnce(activeSignup)
    .mockRejectedValue(new ApiError('internal', '가입 상태를 확인하지 못했어요', 500));
  await mount();
  await finish();
  expect(completeSignup).not.toHaveBeenCalled();
  expect(completeSetup).not.toHaveBeenCalled();
  expect(clearOnboardingAnswers).not.toHaveBeenCalled();
  expect(frame().props.error).toBe('가입 상태를 확인하지 못했어요');
  /* 답은 그대로 두고 결과 화면에 머문다 — "완료"를 다시 누르면 그 자리에서 재시도한다. */
  expect(frame().props.stepKey).toBe('done');
});

it('이미 활성화된 계정은 가입 동의를 다시 저장하지 않고 초기 설정만 저장한다', async () => {
  jest.mocked(getSignupState).mockResolvedValue(activeSignup);
  await mount();
  await finish();
  expect(getSignupState).toHaveBeenCalledTimes(2);
  expect(completeSignup).not.toHaveBeenCalled();
  expect(completeSetup).toHaveBeenCalledTimes(1);
});

it('초기 설정 저장 중 뿌리의 홈 골격을 켜고, 저장 직후 홈 자료를 먼저 띄운 뒤 홈으로 이동한다', async () => {
  const pending = deferred<Awaited<ReturnType<typeof completeSetup>>>();
  jest.mocked(getSignupState).mockResolvedValue(activeSignup);
  jest.mocked(completeSetup).mockReturnValue(pending.promise);
  await mount();
  await finish();
  /* 설정 화면은 제 골격을 그리지 않는다 — 뿌리(HomeHandoffHost)가 한 장을 들고 있다. */
  expect(tree.root.findAllByType('HomeSkeleton' as never)).toHaveLength(0);
  expect(isHomeHandoffActive()).toBe(true);
  expect(router.replace).not.toHaveBeenCalledWith('/');
  expect(getAppBootstrap).not.toHaveBeenCalled();
  await act(async () => pending.resolve({} as never));
  expect(getAppBootstrap).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/');
  /* 골격은 홈이 첫 자료를 그릴 때 걷는다 — 여기서 걷으면 홈이 골격을 한 번 더 세운다. */
  expect(isHomeHandoffActive()).toBe(true);
});

it('저장이 실패하면 홈 골격을 걷고 요약에 오류를 남긴다', async () => {
  jest.mocked(getSignupState).mockResolvedValue(activeSignup);
  jest.mocked(completeSetup).mockRejectedValue(new Error('저장하지 못했어요'));
  await mount();
  await finish();
  expect(isHomeHandoffActive()).toBe(false);
  expect(frame().props.error).toBe('저장하지 못했어요');
  expect(frame().props.stepKey).toBe('done');
});

it('세션이 끝나 로그인으로 돌려보낼 때도 홈 골격을 걷는다', async () => {
  jest.mocked(getSignupState).mockResolvedValue(activeSignup);
  jest.mocked(completeSetup).mockRejectedValue(new ApiError('unauthenticated', '로그인이 필요합니다.', 401));
  await mount();
  await finish();
  expect(router.replace).toHaveBeenCalledWith('/login');
  expect(isHomeHandoffActive()).toBe(false);
});

it('가입 미완료 계정의 스타일 복원은 보호된 내 정보 API를 호출하지 않는다', async () => {
  await mount();
  expect(getCurrentUser).not.toHaveBeenCalled();
});

it('완료 중 가입 상태를 기다리다 계정이 바뀌면 다른 계정에 동의와 설정을 저장하지 않는다', async () => {
  const pending = deferred<Awaited<ReturnType<typeof getSignupState>>>();
  jest.mocked(getSignupState).mockResolvedValueOnce(pendingSignup).mockReturnValue(pending.promise);
  await mount();
  await finish();
  jest.mocked(loadToken).mockResolvedValue('different-session');
  await act(async () => pending.resolve(pendingSignup));
  expect(completeSignup).not.toHaveBeenCalled();
  expect(completeSetup).not.toHaveBeenCalled();
  expect(clearOnboardingAnswers).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/login');
});

it('서버가 설정된 앱에서 토큰이 없으면 오프라인 가입 완료 대신 로그인으로 보낸다', async () => {
  jest.mocked(loadToken).mockResolvedValue(null);
  await mount();
  await finish();
  expect(getSignupState).not.toHaveBeenCalled();
  expect(completeSignup).not.toHaveBeenCalled();
  expect(completeSetup).not.toHaveBeenCalled();
  expect(saveWeddingDraft).not.toHaveBeenCalled();
  expect(clearOnboardingAnswers).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/login');
  expect(frame().props.stepKey).toBe('done');
});
