/**
 * 비밀번호 시도 제한. 같은 키(이메일)로 창 안에서 한도를 넘으면 잠깐 막는다.
 *
 * 프로세스 메모리에만 둔다 — 인스턴스가 여럿이면 각자 센다. 그래도 한 인스턴스에서
 * 무제한으로 맞춰보는 것은 막힌다. 영구 저장이 필요해지면 그때 옮긴다.
 */
export type AttemptLimiter = {
  /** 지금 시도해도 되는가. */
  allowed(key: string): boolean;
  /** 실패를 하나 센다. */
  fail(key: string): void;
  /** 창 안에 남아 있는 실패 횟수. 오류 문구가 "N번 더 시도할 수 있어요"를 채우는 데 쓴다. */
  failCount(key: string): number;
  /** 성공하면 기록을 지운다. */
  reset(key: string): void;
};

export function createAttemptLimiter(options: {
  max: number;
  windowMs: number;
  now?: () => number;
}): AttemptLimiter {
  const now = options.now ?? Date.now;
  const failures = new Map<string, number[]>();

  function recent(key: string): number[] {
    const cutoff = now() - options.windowMs;
    const kept = (failures.get(key) ?? []).filter((at) => at > cutoff);

    if (kept.length === 0) failures.delete(key);
    else failures.set(key, kept);

    return kept;
  }

  return {
    allowed(key) {
      return recent(key).length < options.max;
    },
    fail(key) {
      failures.set(key, [...recent(key), now()]);
    },
    failCount(key) {
      return recent(key).length;
    },
    reset(key) {
      failures.delete(key);
    },
  };
}
