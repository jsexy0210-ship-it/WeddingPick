import type { ActivityEvent } from '@weddingpick/api-contract';

import { API_URL } from '@/api/config';
import { loadToken } from '@/api/session';

/**
 * 활동 원장에 보낼 줄을 모았다가 묶어서 보낸다.
 *
 * **화면을 기다리게 하지 않는다.** `record`는 배열에 밀어 넣고 바로 돌아온다 —
 * `await` 할 것이 없고, 실패를 돌려주지도 않는다. 원장이 안 적혔다고 화면이
 * 달라질 일은 없어야 한다.
 *
 * **서버가 보는 것은 보내지 않는다.** 업체 열람 · 검색 · Pick 담기 · 제보 제출은
 * 서버가 요청을 받는 자리에서 이미 안다(`apps/api/src/activity-hook.ts`). 양쪽에서
 * 보내면 한 사건이 두 줄이 된다. 여기서 보내는 것은 **서버 호출이 따르지 않는
 * 행동**뿐이다 — 화면 진입, 그리고 서버를 부르지 않는 고르기.
 *
 * **같은 줄을 두 번 보내도 한 줄이다**(`clientEventId`). 그래서 실패한 묶음을
 * 마음 놓고 다시 보낼 수 있다.
 */

/** 한 번에 보내는 줄 수. 계약(`recordActivityRequestSchema`)의 상한과 같다. */
const BATCH_LIMIT = 50;

/** 큐가 차지 않아도 이 간격마다 보낸다. */
const FLUSH_INTERVAL_MS = 5_000;

/**
 * 기기에 쌓아둘 수 있는 한계. 넘으면 가장 오래된 줄을 버린다.
 *
 * 서버가 오래 안 되는 동안 큐가 끝없이 자라면 원장 때문에 앱이 무거워진다.
 * 원장은 화면보다 뒤에 선다.
 */
const QUEUE_LIMIT = 500;

let queue: ActivityEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

/**
 * 줄 하나를 큐에 넣는다. **기다리지 않는다.**
 *
 * 부르는 쪽은 `void record({...})`로 부르지 않아도 된다 — 애초에 Promise를
 * 돌려주지 않는다. 실수로 `await` 하는 자리가 생기지 않게 한 것이다.
 */
export function record(event: ActivityEvent): void {
  if (!API_URL) return;

  if (queue.length >= QUEUE_LIMIT) queue.shift();

  queue.push(event);

  if (queue.length >= BATCH_LIMIT) {
    void flush();

    return;
  }

  if (timer === null) {
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * 큐를 비운다. 앱이 배경으로 내려갈 때 부르면 남은 줄이 밀리지 않는다.
 *
 * **실패하면 큐로 되돌린다.** 서버 쪽과 다른 선택인데, 이유가 있다: 앱은 서버가
 * 잠깐 안 되는 동안(지하철·비행기) 원장을 들고 있다가 나중에 올리는 것이 정상이고,
 * 같은 줄을 다시 보내도 서버가 한 줄로 만든다.
 */
export async function flush(): Promise<void> {
  if (!API_URL) return;
  if (sending) return;
  if (queue.length === 0) return;

  const token = await loadToken();

  // 로그인하지 않은 사람의 줄은 원장에 들어갈 자리가 없다. 큐도 비운다.
  if (!token) {
    queue = [];

    return;
  }

  sending = true;

  const batch = queue.splice(0, BATCH_LIMIT);

  try {
    const response = await fetch(`${API_URL}/v1/activity/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: batch }),
    });

    /*
     * 400은 되돌리지 않는다. 서버가 받아주지 않는 줄은 다시 보내도 같은 답이고,
     * 그 사이 새 줄이 한계에 밀려 사라진다 — 고칠 수 없는 줄 하나 때문에 고칠 수
     * 있는 줄을 잃는다.
     */
    if (!response.ok && response.status >= 500) queue.unshift(...batch);
  } catch {
    queue.unshift(...batch);
  } finally {
    sending = false;
  }
}

/** 로그아웃·탈퇴가 부른다. 다음 사람의 원장에 앞사람 줄이 섞이지 않게. */
export function clear(): void {
  queue = [];

  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}
