/**
 * 온보딩 5장. 디자인 핸드오프 1번이 문구와 예시 카드까지 정했다.
 *
 * 화면이 아니라 자료로 둔 이유는, 이 다섯 장이 서비스가 무엇을 하는지 말하는
 * 유일한 자리이기 때문이다 — 문구가 화면 코드 사이에 흩어지면 한 장만 고쳐지고
 * 나머지는 옛말을 계속한다.
 */
export type OnboardingRow = { label: string; value: string };

export type OnboardingStep = {
  /** 줄바꿈은 수동이다. 핸드오프가 t2에 그렇게 적었다. */
  headline: readonly string[];
  body: string;
  card: readonly OnboardingRow[];
  caption: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    headline: ['같은 업체도', '결제 금액은 달라요'],
    body: '업체 안내 가격과 실제 결제 사례를 한눈에 비교해보세요.',
    card: [
      { label: '업체 안내', value: '390만원' },
      { label: '실제 결제 구간', value: '265~305만원' },
    ],
    caption: '결제인증 34건 · 최근 12개월',
  },
  {
    headline: ['결제내역 한 장으로', '가격 차이를 확인해보세요'],
    body: '결제내역이나 영수증을 등록하면 필요한 정보만 읽어 자동으로 정리해요.',
    card: [
      { label: '내 결제', value: '312만원' },
      { label: '유사 결제 구간', value: '265~305만원' },
    ],
    caption: '원본 이미지는 24시간 내 삭제돼요',
  },
  {
    headline: ['둘이 함께', '결혼 준비를 정리해요'],
    body: '지출내역과 웨딩 스케줄을 공유하고 준비 상황을 함께 확인해보세요.',
    card: [
      { label: '지금까지 결제', value: '872만원' },
      { label: '남은 준비', value: '12개' },
    ],
    caption: '초대 코드로 간편하게 연결해요',
  },
  {
    headline: ['웨딩 미션을 완료하면', '모든 기능이 열려요'],
    body: '웨딩픽을 이용하면서 하나씩 완료해보세요.',
    card: [
      { label: '업체를 살펴봐요', value: '바로 시작' },
      { label: '준비를 정리해요', value: '로그인' },
      { label: '배우자와 함께해요', value: '초대 코드' },
      { label: '결제 데이터를 확인해요', value: '결제내역 1건' },
    ],
    caption: '진행 상황은 MY에서 확인할 수 있어요',
  },
  {
    headline: ['홈은 원하는 순서로', '바꿀 수 있어요'],
    body: '자주 보는 항목을 위로 올리고 필요 없는 항목은 숨겨보세요.',
    card: [
      { label: '웨딩 스케줄', value: '표시' },
      { label: '지출 현황', value: '표시' },
      { label: '관심업체', value: '숨김' },
    ],
    caption: '홈 맨 아래 홈 편집에서 바꿀 수 있어요',
  },
];

/** 마지막 장에서만 다른 말을 쓴다. */
export function ctaLabel(index: number): string {
  return index === ONBOARDING_STEPS.length - 1 ? '웨딩픽 시작하기' : '다음';
}
