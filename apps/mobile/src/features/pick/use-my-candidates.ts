import type { CandidateListResponse, CurrentUser, VendorCandidate } from '@weddingpick/api-contract';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { addCandidate, ensureWedding, getCurrentUser, listCandidates, removeCandidate } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';

/**
 * 내 Pick 후보 — 검색 결과 카드 · 업체 상세 · 비교 dock이 같은 것을 본다.
 *
 * Pick 버튼은 어디에 있든 **같은 후보 목록**에 담는다(SPEC §13.1). 화면마다 «담은 것»을
 * 따로 기억하면 검색에서 Pick했어요가 상세에서는 Pick하기로 보인다.
 *
 * 로그인 전이면 목록이 비어 있고 `pick()`은 `'login'`을 돌려준다 — 첫 Pick이 대표 로그인
 * 트리거라(v3.10 §3) 시트를 띄우는 것은 화면이 한다.
 */
export type PickResult = 'picked' | 'login' | 'error';

export function useMyCandidates() {
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [weddingId, setWeddingId] = useState<string | null>(null);
  /** 저장 요청이 진행 중인 업체. 두 번 누르는 것을 막는다. */
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!isServerConfigured) return;
    const token = await loadToken();
    if (!token) return;
    const me = await getCurrentUser();
    if (!alive.current) return;
    setMe(me);
    setWeddingId(me.weddingId ?? null);
    if (!me.weddingId) {
      setPage(null);
      return;
    }
    const next = await listCandidates(me.weddingId);
    if (alive.current) setPage(next);
  }, []);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 응답이 온 뒤에야 상태를 바꾼다
    reload().catch(() => undefined);
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const byVendor = useMemo(() => {
    const map = new Map<string, VendorCandidate>();
    for (const group of page?.groups ?? []) {
      for (const candidate of group.candidates) map.set(candidate.vendorId, candidate);
    }
    return map;
  }, [page]);

  const candidateFor = useCallback((vendorId: string) => byVendor.get(vendorId) ?? null, [byVendor]);

  const pick = useCallback(
    async (vendorId: string): Promise<PickResult> => {
      if (busyVendorId) return 'error';
      setBusyVendorId(vendorId);
      try {
        if (isServerConfigured && !(await loadToken())) return 'login';
        const id = weddingId ?? (await ensureWedding());
        await addCandidate(id, vendorId);
        await reload();
        return 'picked';
      } catch {
        return 'error';
      } finally {
        if (alive.current) setBusyVendorId(null);
      }
    },
    [busyVendorId, reload, weddingId]
  );

  const unpick = useCallback(
    async (candidate: VendorCandidate): Promise<boolean> => {
      if (busyVendorId || !weddingId) return false;
      setBusyVendorId(candidate.vendorId);
      try {
        await removeCandidate(weddingId, candidate.id);
        await reload();
        return true;
      } catch {
        return false;
      } finally {
        if (alive.current) setBusyVendorId(null);
      }
    },
    [busyVendorId, reload, weddingId]
  );

  /** 배우자 표시 이름. 연결 전이면 null — 해제 시트가 «배우자»라고 부른다. */
  const partnerName = me?.spouseLinked ? (me.partnerDisplayName ?? null) : null;

  return { me, page, weddingId, partnerName, candidateFor, pick, unpick, reload, busyVendorId };
}
