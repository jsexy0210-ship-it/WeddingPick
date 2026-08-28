import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { CapturedPage } from '@/features/capture/types';
import * as storage from '@/features/documents/storage';
import type { DocumentSet } from '@/features/documents/types';

type DocumentStoreValue = {
  sets: DocumentSet[];
  /** 첫 로드가 끝났는지. 빈 목록과 "아직 못 읽음"을 구분한다. */
  ready: boolean;
  saveDraft: (pages: CapturedPage[]) => Promise<DocumentSet>;
  removeSet: (id: string) => Promise<void>;
};

const DocumentStoreContext = createContext<DocumentStoreValue | null>(null);

/** 기기에 저장된 문서 묶음. 서버가 붙기 전까지 "내 웨딩"이 보는 유일한 데이터다. */
export function DocumentStoreProvider({ children }: { children: ReactNode }) {
  const [sets, setSets] = useState<DocumentSet[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    storage
      .loadDocumentSets()
      .then((loaded) => {
        if (active) setSets(loaded);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const saveDraft = useCallback(async (pages: CapturedPage[]) => {
    const saved = await storage.saveDocumentSet(pages);
    setSets((current) => [saved, ...current]);
    return saved;
  }, []);

  const removeSet = useCallback(async (id: string) => {
    await storage.deleteDocumentSet(id);
    setSets((current) => current.filter((set) => set.id !== id));
  }, []);

  const value = useMemo(
    () => ({ sets, ready, saveDraft, removeSet }),
    [sets, ready, saveDraft, removeSet]
  );

  return <DocumentStoreContext.Provider value={value}>{children}</DocumentStoreContext.Provider>;
}

export function useDocumentStore() {
  const value = useContext(DocumentStoreContext);

  if (!value) {
    throw new Error('useDocumentStore는 DocumentStoreProvider 안에서만 쓸 수 있다.');
  }

  return value;
}
