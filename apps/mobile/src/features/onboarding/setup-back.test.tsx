import React from 'react';
import { BackHandler } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import SetupScreen from '@/app/setup';
import { completeSetup, completeSignup, getAppBootstrap, getCurrentUser, getSignupState } from '@/api/client';
import { loadToken } from '@/api/session';
import { showResultToast } from '@/features/navigation/result-toast';
import { EMPTY_ANSWERS, type Answers } from './flow';
import { EXIT_BACK_WINDOW_MS, isSecondExitPress, resolveSetupBack } from './setup-back';
import { clearOnboardingAnswers, clearWeddingDraft, loadOnboardingAnswers, saveOnboardingAnswers, saveWeddingDraft } from './wedding-draft';

/**
 * 초기 설정의 안드로이드 물리 뒤로가기(2026-09-26 대표 감사 1)와 기기 저장소를
 * 못 읽었을 때의 오류 · 다시 시도(감사 5).
 *
 * **이 시험은 안드로이드 실기기가 아니다.** `BackHandler.addEventListener`에 걸린
 * 처리기를 붙잡아 `hardwareBackPress`가 왔을 때와 같은 호출을 흉내 낸다. 실기기의
 * 뒤로가기 · 앱 종료 · 토스트는 따로 확인해야 한다.
 */
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/api/config', () => ({ isServerConfigured: true }));
jest.mock('@/api/session', () => ({ loadToken: jest.fn() }));
jest.mock('@/api/client', () => ({
  ApiError: class extends Error {},
  completeSetup: jest.fn(), completeSignup: jest.fn(), getAppBootstrap: jest.fn(), getCurrentUser: jest.fn(), getSignupState: jest.fn(),
}));
jest.mock('@/features/navigation/result-toast', () => ({ showResultToast: jest.fn() }));
jest.mock('./wedding-draft', () => ({
  clearOnboardingAnswers: jest.fn(), clearWeddingDraft: jest.fn(), loadOnboardingAnswers: jest.fn(),
  saveOnboardingAnswers: jest.fn(), saveWeddingDraft: jest.fn(),
}));
jest.mock('./budget-amount', () => ({ BudgetAmount: 'BudgetAmount' }));
jest.mock('./date-picker-sheet', () => ({ OnboardingDatePickerSheet: 'OnboardingDatePickerSheet' }));
jest.mock('./option-row', () => ({ OptionRow: 'OptionRow' }));
jest.mock('./question-head', () => ({ QuestionHead: 'QuestionHead' }));
jest.mock('./region-picker-sheet', () => ({ RegionPickerSheet: 'RegionPickerSheet' }));
jest.mock('./step-frame', () => ({ StepFrame: 'StepFrame' }));
jest.mock('@weddingpick/ui', () => ({
  Border: { selected: 1.5 },
  CanonGray: {},
  ErrorView: 'ErrorView',
  FontSize: { dateWheel: 17 },
  Layout: {},
  LetterSpacing: {},
  LineHeight: {},
  ProductSymbol: 'ProductSymbol',
  Radius: {},
  Spacing: {},
  ThemedText: 'ThemedText',
  ThemedView: 'ThemedView',
  useTheme: () => ({}),
}));

const complete: Answers = {
  date: { value: null }, region: { region: '서울', district: null },
  prep: { categories: [] }, budget: { amount: null }, style: ['URBAN'],
};

describe('resolveSetupBack', () => {
  it('첫 질문은 로그인이 아니라 종료 확인이다', () => {
    expect(resolveSetupBack({ step: 'date', answers: EMPTY_ANSWERS, sheetOpen: false })).toEqual({ kind: 'exit-guard' });
  });

  it('질문은 앞 질문으로, 요약은 마지막 질문으로 간다', () => {
    expect(resolveSetupBack({ step: 'region', answers: complete, sheetOpen: false })).toEqual({ kind: 'step', target: 'date' });
    expect(resolveSetupBack({ step: 'style', answers: complete, sheetOpen: false })).toEqual({ kind: 'step', target: 'budget' });
    expect(resolveSetupBack({ step: 'done', answers: complete, sheetOpen: false })).toEqual({ kind: 'step', target: 'style' });
  });

  it('시트가 열려 있으면 시트만 닫는다', () => {
    expect(resolveSetupBack({ step: 'date', answers: EMPTY_ANSWERS, sheetOpen: true })).toEqual({ kind: 'close-sheet' });
    expect(resolveSetupBack({ step: 'done', answers: complete, sheetOpen: true })).toEqual({ kind: 'close-sheet' });
  });

  it('두 번째 누름은 2초 안에만 종료로 읽는다', () => {
    expect(isSecondExitPress(0, 1_000)).toBe(false);
    expect(isSecondExitPress(1_000, 1_000 + EXIT_BACK_WINDOW_MS)).toBe(true);
    expect(isSecondExitPress(1_000, 1_001 + EXIT_BACK_WINDOW_MS)).toBe(false);
  });
});

