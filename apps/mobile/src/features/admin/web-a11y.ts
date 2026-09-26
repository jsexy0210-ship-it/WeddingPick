import type { PressableProps, TextProps } from 'react-native';

/**
 * 관리자 콘솔(웹 전용)의 접근성 속성 — 2026-09-26 감사 5 · 8b.
 *
 * **왜 여기 모으나.** 관리자 공용 부품(`app/admin/_ui.tsx`)의 `Pressable`은 역할
 * 없이 그려져 DOM에서 `<div tabindex="0">`였다. 스크린리더는 「새로 고침」 ·
 * 「로그아웃」 · 탭을 단추로 읽지 못했고, Space로는 눌리지 않았다. 회원 차트의
 * 구간(일 · 주 · 월 · 년)은 `Text onPress`라서 Tab으로 닿지도 않았다.
 *
 * 정본도 같은 자리를 단추로 그린다 — `docs/design/html/웨딩픽 관리자.dc.html`의
 * 상단 동작 · 로그아웃 · 칩은 `<button type="button">`, 눌리는 줄 · 카드는
 * `role="button" tabindex="0"`이다.
 *
 * **react-native-web이 역할에 맞는 요소를 고른다.** `role: 'button'`이면 진짜
 * `<button type="button">`이 나오고 Enter · Space를 브라우저가 처리한다. `tab`은
 * 대응 요소가 없어 `<div role="tab">`이 나오므로 Space만 여기서 받는다(Enter는
 * react-native-web의 PressResponder가 이미 받는다 — 둘 다 받으면 두 번 눌린다).
 *
 * `aria-pressed` · `aria-level` · `onKeyDown`은 React Native 타입에 없다. 웹에서는
 * react-native-web이 그대로 DOM으로 넘기고, 관리자 콘솔은 웹에서만 열린다
 * (`app/admin/_layout.tsx`). 그래서 타입 단언은 이 파일 한 곳에만 둔다.
 */

/** 눌리는 자리. `pressed`를 주면 켜고 끄는 단추(`aria-pressed`)가 된다. */
export function buttonA11y(pressed?: boolean): PressableProps {
  const props: Record<string, unknown> = { role: 'button' };
  if (pressed !== undefined) props['aria-pressed'] = pressed;
  return props as PressableProps;
}

/** 탭 여럿을 묶는 자리. */
export const TABLIST_A11Y = { role: 'tablist' } as const;

type KeyEventLike = {
  key: string;
  preventDefault: () => void;
  currentTarget?: unknown;
};

/** 같은 탭 목록 안에서 `step`만큼 옆 탭으로 초점을 옮긴다. 끝에서는 반대쪽으로 돈다. */
function moveTabFocus(current: unknown, step: 1 | -1): boolean {
  const el = current as HTMLElement | null;
  const list = el?.closest?.('[role="tablist"]');
  if (!el || !list) return false;
  const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
  const at = tabs.indexOf(el);
  if (at < 0 || tabs.length === 0) return false;
  tabs[(at + step + tabs.length) % tabs.length]?.focus();
  return true;
}

/**
 * 탭 하나. `aria-selected`로 지금 탭을 알리고, Space로 고르고, ← →로 옆 탭에
 * 초점을 옮긴다(고르지는 않는다 — 탭마다 서버를 부르는 화면이 있다).
 */
export function tabA11y(selected: boolean, onSelect: () => void): PressableProps {
  const onKeyDown = (event: KeyEventLike) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      onSelect();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if (moveTabFocus(event.currentTarget, event.key === 'ArrowRight' ? 1 : -1)) event.preventDefault();
    }
  };
  return { role: 'tab', 'aria-selected': selected, onKeyDown } as PressableProps;
}

/** 제목. react-native-web이 `<h1>`~`<h6>`으로 그린다 — 글자 모양은 스타일이 정한다. */
export function headingA11y(level: 1 | 2 | 3): TextProps {
  return { role: 'heading', 'aria-level': level } as TextProps;
}
