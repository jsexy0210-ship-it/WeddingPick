import type { FavoriteVendor, FavoriteVendorListResponse } from '@weddingpick/api-contract';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  addFavoriteVendor,
  listFavoriteVendors,
  removeFavoriteVendor,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';

export type FavoriteToggleResult = 'favorited' | 'unfavorited' | 'login' | 'error';

/**
 * 관심업체(하트).
 *
 * Pick 후보와 완전히 별도다. 관심업체는 개인 탐색 상태이고 웨딩/배우자와 공유하지 않는다.
 * 개수 상한도 없다.
 */
export function useFavoriteVendors() {
  const [page, setPage] = useState<FavoriteVendorListResponse | null>(null);
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!isServerConfigured) {
      if (alive.current) setPage({ items: [], total: 0 });
      return;
    }
    const token = await loadToken();
    if (!token) {
      if (alive.current) setPage(null);
      return;
    }
    const next = await listFavoriteVendors();
    if (alive.current) setPage(next);
  }, []);

  useEffect(() => {
    alive.current = true;
    reload().catch(() => undefined);
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const byVendor = useMemo(() => {
    const map = new Map<string, FavoriteVendor>();
    for (const item of page?.items ?? []) map.set(item.vendorId, item);
    return map;
  }, [page]);

  const favoriteFor = useCallback(
    (vendorId: string) => byVendor.get(vendorId) ?? null,
    [byVendor]
  );

  const toggle = useCallback(async (vendorId: string): Promise<FavoriteToggleResult> => {
    if (busyVendorId) return 'error';
    setBusyVendorId(vendorId);
    try {
      if (isServerConfigured && !(await loadToken())) return 'login';
      if (byVendor.has(vendorId)) {
        await removeFavoriteVendor(vendorId);
        await reload();
        return 'unfavorited';
      }
      await addFavoriteVendor(vendorId);
      await reload();
      return 'favorited';
    } catch {
      return 'error';
    } finally {
      if (alive.current) setBusyVendorId(null);
    }
  }, [busyVendorId, byVendor, reload]);

  return { page, favoriteFor, toggle, reload, busyVendorId };
}
