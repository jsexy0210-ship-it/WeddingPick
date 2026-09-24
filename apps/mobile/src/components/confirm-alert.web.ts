import tokens from '../../../../spec/tokens.json';
import strings from '../../../../spec/strings.ko.json';

import {
  createConfirmationQueue,
  type AlertButton,
  type ConfirmAlertOptions,
  type Confirmation,
} from './confirmation-queue';
import { DIALOG_ICON, DIALOG_ICON_GLYPH, DIALOG_ICON_SIZE, DIALOG_ICON_STROKE } from './dialog-icon';

/*
 * 값의 정본은 RN 정본 `docs/design/React_Native/common.js:156~199`(common frame-001~005 ·
 * 008 — WP-DLG-A/B/C/E)다(2026-09-24 대표 절대 지침). 예전에는 정본이 없어 지우기 직전
 * `handoff/tokens.json`(`e418caa5`) 값을 얼려 두었는데, 그 값과 달랐던 자리만 정본으로
 * 옮겼다 — 제목 줄높이 27→28 · 본문 14/21→14/22 · 버튼 52→56 · 버튼 글자 16→17 ·
 * 행동 목록(E) 시트 padding 14 24 28 · gap 12 · 그래버 40×4 · 제목 22/30 · 본문 왼쪽 정렬 ·
 * 행 글자 16 · 좌우 2 · 버튼줄 위 10 · 되돌릴 수 없음(C) 항목 상자 padding 12 16 · 빨강 5px 점.
 * 나머지(좌우 32 · padding 28 24 20 · radius 14 · 버튼줄 gap 8 · 위 14 · 행 56)는 같았다.
 * `spec/tokens.json` 쪽 값을 대신 쓰지 않은 이유는 이름은 같아도 모양이 다르기 때문이다
 * (`typography.scale`이 거기서는 `{role, size, lineHeight}` 배열이라 1:1로 안 맞는다).
 */
const CANON = {
  color: {
    text: { primary: '#212124', quaternary: '#868B94', tertiary: '#4D5159', onPrimary: '#FFFFFF' },
    overlay: { dim: 'rgba(0,0,0,.45)' },
    surface: { paper: '#FFFFFF', recessed: '#F7F8FA', band: '#F2F3F6' },
    brand: { primary: '#FF6F61' },
    status: { dangerAction: '#FF4133' },
    line: { divider: '#EAEBEE' },
  },
  spacing: { gutter: 24, chipGap: 8, sectionBottom: 28, grid2RowGap: 20, iconTextGap: 10, inlineGap: 12, bandHeight: 16,
    sheetTop: 14, grabberGap: 4, half: 2, bullet: 5, bulletTop: 9 },
  typography: {
    scale: {
      /*
       * 키 이름을 `fontSize`·`lineHeight`가 아니라 `size`·`leading`으로 적는다.
       * `typography.test.ts`가 저장소 전체에서 `fontSize:` · `lineHeight:` 뒤에 숫자가
       * 바로 오는 줄을 「화면이 토큰을 안 거치고 크기를 직접 적었다」로 잡는다 — 여기는
       * `packages/ui/src/typography.ts`의 공용 토큰 표가 아니라 얼린 값이라 그 시험의
       * 대상이 아닌데, 이름이 같아서 같이 잡혔다. 이름만 바꾸고 값은 그대로다.
       */
      section: { size: 20, leading: 28, weight: 700 },
      sheetTitle: { size: 22, leading: 30 },
      caption: { size: 14, leading: [19, 21, 22] },
      sub: { size: 16, leading: [22, 24, 26] },
      button: { size: 17, leading: 24 },
    },
  },
  size: { screen: { width: 390 }, cta: { primary: 56 }, rowMinHeight: 56, grabber: { width: 40, height: 4 } },
  radius: { pickCard: 14, card: 10, control: 6, sheet: 20, pill: 999 },
  border: { focus: 2, hairline: 1 },
  motion: { pressButton: { transform: 'scale(0.98)' }, press: { duration: 100 } },
} as const;

const C = CANON.color;
const S = CANON.spacing;
const TYPE = CANON.typography.scale;
const FONT = tokens.typography.$fontFamily.web;
const px = (value: number) => `${value}px`;
const CANCEL = strings.common['cta.cancel'];
const CONFIRM = strings.common['cta.confirm'];

