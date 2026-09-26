import type { FaqItemResponse } from '@weddingpick/api-contract';
import { useCallback, useEffect, useRef, useState } from 'react';

import { listFaq } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { notifyRefreshFailed } from '@/features/refresh/use-pull-refresh';

/**
 * 자주 묻는 것 — 네 화면이 같은 것을 본다.
 *
 * **2026-09-16 대표 지시로 서버에서 받아 온다.** 그전에는 `packages/domain`의 배열을
 * 화면이 직접 들고 있었고, 관리자 화면에서 무엇을 고쳐도 사용자에게 닿지 않았다.
 *
 * 부르는 곳은 문의하기(`my/contact`) · 안내(`my/guide`) · 질문 상세(`my/faq/[faqKey]`)
 * 셋이다. **한 자리에서 받는다** — 화면마다 따로 부르면
 * 어느 화면은 채운 답을 쓰고 어느 화면은 빈 목록을 그리게 된다.
 *
 * 로그인이 필요 없다. FAQ는 로그인하지 않아도 보는 화면이다.
 */
export type FaqState = {
  items: readonly FaqItemResponse[];
  loading: boolean;
  /** 받아오지 못했다. 화면이 「불러오지 못했어요」와 다시 시도를 그린다. */
  failed: boolean;
  reload: () => void;
  /** 당겨서 새로 고침 — 보이던 질문은 그대로 두고 다시 받는다. 실패하면 토스트만 띄운다. */
  refresh: () => void;
};

export function useFaq(): FaqState {
  const [items, setItems] = useState<readonly FaqItemResponse[]>([]);
  /* 서버 주소가 없는 빌드는 부를 곳이 없다 — 기다리게 두지 않고 곧바로 빈 상태로 간다. */
  const [loading, setLoading] = useState(isServerConfigured);
  const [failed, setFailed] = useState(false);
  const [rev, setRev] = useState(0);
  const alive = useRef(true);
  /** 이번 다시 받기가 당겨서 새로 고침인가 — 목록을 비우지 않는다. */
  const quiet = useRef(false);

  const reload = useCallback(() => {
    quiet.current = false;
    setRev((value) => value + 1);
  }, []);
  const refresh = useCallback(() => {
    quiet.current = true;
    setRev((value) => value + 1);
  }, []);

  useEffect(() => {
    alive.current = true;

    if (!isServerConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 부를 곳이 없다는 것은 즉시 알 수 있다
      setLoading(false);

      return () => {
        alive.current = false;
      };
    }

    const keep = quiet.current;
    quiet.current = false;
    if (!keep) {
      setLoading(true);
      setFailed(false);
    }

    listFaq()
      .then((data) => {
        if (!alive.current) return;
        setItems(data.items);
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (!alive.current) return;
        if (keep) notifyRefreshFailed();
        /* 받아온 것이 있으면 그것을 지우지 않는다 — 빈 화면보다 지난 답이 낫다. */
        setFailed(true);
        setLoading(false);
      });

    return () => {
      alive.current = false;
    };
  }, [rev]);

  return { items, loading, failed, reload, refresh };
}
