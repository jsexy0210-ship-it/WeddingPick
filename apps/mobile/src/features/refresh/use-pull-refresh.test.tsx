import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { refreshReads } from '@/api/client';
import { showResultToast } from '@/features/navigation/result-toast';

import { PULL_REFRESH } from './pull-gesture';
import { PullRefreshControl } from './pull-refresh-control';
import { notifyRefreshFailed, usePullRefresh, type PullRefresh } from './use-pull-refresh';

/**
 * 당겨서 새로 고침 훅 — 한 번만 돌고, 캐시를 건너뛰는 창(`refreshReads`) 안에서 화면의 load를 부르며,
 * 끝나면 표시를 내린다.
 */
jest.mock('@/api/client', () => ({ refreshReads: jest.fn() }));
jest.mock('@/features/navigation/result-toast', () => ({ showResultToast: jest.fn() }));

let tree: ReactTestRenderer;
let latest: PullRefresh;

function Probe({ load }: { load: () => unknown }) {
  const pull = usePullRefresh(load);
  useEffect(() => {
    report(pull);
  });
  return null;
}

function report(pull: PullRefresh) {
  latest = pull;
}

/** 약속 몇 겹이 풀릴 때까지 — refreshReads → 최소 시간 타이머가 걸리기까지 두세 번 넘어간다. */
async function settle() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => tree?.unmount());
  jest.useRealTimers();
});

describe('usePullRefresh', () => {
  it('당기면 캐시를 건너뛰는 창 안에서 load를 부르고, 끝나면 표시를 내린다', async () => {
    const gate = deferred();
    const load = jest.fn();
    jest.mocked(refreshReads).mockImplementation(async (run) => {
      run();
      await gate.promise;
    });

    act(() => {
      tree = create(<Probe load={load} />);
    });
    expect(latest.refreshing).toBe(false);

    act(() => latest.onRefresh());
    expect(refreshReads).toHaveBeenCalledTimes(1);
    expect(jest.mocked(refreshReads).mock.calls[0][0]).toBe(load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(latest.refreshing).toBe(true);
    expect(latest.refreshControl.props).toMatchObject({ refreshing: true, onRefresh: latest.onRefresh });

    await act(async () => {
      gate.resolve();
      await settle();
    });
    // 너무 빨리 끝나도 최소 시간(500ms)은 보인다.
    expect(latest.refreshing).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(PULL_REFRESH.minVisibleMs);
      await settle();
    });
    expect(latest.refreshing).toBe(false);
  });

  it('도는 중에 또 당겨도 한 번만 돈다 — 끝난 뒤에는 다시 돈다', async () => {
    const gate = deferred();
    const load = jest.fn();
    jest.mocked(refreshReads).mockImplementation(async (run) => {
      run();
      await gate.promise;
    });

    act(() => {
      tree = create(<Probe load={load} />);
    });
    act(() => latest.onRefresh());
    act(() => latest.onRefresh());
    act(() => latest.refreshControl.props.onRefresh?.());
    expect(refreshReads).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve();
      await settle();
    });
    await act(async () => {
      jest.advanceTimersByTime(PULL_REFRESH.minVisibleMs);
      await settle();
    });
    expect(latest.refreshing).toBe(false);

    jest.mocked(refreshReads).mockImplementation(async (run) => {
      run();
    });
    act(() => latest.onRefresh());
    expect(refreshReads).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('refreshControl은 공용 PullRefreshControl이고 스킨 색 없이도 켜져 있다', () => {
    act(() => {
      tree = create(<Probe load={() => undefined} />);
    });
    expect(latest.refreshControl.type).toBe(PullRefreshControl);
    expect(latest.refreshControl.props).toMatchObject({ refreshing: false, enabled: true });
  });

  it('새로 고침 실패는 보이던 내용을 두고 한 줄로만 알린다', () => {
    notifyRefreshFailed();
    expect(showResultToast).toHaveBeenCalledWith('정보를 불러오지 못했어요');
  });
});
