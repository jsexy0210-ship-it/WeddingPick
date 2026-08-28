import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { captureReducer } from '@/features/capture/capture-reducer';
import type { CapturedPage } from '@/features/capture/types';

type CaptureDraftValue = {
  pages: CapturedPage[];
  addPages: (pages: CapturedPage[]) => void;
  removePage: (id: string) => void;
  clearDraft: () => void;
};

const CaptureDraftContext = createContext<CaptureDraftValue | null>(null);

/**
 * 촬영 → 문서 확인 → (이후) 분석 요청까지 이어지는 동안의 문서 묶음을 들고 있는다.
 * 화면을 넘나들며 장을 추가·삭제하므로 화면 상태가 아니라 흐름 단위 상태로 둔다.
 * 서버 저장은 아직 없다 — 앱을 닫으면 사라진다.
 */
export function CaptureDraftProvider({ children }: { children: ReactNode }) {
  const [pages, dispatch] = useReducer(captureReducer, []);

  const addPages = useCallback((next: CapturedPage[]) => dispatch({ type: 'add', pages: next }), []);
  const removePage = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const clearDraft = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo(
    () => ({ pages, addPages, removePage, clearDraft }),
    [pages, addPages, removePage, clearDraft]
  );

  return <CaptureDraftContext.Provider value={value}>{children}</CaptureDraftContext.Provider>;
}

export function useCaptureDraft() {
  const value = useContext(CaptureDraftContext);

  if (!value) {
    throw new Error('useCaptureDraft는 CaptureDraftProvider 안에서만 쓸 수 있다.');
  }

  return value;
}
