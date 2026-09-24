import { formatCount } from './format-number';

/**
 * 공공 통계를 웨딩피드에 넣는 규칙.
 *
 * 2026-09-24 대표 지시 — 「피드에는 써도 된다. 진행해」. 공공 API · 파일로 받은
 * 숫자를 **웨딩피드 자동 작성(관리자 피드 자동생성)에만** 넘긴다. Gemini가 공공
 * API를 부르지 않는다 — 서버가 받아 둔 값을 주제와 함께 건넬 뿐이고, 부르는 파일은
 * 그대로 `wedding-feed-writer.ts` 하나다(`gemini-scope.test.ts`).
 *
 * **숫자는 넘긴 것만 쓴다.** 피드 규칙 1번(「숫자를 지어내지 마라」) 때문에 지금까지
 * 피드에는 숫자가 없었다. 통계 주제는 넘긴 숫자를 쓸 수 있지만, 본문의 숫자가 넘긴
 * 숫자와 하나라도 다르면 그 글을 버린다(`findUnlistedNumbers`).
 *
 * **출처 줄은 모델이 아니라 서버가 붙인다**(`statSourceLine`). 공공데이터포털
 * 이용허락의 출처 표시를 모델이 빠뜨리거나 틀리게 적을 수 있다.
 */
export type PublicStat = {
  key: string;
  /** 모델에게 건네는 이름. 예: 「서울 혼인 건수」 */
  label: string;
  value: number;
  /** 「건」 · 「곳」처럼 숫자 뒤에 붙는 말. */
  unit: string;
  /** 기준 시점. 예: 「2025년」 */
  period: string;
  /** 제공 기관. 예: 「서울특별시」 */
  sourceName: string;
  /** 공공데이터포털의 해당 데이터 페이지. */
  sourceUrl: string;
};

/** 출처 주소는 공공데이터포털 데이터 페이지만 받는다 — 아무 주소나 출처로 박히지 않게. */
export const PUBLIC_STAT_SOURCE_URL_PATTERN = /^https:\/\/(www\.)?data\.go\.kr\/data\/\d+\//;

export function formatStatValue(stat: Pick<PublicStat, 'value' | 'unit'>): string {
  return `${formatCount(stat.value)}${stat.unit}`;
}

/** 모델에게 건네는 한 줄. 값은 이 모양 그대로 옮겨 쓰게 한다. */
export function formatStatFact(stat: PublicStat): string {
  return `${stat.label}: ${formatStatValue(stat)} (${stat.period} · ${stat.sourceName})`;
}

const NUMBER_PATTERN = /\d[\d,]*(?:\.\d+)?/g;

function numbersIn(text: string): string[] {
  return (text.match(NUMBER_PATTERN) ?? []).map((n) => n.replace(/,/g, ''));
}

/**
 * 글에 든 숫자 중 넘긴 통계에 없는 것.
 *
 * 비어 있어야 통과다. 쉼표는 떼고 비교한다 — 「12,345」와 「12345」는 같은 값이다.
 * 기준 시점(「2025년」)의 숫자도 넘긴 것으로 친다.
 */
export function findUnlistedNumbers(text: string, stats: readonly PublicStat[]): string[] {
  const allowed = new Set(stats.flatMap((stat) => numbersIn(formatStatFact(stat))));

  return [...new Set(numbersIn(text).filter((n) => !allowed.has(n)))];
}

/** 본문 끝에 서버가 붙이는 출처 줄. */
export function statSourceLine(stats: readonly PublicStat[]): string {
  const sources = [...new Set(stats.map((stat) => `${stat.sourceName} ${stat.period}`))];

  return `출처: ${sources.join(' · ')} (공공데이터포털)`;
}
