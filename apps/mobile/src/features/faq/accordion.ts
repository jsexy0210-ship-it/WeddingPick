/**
 * FAQ 아코디언(WP-MY-013)의 여닫기 — 2026-09-26 대표 지시 「전부 닫힌 채로 연다」.
 *
 * 처음 상태는 빈 집합(`INITIAL_EXPANDED`)이고, 누른 질문 하나만 여닫는다 — 다른
 * 질문의 상태는 그대로 둔다(한 번에 하나만 열리게 하라는 지시는 없다).
 */
export const INITIAL_EXPANDED: ReadonlySet<string> = new Set();

export function toggleExpanded(now: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(now);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * 꺾쇠 방향 — 닫힘은 아래(∨), 열림은 위(∧). `chevronRight`(>) 아이콘을 돌려 그린다:
 * 90°면 아래, -90°면 위.
 */
export function chevronRotation(open: boolean): '90deg' | '-90deg' {
  return open ? '-90deg' : '90deg';
}
