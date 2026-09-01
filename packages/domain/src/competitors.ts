/**
 * 경쟁 서비스 모니터링. 통합정책 v3.12.
 *
 * 무엇을 보는가가 아니라 **무엇을 하지 않는가**가 이 파일의 요점이다.
 *
 *   1. **기능을 그대로 복제하지 않는다.** 경쟁 서비스가 무엇을 하는지 아는 것과
 *      그것을 베끼는 것은 다르다. 정책이 "웨딩픽 방식으로 재설계"라고 적었다.
 *   2. **이미 정책에 있는 기능을 다시 넣지 않는다.** 경쟁사에서 봤다는 이유로
 *      같은 것을 한 번 더 만들면 화면에 같은 일을 하는 자리가 둘이 된다.
 *   3. **긁지 않는다.** 이 목록은 무엇을 지켜볼지 적어둔 이름표일 뿐이고,
 *      그 사이트를 자동으로 읽어오는 코드는 여기에도 어디에도 없다.
 *      제3자 웨딩·후기 사이트를 크롤링하지 않는다는 규칙은 그대로다.
 */

/** 지금 가장 가까이 보는 곳. */
export const PRIMARY_COMPETITOR = 'WEDDiC';

/** 함께 보는 비교군. 순서는 우선순위가 아니다. */
export const COMPETITOR_WATCHLIST = [
  '웨딕(WEDDiC)',
  '이너웨딩',
  '오딩',
  '웨딩북',
  '아이웨딩',
  '다이렉트 결혼준비',
  '우리결혼준비',
  '결준노트',
] as const;

export type Competitor = (typeof COMPETITOR_WATCHLIST)[number];

/**
 * 새 경쟁 서비스를 목록에 더할 때 지켜야 하는 것.
 *
 * 목록만 늘리는 것은 쉽고, 늘어난 목록은 아무도 안 본다. 무엇 때문에 더하는지를
 * 함께 적게 한다.
 */
export type CompetitorNote = {
  name: string;
  /** 왜 지켜보는가. 한 줄로 못 적겠으면 지켜볼 이유가 없는 것이다. */
  why: string;
};

/**
 * 경쟁 기능을 보고 무엇을 할 것인가.
 *
 * 세 갈래뿐이다. `복제`는 없다.
 */
export const COMPETITOR_RESPONSES = ['redesign', 'already_covered', 'not_our_direction'] as const;

export type CompetitorResponse = (typeof COMPETITOR_RESPONSES)[number];

export const COMPETITOR_RESPONSE_RULE: Record<CompetitorResponse, string> = {
  /** 같은 문제를 웨딩픽 방식으로 다시 푼다. */
  redesign: '같은 문제를 웨딩픽 방식으로 다시 설계한다',
  /** 이미 정책에 있다. 중복으로 만들지 않는다. */
  already_covered: '이미 정책에 있는 기능이라 더하지 않는다',
  /** 상담·예약·판매·중개 쪽이면 우리 방향이 아니다. */
  not_our_direction: '상담·예약·판매·중개 중심이라 우리 방향이 아니다',
};

/**
 * 이 기능이 우리 방향인가.
 *
 * v3.12 §5가 서비스 정체성을 못박았다 — 웨딩픽은 사용자가 **직접 고르도록 돕는**
 * 서비스지 대신 상담하고 예약해주는 서비스가 아니다.
 */
export const OUT_OF_DIRECTION = ['상담', '예약', '판매', '패키지 중개'] as const;

export function isOutOfDirection(feature: string): boolean {
  return OUT_OF_DIRECTION.some((word) => feature.includes(word));
}
