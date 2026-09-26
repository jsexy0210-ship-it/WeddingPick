import { prevStep, stepsFor, type Answers, type QuestionStep } from './flow';

/**
 * 초기 설정(`/setup`)에서 안드로이드 물리 뒤로가기가 무엇을 하는가.
 *
 * 2026-09-26 대표 감사 1 — 로그인 직후 첫 질문에서 뒤로가기를 누르면
 * `router.replace('/login')`으로 **로그인한 사람이 로그인 화면으로 돌아갔다.**
 * CLAUDE.md 공통 UI 규칙 「인증된 사용자는 Back으로 `/login`·`/setup`에 역진입
 * 금지」 · 「인증 후 Back으로 로그인에 역진입하지 않는다」를 어긴 자리다.
 *
 *   시트가 열려 있다      시트만 닫는다(Overlay 규칙). RN Modal이 먼저 받지만 한 번 더 막는다.
 *   완료 요약(WP-AUTH-007) 마지막 질문(5/5)으로 돌아간다. 전에는 이벤트를 삼키기만 해서
 *                        요약에서 한 칸도 못 돌아갔다. 요약의 «바꾸기»와 답은 그대로 남는다.
 *   2/5 ~ 5/5            «이전» 단추와 같다 — 앞 질문.
 *   1/5                  로그인으로 가지 않는다. 뒤에 남은 화면이 없으므로(가입 흐름은 전부
 *                        replace다) 홈과 같은 두 번 눌러 앱 종료를 쓴다.
 *
 * **정본과 다른 자리가 있다 — DESIGN_UNRESOLVED.** `docs/design/React_Native/home.js:809`
 * 대조표는 「온보딩 Back — 이전 단계 · 1단계에서는 로그인」이라고 적는다. 대표님의
 * 명시 규칙(인증 후 로그인 역진입 금지)과 정면으로 부딪혀 규칙 쪽을 따랐고, 첫 질문의
 * 동작(두 번 눌러 종료)은 정본에 없어 홈의 기존 동작을 그대로 빌렸다.
 */
export type SetupBackAction =
  | { kind: 'close-sheet' }
  | { kind: 'step'; target: QuestionStep }
  | { kind: 'exit-guard' };

export function resolveSetupBack(input: {
  step: QuestionStep | 'done';
  answers: Answers;
  sheetOpen: boolean;
}): SetupBackAction {
  if (input.sheetOpen) return { kind: 'close-sheet' };

  if (input.step === 'done') {
    const last = stepsFor(input.answers).at(-1);

    return last === undefined ? { kind: 'exit-guard' } : { kind: 'step', target: last };
  }

  const previous = prevStep(input.step, input.answers);

  return previous === null ? { kind: 'exit-guard' } : { kind: 'step', target: previous };
}

/** 두 번째 누름을 종료로 읽는 창 — 홈(`app/(tabs)/_layout.tsx`)과 같은 2초. */
export const EXIT_BACK_WINDOW_MS = 2_000;

/** 지난 누름으로부터 창 안에 다시 눌렀는가. 처음 누름(0)은 늘 false다. */
export function isSecondExitPress(lastAt: number, now: number): boolean {
  return lastAt > 0 && now - lastAt <= EXIT_BACK_WINDOW_MS;
}
