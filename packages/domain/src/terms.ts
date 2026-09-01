/**
 * 사용자에게 보이는 표준 용어. 통합정책 v3.1 §10~11 · v3.3.
 *
 * **안과 밖의 말을 나눈다.** 정책·DB·API·관리자는 `실제 결제 데이터`,
 * `결제내역 제보`, `추천 이유` 같은 정확한 관리 용어를 그대로 쓴다. 사용자
 * 화면에서만 이 파일의 말로 바꾼다 — 관리 용어를 화면에 그대로 내보내면
 * 시스템이 자기 사정을 사용자에게 설명하는 꼴이 된다.
 *
 * 한곳에 모아두는 이유는 화면마다 조금씩 다르게 적히기 때문이다. 실제로
 * `관심업체`와 `후보`와 `찜`이 한 앱 안에 같이 있었다.
 *
 * v3.3이 v3.1을 덮어쓴 자리가 있다(`실제 결제 데이터` → `확인된 정보`,
 * `추천 이유` → `이런 점이 잘 맞아요`). 뒤에 온 쪽을 쓴다.
 */

export const TERMS = {
  /** 업체 찾기. `탐색`을 쓰지 않는다. */
  search: '검색',
  /** 후보 고르기. `찜`·`좋아요`·`선택`과 섞어 쓰지 않는다. */
  pick: 'Pick',
  /** 골라둔 곳 목록. */
  picked: 'Pick한 곳',
  /** 검증된 결제정보. v3.3이 `실제 결제 데이터`를 사용자 화면에서 이 말로 바꿨다. */
  verifiedData: '확인된 정보',
  /** 중앙값의 사용자 표기. 통계는 그대로 중앙값이고 이름만 바꾼다. */
  baseAmount: '기준금액',
  /** 집계 기간. */
  period: '최근 12개월',
  /** 추가비용. */
  extraCost: '별도로 확인할 비용',
  /** 업체가 제공한 내용. */
  vendorNotice: '업체 안내',
  /** 사용자 평가 영역. */
  experience: '이용한 사람들의 경험',
  /** 사용자가 쓴 글. `리뷰`를 쓰지 않는다. */
  review: '후기',
  reviewWrite: '후기 작성',
  /** 자료 제공 행동. */
  report: '제보',
  reportCta: '제보하기',
  myReports: '내 제보내역',
  priceReport: '가격 제보',
  directInput: '직접입력',
  /** 커플 공동 공간. */
  ourWedding: '우리웨딩',
  spouse: '배우자',
  /** 프로모션. v3.3이 `현재 혜택·이벤트`를 사용자 화면에서 이 말로 바꿨다. */
  benefits: '받을 수 있는 혜택',
  /** 개인 추천 영역. */
  todaysPick: '오늘의 Pick',
  /** 추천 근거. v3.3이 `추천 이유`를 사용자 화면에서 이 말로 바꿨다. */
  recommendReason: '이런 점이 잘 맞아요',
  guest: '비회원',
  member: '회원',
} as const;

/** `기준금액`이 무슨 값인지 묻는 사람에게. 정책이 문장까지 정했다. */
export const BASE_AMOUNT_HELP = 'Pick 인증으로 확인된 금액의 중앙값이에요.';

/** 데이터가 모자랄 때. */
export const NOT_ENOUGH_DATA = '아직 데이터가 적어요';
export const CANNOT_COMPARE_YET = '아직 비교하기 어려워요';
export const COMPARE_LATER = '조금 더 모이면 비교할 수 있어요';
export const MANY_CONFIRMED = '많이 확인된 곳';

/**
 * 금액 옆에 늘 함께 적는 줄. v3.1 §11.
 *
 *   `확인된 정보 12건 · 최근 12개월 · 기준금액 168만원`
 *
 * 숫자만 떼어놓으면 그것이 어디서 왔는지 모르는 채로 읽히고, 그때부터 그 숫자는
 * 우리가 정한 값처럼 보인다.
 */
export function dataCaption(input: {
  count: number;
  period?: string;
  baseAmount?: string;
}): string {
  const parts = [`${TERMS.verifiedData} ${input.count}건`, input.period ?? TERMS.period];

  if (input.baseAmount) parts.push(`${TERMS.baseAmount} ${input.baseAmount}`);

  return parts.join(' · ');
}
