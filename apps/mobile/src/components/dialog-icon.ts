/**
 * 공통 다이얼로그의 아이콘 원 — RN 정본 `docs/design/React_Native/common.js:151~154 · 186~188`.
 *
 * ```
 * ok    CHK(48, '#e8faf6', '#1aa174')    WP-DLG-A 완료 알림
 * bad   BANG(48, '#ffe5e3', '#e81607')   WP-DLG-C 되돌릴 수 없음
 * warn  BANG(48, '#fff6e6', '#805217')   WP-DLG-B 작성 중 이탈
 * ```
 *
 * 원 48 · 글리프 24(원의 0.5) · stroke 2.6 · round. 어느 아이콘을 쓸지는 호출 뜻에 달려
 * 있어 `confirmAlert`의 선택 인자로만 받는다 — 안 주면 지금처럼 아이콘 없이 그린다.
 */
export type DialogIcon = 'ok' | 'bad' | 'warn';

const CHECK = ['m5 12.5 4.5 4.5L19 7.5'] as const;
const BANG = ['M12 7v6', 'M12 17h.01'] as const;

export const DIALOG_ICON: Record<DialogIcon, { background: string; stroke: string; paths: readonly string[] }> = {
  ok: { background: '#e8faf6', stroke: '#1aa174', paths: CHECK },
  bad: { background: '#ffe5e3', stroke: '#e81607', paths: BANG },
  warn: { background: '#fff6e6', stroke: '#805217', paths: BANG },
};

export const DIALOG_ICON_SIZE = 48;
export const DIALOG_ICON_GLYPH = 24;
export const DIALOG_ICON_STROKE = 2.6;
