import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';

import { refreshReads } from '@/api/client';
import { showResultToast } from '@/features/navigation/result-toast';
import strings from '../../../../../spec/strings.ko.json';

import { PULL_REFRESH } from './pull-gesture';
import { PullRefreshControl, type PullRefreshControlProps } from './pull-refresh-control';

export type PullRefresh = {
  /** 당겨서 새로 고치는 중인가. 화면 첫 로딩과는 다르다 — 이때는 내용을 그대로 둔다. */
  refreshing: boolean;
  /** 당기지 않고 코드에서 새로 고칠 때. 이미 도는 중이면 한 번 더 부르지 않는다. */
  onRefresh: () => void;
  /** 스크롤 목록의 `refreshControl`에 그대로 넣는다. */
  refreshControl: ReactElement<PullRefreshControlProps>;
};

/**
 * 당겨서 새로 고침 — 화면 하나에 한 줄로 붙인다(2026-09-26 대표 지시 「화면 자체를 밑으로 내리면
 * 새로고침 진행한다」).
 *
 * ```tsx
 * const pull = usePullRefresh(() => load({ keep: true }));
 * <ScrollView refreshControl={pull.refreshControl}>…
 * ```
 *
 * - `load`는 화면이 원래 쓰던 읽기 함수다. 부르는 동안 떠나는 읽기는 **캐시를 건너뛴다**
 *   (`refreshReads` — api/client.ts). 표시는 그 읽기가 전부 돌아와야 내려간다.
 * - **내용을 비우지 않는다.** 화면의 load가 첫 로딩처럼 뼈대로 바꾸는 자리는 `keep`을 받아 그대로 둔다.
 * - 이미 도는 중에 또 당겨도 한 번만 돈다. 너무 빨리 끝나도 `minVisibleMs`(500)만큼은 보인다.
 * - 네이티브는 OS `RefreshControl`, 웹은 같은 이름의 웹 컨트롤(`pull-refresh-control.web.tsx`)이다.
 */
export function usePullRefresh(load: () => unknown, options: { enabled?: boolean } = {}): PullRefresh {
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    const startedAt = Date.now();
    void refreshReads(load)
      .then(() => new Promise((done) => setTimeout(done, Math.max(0, PULL_REFRESH.minVisibleMs - (Date.now() - startedAt)))))
      .finally(() => {
        running.current = false;
        if (mounted.current) setRefreshing(false);
      });
  }, [load]);

  return {
    refreshing,
    onRefresh,
    refreshControl: (
      <PullRefreshControl refreshing={refreshing} onRefresh={onRefresh} enabled={options.enabled ?? true} />
    ),
  };
}

/**
 * 새로 고침이 실패했을 때 — 이미 보이는 내용은 그대로 두고 한 줄만 알린다(「정보를 불러오지 못했어요」).
 * 첫 로딩의 실패는 지금처럼 화면의 오류 화면이 받는다.
 */
export function notifyRefreshFailed(): void {
  showResultToast(strings.journey.loadFailed);
}
