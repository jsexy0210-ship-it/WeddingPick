import type { Confirmation } from './confirmation-queue';

export type ActiveNativeConfirmation = {
  readonly request: Confirmation;
  readonly choose: (index: number | null) => void;
};

let active: ActiveNativeConfirmation | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function showNativeConfirmation(
  request: Confirmation,
  choose: (index: number | null) => void
): () => void {
  active = { request, choose };
  emit();

  return () => {
    if (active?.request.id !== request.id) return;
    active = null;
    emit();
  };
}

export function subscribeNativeConfirmation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNativeConfirmation(): ActiveNativeConfirmation | null {
  return active;
}