describe('초기 설정 화면의 안드로이드 뒤로가기', () => {
  let tree: ReactTestRenderer;
  type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
  let handlers: BackListener[];

  /** 가장 최근에 걸린 처리기가 이벤트를 받는다(BackHandler와 같은 순서). */
  function pressBack(): boolean | null | undefined {
    const handler = handlers.at(-1);
    if (!handler) throw new Error('뒤로가기 처리기가 없다');
    let result: boolean | null | undefined;
    act(() => { result = handler({} as never); });
    return result;
  }
  function frame() {
    return tree.root.findByType('StepFrame' as never);
  }
  async function mount(saved: Answers | null) {
    jest.mocked(loadOnboardingAnswers).mockResolvedValue(saved);
    await act(async () => { tree = create(<SetupScreen />); });
  }

  beforeEach(() => {
    handlers = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => { handlers = handlers.filter((one) => one !== handler); } };
    });
    jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    jest.mocked(loadToken).mockResolvedValue('session-token');
    for (const save of [clearOnboardingAnswers, clearWeddingDraft, saveOnboardingAnswers, saveWeddingDraft]) {
      jest.mocked(save).mockResolvedValue(undefined);
    }
    jest.mocked(getSignupState).mockResolvedValue({ activated: true } as never);
    jest.mocked(getCurrentUser).mockResolvedValue({ styleTags: [] } as never);
    jest.mocked(completeSignup).mockResolvedValue({ activated: true } as never);
    jest.mocked(completeSetup).mockResolvedValue({} as never);
    jest.mocked(getAppBootstrap).mockResolvedValue({} as never);
  });
  afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

  it('첫 질문에서 뒤로가기는 로그인으로 가지 않고, 한 번은 안내 · 두 번이면 앱을 닫는다', async () => {
    await mount(null);
    expect(frame().props.stepKey).toBe('date');
    /* 첫 질문에는 화면의 «이전»도 없다. */
    expect(frame().props.onPrev).toBeUndefined();

    expect(pressBack()).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
    expect(showResultToast).toHaveBeenCalledWith('뒤로가기를 한 번 더 누르면 앱이 종료돼요');
    expect(BackHandler.exitApp).not.toHaveBeenCalled();

    expect(pressBack()).toBe(true);
    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalledWith('/login');
    expect(frame().props.stepKey).toBe('date');
  });

  it('두 번째 누름이 2초를 넘기면 다시 안내만 한다', async () => {
    const now = jest.spyOn(Date, 'now');
    await mount(null);
    now.mockReturnValue(10_000);
    pressBack();
    now.mockReturnValue(10_000 + EXIT_BACK_WINDOW_MS + 1);
    pressBack();
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(showResultToast).toHaveBeenCalledTimes(2);
  });

  it('2/5 이후의 뒤로가기는 앞 질문으로 간다', async () => {
    await mount({ ...EMPTY_ANSWERS, date: { value: null } });
    expect(frame().props.stepKey).toBe('region');

    expect(pressBack()).toBe(true);
    expect(frame().props.stepKey).toBe('date');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('완료 요약에서 뒤로가기는 마지막 질문(스타일)으로 돌아가고 답은 남는다', async () => {
    await mount(complete);
    expect(frame().props.stepKey).toBe('style');
    await act(async () => { frame().props.onNext(); });
    expect(frame().props.stepKey).toBe('done');

    expect(pressBack()).toBe(true);
    expect(frame().props.stepKey).toBe('style');
    expect(router.replace).not.toHaveBeenCalled();
    expect(completeSetup).not.toHaveBeenCalled();

    /* 다시 «다음»이면 같은 요약 — 답이 그대로라 처음부터 묻지 않는다. */
    await act(async () => { frame().props.onNext(); });
    expect(frame().props.stepKey).toBe('done');
  });
});

describe('기기에 적어 둔 답을 못 읽었을 때', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

  beforeEach(() => {
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }));
    jest.mocked(loadToken).mockResolvedValue(null);
    jest.mocked(saveOnboardingAnswers).mockResolvedValue(undefined);
  });

  it('빈 화면에 멈추지 않고 오류와 «다시 시도»를 보인 뒤, 다시 읽어 이어서 묻는다', async () => {
    jest.mocked(loadOnboardingAnswers)
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce({ ...EMPTY_ANSWERS, date: { value: null } });

    await act(async () => { tree = create(<SetupScreen />); });

    const error = tree.root.findByType('ErrorView' as never);
    expect(error.props.message).toBe('적어 둔 답을 불러오지 못했어요');
    expect(tree.root.findAllByType('StepFrame' as never)).toHaveLength(0);

    await act(async () => { error.props.onRetry(); });

    expect(loadOnboardingAnswers).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType('ErrorView' as never)).toHaveLength(0);
    expect(tree.root.findByType('StepFrame' as never).props.stepKey).toBe('region');
  });
});