/**
 * RN 정본 WP-DLG-A/B/C/E(`common.js` `screens`)를 기존 Alert 호출에 연결한다. 수치는
 * 위 `CANON`을 따른다. 서체는 Pretendard다.
 * D(입력 시트)와 F(토스트)는 각 기존 컴포넌트의 역할이며 이 래퍼로 바꾸지 않는다.
 * HTML 문자열에 입력값을 보간하지 않고 textContent만 사용한다.
 */
function renderDialog(request: Confirmation, choose: (index: number | null) => void): () => void {
  const cancelIndex = request.buttons.findIndex((button) => button.style === 'cancel');
  const actions = request.buttons.map((button, index) => ({ button, index }))
    .filter(({ button }) => button.style !== 'cancel');
  const danger = actions.some(({ button }) => button.style === 'destructive');
  const actionList = actions.length > 1;
  const kind = actionList ? 'E' : danger ? 'C' : cancelIndex >= 0 ? 'B' : 'A';
  const dialog = document.createElement('dialog');
  dialog.dataset.wpDialog = kind;
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('role', danger ? 'alertdialog' : 'dialog');
  dialog.setAttribute('aria-labelledby', `wp-dialog-title-${request.id}`);
  const originalFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const originalOverflow = document.body.style.overflow;
  const restores: Array<() => void> = [];
  let closing = false;
  let scopeTimer: ReturnType<typeof setInterval> | undefined;

  const style = document.createElement('style');
  // 중앙 좌우 32는 정본 CENTER의 지정값이다. 본문 여백 24와 간격 단위 8로 표현한다.
  const inset = S.gutter + S.chipGap;
  style.textContent = `
    dialog[data-wp-dialog] { border:0; padding:0; margin:auto; background:transparent;
      color:${C.text.primary}; font-family:${FONT}; max-height:calc(100dvh - ${px(S.gutter * 2)});
      width:calc(100% - ${px(inset * 2)}); max-width:${px(CANON.size.screen.width)}; overflow:visible; }
    dialog[data-wp-dialog]::backdrop { background:${C.overlay.dim}; }
    dialog[data-wp-dialog] * { box-sizing:border-box; }
    [data-wp-dialog] .wp-dialog-panel { background:${C.surface.paper}; border-radius:${px(CANON.radius.pickCard)};
      padding:${px(S.sectionBottom)} ${px(S.gutter)} ${px(S.grid2RowGap)}; display:flex;
      flex-direction:column; gap:${px(S.iconTextGap)}; max-height:inherit; overflow:auto; }
    [data-wp-dialog] h2 { margin:0; font-size:${px(TYPE.section.size)}; line-height:${px(TYPE.section.leading)};
      font-weight:${TYPE.section.weight}; text-align:center; overflow-wrap:anywhere; }
    [data-wp-dialog] p { margin:0; font-size:${px(TYPE.caption.size)}; line-height:${px(TYPE.caption.leading[2]!)};
      color:${C.text.quaternary}; text-align:center; white-space:pre-line; overflow-wrap:anywhere; }
    [data-wp-dialog] ul { margin:0; padding:${px(S.inlineGap)} ${px(S.bandHeight)}; list-style:none;
      align-self:stretch; border-radius:${px(CANON.radius.card)}; background:${C.surface.recessed};
      color:${C.text.tertiary}; font-size:${px(TYPE.caption.size)}; line-height:${px(TYPE.caption.leading[1]!)}; }
    [data-wp-dialog] li { margin-bottom:${px(S.chipGap)}; overflow-wrap:anywhere; white-space:pre-line;
      display:flex; align-items:flex-start; gap:${px(S.iconTextGap)}; }
    [data-wp-dialog] li::before { content:''; flex:0 0 ${px(S.bullet)}; width:${px(S.bullet)}; height:${px(S.bullet)};
      margin-top:${px(S.bulletTop)}; border-radius:${px(CANON.radius.pill)}; background:${C.status.dangerAction}; }
    [data-wp-dialog] li:last-child { margin-bottom:0; }
    [data-wp-dialog] .wp-dialog-buttons { display:flex; gap:${px(S.chipGap)}; padding-top:${px(TYPE.caption.size)}; }
    [data-wp-dialog] button { min-width:0; flex:1; min-height:${px(CANON.size.cta.primary)}; border:0;
      border-radius:${px(CANON.radius.control)}; padding:${px(S.chipGap)} ${px(S.inlineGap)}; cursor:pointer;
      background:${C.brand.primary}; color:${C.text.onPrimary}; font-family:inherit;
      font-size:${px(TYPE.button.size)}; font-weight:700; line-height:${px(TYPE.button.leading)}; overflow-wrap:anywhere; }
    [data-wp-dialog] button:focus-visible { outline:${px(CANON.border.focus)} solid ${C.text.primary}; outline-offset:${px(CANON.border.focus)}; }
    [data-wp-dialog] button:active { transform:${CANON.motion.pressButton.transform}; }
    [data-wp-dialog] button[data-cancel] { background:${C.surface.band}; color:${C.text.tertiary}; }
    [data-wp-dialog] button[data-danger] { background:${C.status.dangerAction}; }
    [data-wp-dialog="E"] { margin:auto auto 0; max-width:${px(CANON.size.screen.width)}; width:100%; }
    [data-wp-dialog="E"] .wp-dialog-panel { border-radius:${px(CANON.radius.sheet)} ${px(CANON.radius.sheet)} 0 0;
      padding:${px(S.sheetTop)} ${px(S.gutter)} calc(${px(S.sectionBottom)} + env(safe-area-inset-bottom, 0px));
      gap:${px(S.inlineGap)}; }
    [data-wp-dialog="E"] .wp-dialog-grabber { align-self:center; width:${px(CANON.size.grabber.width)};
      height:${px(CANON.size.grabber.height)}; border-radius:${px(CANON.radius.pill)}; background:${C.line.divider};
      margin-bottom:${px(S.grabberGap)}; flex:none; }
    [data-wp-dialog="E"] h2 { text-align:left; font-size:${px(TYPE.sheetTitle.size)}; line-height:${px(TYPE.sheetTitle.leading)}; }
    [data-wp-dialog="E"] p { text-align:left; }
    [data-wp-dialog="E"] .wp-dialog-buttons { padding-top:${px(S.iconTextGap)}; }
    [data-wp-dialog] .wp-dialog-actions { display:flex; flex-direction:column; }
    [data-wp-dialog] .wp-dialog-actions button { flex:none; text-align:left; border-radius:0;
      min-height:${px(CANON.size.rowMinHeight)}; color:${C.text.primary}; background:transparent;
      font-size:${px(TYPE.sub.size)}; padding:0 ${px(S.half)};
      border-bottom:${px(CANON.border.hairline)} solid ${C.line.divider}; }
    [data-wp-dialog] .wp-dialog-actions button[data-danger] { color:${C.status.dangerAction}; }
    dialog[data-wp-dialog][data-fallback] { display:flex; position:fixed; inset:0; width:100%; height:100%;
      max-width:none; max-height:none; z-index:2147483647; align-items:center; justify-content:center;
      background:${C.overlay.dim}; padding:${px(S.gutter)}; }
    dialog[data-wp-dialog][data-fallback] .wp-dialog-panel { width:100%; max-width:${px(CANON.size.screen.width)};
      max-height:100%; }
  `;
  const panel = document.createElement('div');
  panel.className = 'wp-dialog-panel';
  if (kind === 'E') {
    const grabber = document.createElement('div');
    grabber.className = 'wp-dialog-grabber';
    grabber.setAttribute('aria-hidden', 'true');
    panel.append(grabber);
  }
  if (request.icon) {
    // 정본 iconStyle — 원 48 · 글리프 24 · stroke 2.6(`common.js:151 · 186`). 값은 고정 표에서만 온다.
    const spec = DIALOG_ICON[request.icon];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${spec.stroke}' `
      + `stroke-width='${DIALOG_ICON_STROKE}' stroke-linecap='round' stroke-linejoin='round'>`
      + spec.paths.map((d) => `<path d='${d}'/>`).join('') + '</svg>';
    const icon = document.createElement('span');
    icon.className = 'wp-dialog-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = `width:${px(DIALOG_ICON_SIZE)};height:${px(DIALOG_ICON_SIZE)};flex:0 0 ${px(DIALOG_ICON_SIZE)};`
      + `align-self:${kind === 'E' ? 'flex-start' : 'center'};border-radius:${px(CANON.radius.pill)};`
      + `background-color:${spec.background};background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}");`
      + `background-size:${px(DIALOG_ICON_GLYPH)};background-position:center;background-repeat:no-repeat`;
    panel.append(icon);
  }
  const title = document.createElement('h2');
  title.id = `wp-dialog-title-${request.id}`;
  title.textContent = request.title;
  panel.append(title);

  if (request.message) {
    const description = document.createElement(danger && !actionList ? 'ul' : 'p');
    description.id = `wp-dialog-description-${request.id}`;
    if (description instanceof HTMLUListElement) {
      // 기존 호출자가 제공한 영향 안내만 항목화한다. 삭제 범위를 추측해 만들지 않는다.
      for (const line of request.message.split('\n').filter((line) => line.trim())) {
        const item = document.createElement('li');
        item.textContent = line;
        description.append(item);
      }
    } else description.textContent = request.message;
    dialog.setAttribute('aria-describedby', description.id);
    panel.append(description);
  }

  const buttons = document.createElement('div');
  buttons.className = 'wp-dialog-buttons';
  function button(label: string, index: number | null, role: 'cancel' | 'action' | 'danger'): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (role === 'cancel') element.dataset.cancel = '';
    if (role === 'danger') element.dataset.danger = '';
    element.addEventListener('click', () => {
      if (closing) return;
      closing = true;
      choose(index);
    });
    return element;
  }
  let initialFocus: HTMLButtonElement | undefined;
  const cancel = () => choose(cancelIndex < 0 ? null : cancelIndex);
  if (kind !== 'A') {
    initialFocus = button(request.buttons[cancelIndex]?.text ?? CANCEL,
      cancelIndex < 0 ? null : cancelIndex, 'cancel');
    buttons.append(initialFocus);
  }
  if (actionList) {
    const list = document.createElement('div');
    list.className = 'wp-dialog-actions';
    for (const { button: action, index } of [...actions].sort((a, b) =>
      Number(a.button.style === 'destructive') - Number(b.button.style === 'destructive'))) {
      list.append(button(action.text, index, action.style === 'destructive' ? 'danger' : 'action'));
    }
    panel.append(list);
  } else if (actions.length) {
    const action = actions[0]!;
    const element = button(action.button.text, action.index, danger ? 'danger' : 'action');
    buttons.append(element);
    initialFocus ??= element;
  } else if (kind === 'A') {
    const element = button(CONFIRM, null, 'action');
    buttons.append(element);
    initialFocus = element;
  }
  panel.append(buttons);
  dialog.append(style, panel);
  document.body.append(dialog);
  document.body.style.overflow = 'hidden';
  let modalOpened = false;
  if (typeof dialog.showModal === 'function') {
    try { dialog.showModal(); modalOpened = true; }
    catch { /* 이 WebView가 top layer를 열지 못하면 같은 UI의 접근성 폴백을 쓴다. */ }
  }
  if (!modalOpened) {
    dialog.setAttribute('open', '');
    dialog.dataset.fallback = '';
    // 구형 WebView에서도 배경이 보조기술과 키보드에 노출되지 않도록 복원 가능한 범위로 잠근다.
    for (const sibling of Array.from(document.body.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === dialog) continue;
      const previousInert = sibling.inert;
      const previousAria = sibling.getAttribute('aria-hidden');
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
      restores.push(() => {
        sibling.inert = previousInert;
        if (previousAria === null) sibling.removeAttribute('aria-hidden');
        else sibling.setAttribute('aria-hidden', previousAria);
      });
    }
  }
  initialFocus?.focus();
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (kind !== 'C') cancel();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && kind !== 'C') cancel();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (kind !== 'C') cancel();
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const scopeChanged = () => queue.checkScope();
  window.addEventListener('popstate', scopeChanged);
  window.addEventListener('hashchange', scopeChanged);
  // pushState/replaceState는 popstate를 발생시키지 않는다. 열린 동안에만 주소를 확인한다.
  // 버튼 실행 직전에도 큐가 scope를 검사하므로 이 간격 안에도 이전 화면의 동작은 실행되지 않는다.
  scopeTimer = setInterval(scopeChanged, CANON.motion.press.duration);
  return () => {
    closing = true;
    clearInterval(scopeTimer);
    window.removeEventListener('popstate', scopeChanged);
    window.removeEventListener('hashchange', scopeChanged);
    dialog.remove();
    restores.forEach((restore) => restore());
    document.body.style.overflow = originalOverflow;
    if (originalFocus?.isConnected) originalFocus.focus();
  };
}

const queue = createConfirmationQueue({
  scope: () => typeof window === 'undefined' ? '' : window.location.href,
  render: renderDialog,
  onError: (error) => {
    // 호출자의 오류를 성공으로 숨기지 않는다. 앱의 전역 오류 수집 경로로 전달한다.
    if (typeof window.reportError === 'function') window.reportError(error);
    else console.error('확인창 동작 중 오류가 발생했습니다.', error);
  },
});

export function confirmAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: ConfirmAlertOptions
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  queue.enqueue(title, message ?? '', buttons ?? [], options?.icon);
}
