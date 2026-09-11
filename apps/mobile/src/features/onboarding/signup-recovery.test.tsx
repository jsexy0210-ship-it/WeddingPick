import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import SetupScreen from '@/app/setup';
import { ApiError, completeSetup, completeSignup, getCurrentUser, getSignupState } from '@/api/client';
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
  completeSetup: jest.fn(), completeSignup: jest.fn(), getCurrentUser: jest.fn(), getSignupState: jest.fn(),
}));
jest.mock('./wedding-draft', () => ({
  clearOnboardingAnswers: jest.fn(), clearWeddingDraft: jest.fn(), loadOnboardingAnswers: jest.fn(),
  saveOnboardingAnswers: jest.fn(), saveWeddingDraft: jest.fn(),
}));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedRecommendingView: 'Loading' }));
jest.mock('./budget-grid', () => ({ BudgetGrid: 'BudgetGrid' }));
jest.mock('./date-picker-sheet', () => ({ DatePickerSheet: 'DatePickerSheet' }));
jest.mock('./inline-toast', () => ({ InlineToast: 'InlineToast', useInlineToast: () => ({ toast: null, show: jest.fn(), hide: jest.fn() }) }));
jest.mock('./option-chip', () => ({ OptionChip: 'OptionChip' }));
jest.mock('./prep-status', () => ({ PrepStatus: 'PrepStatus' }));
jest.mock('./question-head', () => ({ QuestionHead: 'QuestionHead' }));
jest.mock('./region-picker', () => ({ RegionPicker: 'RegionPicker' }));
jest.mock('./step-frame', () => ({ StepFrame: 'StepFrame' }));
jest.mock('./style-grid', () => ({ StyleGrid: 'StyleGrid' }));
jest.mock('@weddingpick/ui', () => ({
  Layout: {}, Radius: {}, Spacing: {}, ThemedText: 'ThemedText', ThemedView: 'ThemedView', useTheme: () => ({}),
}));

const answers: Answers = {
  date: { value: null }, region: { region: null, district: null }, prep: { categories: [] },
  budget: 'unknown', style: ['URBAN'],
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
 * 5/5에서 «다음». 2026-09-11 대표 지시 이후 이 누름은 **결과 화면으로 갈 뿐이고
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
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it('첫 가입 상태 조회가 늦어도 완료 시 재확인하고 가입 저장 뒤 초기 설정을 저장한다', async () => {
  const first = deferred<Awaited<ReturnType<typeof getSignupState>>>();
  const signup = deferred<Awaited<ReturnType<typeof completeSignup>>>();
  jest.mocked(getSignupState).mockReturnValueOnce(first.promise).mockResolvedValue(pendingSignup);
  jest.mocked(completeSignup).mockReturnValue(signup.promise);
  await mount();
  await finish();
  expect(getSignupState).toHaveBeenCalledTimes(2);
  expect(completeSignup).toHaveBeenCalledWith({ consents: ['terms', 'privacy'] });
  expect(completeSetup).not.toHaveBeenCalled();
  await act(async () => signup.resolve(activeSignup));
  expect(completeSetup).toHaveBeenCalledTimes(1);
  /* 저장이 끝나면 홈으로 간다 — 결과 화면은 그 전에 이미 그려져 있었다. */
  expect(router.replace).toHaveBeenCalledWith('/');
  await act(async () => first.resolve(pendingSignup));
});

it('첫 조회가 실패했어도 완료 시 가입 상태를 다시 읽어 누락된 가입을 마친다', async () => {
  jest.mocked(getSignupState).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(pendingSignup);
  await mount();
  await finish();
  expect(getSignupState).toHaveBeenCalledTimes(2);
  expect(completeSignup).toHaveBeenCalledTimes(1);
  expect(completeSetup).toHaveBeenCalledTimes(1);
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

it('가입 저장이 실패하면 초기 설정을 보내거나 가입 완료로 표시하지 않는다', async () => {
  jest.mocked(completeSignup).mockRejectedValue(new Error('가입을 저장하지 못했어요'));
  await mount();
  await finish();
  expect(completeSetup).not.toHaveBeenCalled();
  expect(clearOnboardingAnswers).not.toHaveBeenCalled();
  expect(frame().props.error).toBe('가입을 저장하지 못했어요');
});

it('이미 활성화된 계정은 가입 동의를 다시 저장하지 않고 초기 설정만 저장한다', async () => {
  jest.mocked(getSignupState).mockResolvedValue(activeSignup);
  await mount();
  await finish();
  expect(getSignupState).toHaveBeenCalledTimes(2);
  expect(completeSignup).not.toHaveBeenCalled();
  expect(completeSetup).toHaveBeenCalledTimes(1);
});

it('가입 미완료 계정의 스타일 복원은 보호된 내 정보 API를 호출하지 않는다', async () => {
  await mount();
  expect(getCurrentUser).not.toHaveBeenCalled();
});

it('가입 저장이 200이어도 활성화되지 않았으면 초기 설정이나 완료 처리를 하지 않는다', async () => {
  jest.mocked(completeSignup).mockResolvedValue(pendingSignup);
  await mount();
  await finish();
  expect(completeSetup).not.toHaveBeenCalled();
  expect(clearOnboardingAnswers).not.toHaveBeenCalled();
  expect(frame().props.error).toBeTruthy();
  expect(frame().props.stepKey).toBe('done');
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
