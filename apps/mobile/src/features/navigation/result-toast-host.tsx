import { useEffect, useState } from 'react';

import { Toast } from '@weddingpick/ui';
import { subscribeResultToast, type ResultToast } from './result-toast';

export function ResultToastHost() {
  const [toast, setToast] = useState<ResultToast | null>(null);

  useEffect(() => subscribeResultToast(setToast), []);

  return <Toast key={toast?.id ?? 0} message={toast?.message ?? null} onHidden={() => {
    setToast((current) => current?.id === toast?.id ? null : current);
  }} />;
}
