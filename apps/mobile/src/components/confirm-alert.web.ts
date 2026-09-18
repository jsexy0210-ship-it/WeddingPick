import canon from '../../../../docs/design/handoff/tokens.json';
import tokens from '../../../../spec/tokens.json';
import strings from '../../../../spec/strings.ko.json';

import { createConfirmationQueue, type AlertButton, type Confirmation } from './confirmation-queue';

const C = canon.color;
const S = canon.spacing;
const TYPE = canon.typography.scale;
const FONT = tokens.typography.$fontFamily.web;
const px = (value: number) => `${value}px`;
const CANCEL = strings.common['cta.cancel'];
const CONFIRM = strings.common['cta.confirm'];

/**
 * docs/design/figma-export/09-dialogs의 A/B/C/E를 기존 Alert 호출에 연결한다.
 * 수치는 handoff를 따른다. 서체만 docs/design/README.md의 Pretendard 예외를 적용한다.
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
  // 중앙 좌우 32는 09-dialogs의 지정값이다. 본문 여백 24와 간격 단위 8로 표현한다.
  const inset = S.gutter + S.chipGap;
  style.textContent = `
    dialog[data-wp-dialog] { border:0; padding:0; margin:auto; background:transparent;
      color:${C.text.primary}; font-family:${FONT}; max-height:calc(100dvh - ${px(S.gutter * 2)});
      width:calc(100% - ${px(inset * 2)}); max-width:${px(canon.size.screen.width)}; overflow:visible; }
    dialog[data-wp-dialog]::backdrop { background:${C.overlay.dim}; }
    dialog[data-wp-dialog] * { box-sizing:border-box; }
    [data-wp-dialog] .wp-dialog-panel { background:${C.surface.paper}; border-radius:${px(canon.radius.pickCard)};
      padding:${px(S.sectionBottom)} ${px(S.gutter)} ${px(S.grid2RowGap)}; display:flex;
      flex-direction:column; gap:${px(S.iconTextGap)}; max-height:inherit; overflow:auto; }
    [data-wp-dialog] h2 { margin:0; font-size:${px(TYPE.section.fontSize)}; line-height:${px(TYPE.section.lineHeight)};
      font-weight:${TYPE.section.fontWeight}; text-align:center; overflow-wrap:anywhere; }
    [data-wp-dialog] p { margin:0; font-size:${px(TYPE.caption.fontSize)}; line-height:${px(TYPE.caption.lineHeight[1]!)};
      color:${C.text.quaternary}; text-align:center; white-space:pre-line; overflow-wrap:anywhere; }
    [data-wp-dialog] ul { margin:0; padding:${px(S.inlineGap)} ${px(S.bandHeight)} ${px(S.inlineGap)} ${px(S.gutter)};
      border-radius:${px(canon.radius.card)}; background:${C.surface.recessed};
      color:${C.text.tertiary}; font-size:${px(TYPE.caption.fontSize)}; line-height:${px(TYPE.caption.lineHeight[1]!)}; }
    [data-wp-dialog] li { margin-bottom:${px(S.chipGap)}; overflow-wrap:anywhere; white-space:pre-line; }
    [data-wp-dialog] li:last-child { margin-bottom:0; }
    [data-wp-dialog] .wp-dialog-buttons { display:flex; gap:${px(S.chipGap)}; padding-top:${px(TYPE.caption.fontSize)}; }
    [data-wp-dialog] button { min-width:0; flex:1; min-height:${px(canon.size.cta.primary)}; border:0;
      border-radius:${px(canon.radius.control)}; padding:${px(S.chipGap)} ${px(S.inlineGap)}; cursor:pointer;
      background:${C.brand.primary}; color:${C.text.onPrimary}; font-family:inherit;
      font-size:${px(TYPE.sub.fontSize)}; font-weight:700; line-height:${px(TYPE.sub.lineHeight[0]!)}; overflow-wrap:anywhere; }
    [data-wp-dialog] button:focus-visible { outline:${px(canon.border.focus)} solid ${C.text.primary}; outline-offset:${px(canon.border.focus)}; }
    [data-wp-dialog] button:active { transform:${canon.motion.pressButton.transform}; }
    [data-wp-dialog] button[data-cancel] { background:${C.surface.band}; color:${C.text.tertiary}; }
    [data-wp-dialog] button[data-danger] { background:${C.status.dangerAction}; }
    [data-wp-dialog="E"] { margin:auto auto 0; max-width:${px(canon.size.screen.width)}; width:100%; }
    [data-wp-dialog="E"] .wp-dialog-panel { border-radius:${px(canon.radius.sheet)} ${px(canon.radius.sheet)} 0 0;
      padding-bottom:calc(${px(S.sectionBottom)} + env(safe-area-inset-bottom, 0px)); }
    [data-wp-dialog="E"] h2 { text-align:left; }
    [data-wp-dialog] .wp-dialog-actions { display:flex; flex-direction:column; }
    [data-wp-dialog] .wp-dialog-actions button { flex:none; text-align:left; border-radius:0;
      min-height:${px(canon.size.rowMinHeight)}; color:${C.text.primary}; background:transparent;
      border-bottom:${px(canon.border.hairline)} solid ${C.line.divider}; }
    [data-wp-dialog] .wp-dialog-actions button[data-danger] { color:${C.status.dangerAction}; }
    dialog[data-wp-dialog][data-fallback] { display:flex; position:fixed; inset:0; width:100%; height:100%;
      max-width:none; max-height:none; z-index:2147483647; align-items:center; justify-content:center;
      background:${C.overlay.dim}; padding:${px(S.gutter)}; }
    dialog[data-wp-dialog][data-fallback] .wp-dialog-panel { width:100%; max-width:${px(canon.size.screen.width)};
      max-height:100%; }
  `;
  const panel = document.createElement('div');
  panel.className = 'wp-dialog-panel';
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
  scopeTimer = setInterval(scopeChanged, canon.motion.press.duration);
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

export function confirmAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  queue.enqueue(title, message ?? '', buttons ?? []);
}
