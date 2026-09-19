import {
  createConfirmationQueue,
  type AlertButton,
  type Confirmation,
} from './confirmation-queue';
import { showNativeConfirmation } from './native-confirmation-store';

/**
 * 네이티브 확인창도 09-dialogs의 핵심 순서를 따른다.
 *
 * - 취소는 왼쪽/먼저
 * - 일반 실행은 가운데
 * - 되돌릴 수 없는 실행만 마지막 danger
 * - 한 번에 하나만 열고 나머지는 queue에 둔다
 *
 * 웹은 confirm-alert.web.ts가 A/B/C/E를 직접 그린다. 네이티브는 플랫폼 Alert를
 * 사용하되 호출 순서와 콜백 수명은 같은 queue가 관리한다.
 */
export function orderNativeAlertButtons(
  buttons?: readonly AlertButton[]
): AlertButton[] | undefined {
  if (!buttons) return undefined;
  if (buttons.length < 2) return buttons.map((button) => ({ ...button }));

  const cancel = buttons.filter((button) => button.style === 'cancel');
  const normal = buttons.filter(
    (button) => button.style !== 'cancel' && button.style !== 'destructive'
  );
  const destructive = buttons.filter((button) => button.style === 'destructive');

  return [...cancel, ...normal, ...destructive].map((button) => ({ ...button }));
}

function renderNativeDialog(
  request: Confirmation,
  choose: (index: number | null) => void
): () => void {
  return showNativeConfirmation(request, choose);
}

let nativeScope = 'native';

const queue = createConfirmationQueue({
  scope: () => nativeScope,
  render: renderNativeDialog,
  onError: (error) => {
    console.error('확인창 동작 중 오류가 발생했습니다.', error);
  },
});

/** route가 바뀌면 이전 화면에서 열린/대기 중인 확인창을 모두 버린다. */
export function updateNativeConfirmationScope(scope: string): void {
  const next = scope || 'native';
  if (nativeScope === next) return;
  nativeScope = next;
  queue.checkScope();
}

/** 네이티브 구현. 웹은 같은 경로의 confirm-alert.web.ts가 담당한다. */
export function confirmAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  queue.enqueue(title, message ?? '', orderNativeAlertButtons(buttons) ?? []);
}
