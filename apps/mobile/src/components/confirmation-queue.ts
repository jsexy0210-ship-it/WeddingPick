/** 알림 호출의 순서와 수명만 담당한다. DOM·React·네트워크에 의존하지 않는다. */
import type { DialogIcon } from './dialog-icon';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

export type Confirmation = {
  readonly id: number;
  readonly scope: string;
  readonly title: string;
  readonly message: string;
  readonly buttons: readonly AlertButton[];
  /** 정본 아이콘 원(ok · bad · warn). 선택 — 없으면 아이콘 없이 그린다. */
  readonly icon?: DialogIcon;
};

/** `confirmAlert`의 선택 인자. 기존 세 인자 호출은 그대로 동작한다. */
export type ConfirmAlertOptions = { icon?: DialogIcon };

type Options = {
  scope: () => string;
  render: (request: Confirmation, select: (index: number | null) => void) => () => void;
  onError: (error: unknown) => void;
};

export function createConfirmationQueue(options: Options) {
  let sequence = 0;
  let pending: Confirmation[] = [];
  let active: Confirmation | null = null;
  let dispose: (() => void) | null = null;
  let paused = false;

  function detach(): void {
    const cleanup = dispose;
    dispose = null;
    active = null;
    cleanup?.();
  }

  function drain(): void {
    if (active || paused) return;
    const scope = options.scope();
    pending = pending.filter((request) => request.scope === scope);
    const request = pending.shift();
    if (!request) return;
    active = request;
    try {
      dispose = options.render(request, (index) => select(request.id, index));
    } catch (error) {
      active = null;
      options.onError(error);
      drain();
    }
  }

  function select(id: number, index: number | null): void {
    const request = active;
    if (!request || request.id !== id) return;
    if (request.scope !== options.scope()) {
      reset();
      return;
    }
    if (index !== null && (!Number.isInteger(index) || index < 0 || index >= request.buttons.length)) return;
    // 실행 전 닫는다. 중복 클릭과 콜백 안에서 연 다음 알림의 중첩을 모두 방지한다.
    paused = true;
    detach();
    try {
      const result = index === null ? undefined : request.buttons[index]?.onPress?.();
      if (result && typeof result.then === 'function') {
        void result.catch((error: unknown) => {
          if (request.scope === options.scope()) options.onError(error);
        });
      }
    } catch (error) {
      options.onError(error);
    } finally {
      paused = false;
      drain();
    }
  }

  function reset(): void {
    pending = [];
    detach();
  }

  return {
    enqueue(title: string, message: string, buttons: readonly AlertButton[], icon?: DialogIcon): void {
      if (active && active.scope !== options.scope()) reset();
      // 호출자가 나중에 원래 배열을 변경해도 열려 있는 동작은 바뀌지 않는다.
      pending.push({ id: ++sequence, scope: options.scope(), title, message,
        buttons: buttons.map((button) => ({ ...button })), ...(icon ? { icon } : {}) });
      drain();
    },
    checkScope(): void {
      if (active && active.scope !== options.scope()) reset();
    },
    reset,
  };
}
