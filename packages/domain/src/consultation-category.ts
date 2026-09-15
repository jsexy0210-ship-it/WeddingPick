/**
 * 상담기록의 분류와 통과 판정.
 *
 * **분류는 추출 스키마를 고르는 값이지 업종이 아니다**(2026-09-14 대표 결정 P-1).
 * `VENDOR_CATEGORIES`는 13종 그대로 두고 여기만 14종을 센다 — 업종을 늘리면 홈 ·
 * Pick · 검색 · 온보딩이 전부 따라 바뀌는데, 상담 녹음을 읽는 일에 그만한 값을
 * 치를 이유가 없다.
 *
 * 업체는 사용자가 먼저 고르고(요청 §29) 업체 레코드가 제 업종을 이미 갖고 있다.
 * 그래서 「아이폰스냅을 어느 업종에 매핑하나」를 풀 필요가 없다 — 매핑하지 않는다.
 */

/**
 * 상담을 읽어낼 수 있는 분류 14종.
 *
 * `iphone_snap` · `wedding_video` · `suit` 셋은 **여기에만 있다.** 나머지 열하나는
 * 업종과 이름이 같지만, 같은 목록이 아니라 우연히 겹치는 것이다.
 *
 * **플래너는 `wedding_info_company`로 들어간다**(2026-09-14 대표 결정 P-3).
 * CLAUDE.md 2026-09-11 지시가 「플래너」를 업종에서 뺐고 그 규칙을 그대로 지킨다.
 */
export const CONSULTATION_CATEGORIES = [
  'wedding_info_company',
  'hall',
  'studio',
  'dress',
  'makeup',
  'hair',
  'snap',
  'iphone_snap',
  'wedding_video',
  'suit',
  'goods',
  'bouquet',
  'dowry',
  'honeymoon',
] as const;

export type ConsultationCategory = (typeof CONSULTATION_CATEGORIES)[number];

/**
 * 화면에 쓰는 이름.
 *
 * 업종과 겹치는 열하나는 `VENDOR_CATEGORY_LABEL`과 **글자까지 같아야 한다** —
 * 같은 것을 두 이름으로 부르지 않는다(2026-09-11 대표 지시). 시험이 지킨다.
 */
export const CONSULTATION_CATEGORY_LABEL: Record<ConsultationCategory, string> = {
  wedding_info_company: '결정사',
  hall: '웨딩홀',
  studio: '스튜디오',
  dress: '드레스',
  makeup: '메이크업',
  hair: '헤어변형',
  snap: '본식스냅',
  iphone_snap: '아이폰스냅',
  wedding_video: '본식영상',
  suit: '예복',
  goods: '예물',
  bouquet: '부케',
  dowry: '혼수',
  honeymoon: '허니문',
};

/**
 * 웨딩 상담은 맞지만 읽어내지 않는 것.
 *
 * **청첩장은 업종으로는 살아 있다**(2026-09-14 대표 결정 P-2) — A-12의 청첩장 수집
 * 결정과 이번 미지원 지정이 둘 다 유효하다. 상담 녹음만 안 받는다.
 *
 * 한복은 업종에서도 뺀 것이라(A-15) 여기에도 없다.
 */
export const UNSUPPORTED_CONSULTATION_LABELS = ['청첩장', '한복', '답례품'] as const;

/** 사전 판정 셋. 요청 §5. */
export const CONSULTATION_STATUSES = [
  'SUPPORTED_WEDDING_CONSULTATION',
  'UNSUPPORTED_WEDDING_CONSULTATION',
  'NOT_WEDDING_CONSULTATION',
] as const;

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

/**
 * 상담인지 아닌지를 가르는 신호.
 *
 * 앞의 둘은 **성격**이고 뒤의 넷은 **내용**이다. 나눠 두는 이유는 세는 법이 다르기
 * 때문이다 — 성격 둘은 각각 있어야 하고, 내용 넷은 그중 둘이면 된다.
 */
export type ConsultationSignals = {
  /** 업체와 고객이 주고받는 자리인가 */
  vendorCustomerConversation: boolean;
  /** 상품·서비스 설명이 있는가 */
  productOrServiceDiscussion: boolean;
  pricingMentioned: boolean;
  scheduleMentioned: boolean;
  contractMentioned: boolean;
  benefitMentioned: boolean;
};

/** 내용 신호. 이 넷 중 둘 이상이어야 한다(요청 §4-4). */
export const SUBSTANCE_SIGNALS = [
  'pricingMentioned',
  'scheduleMentioned',
  'contractMentioned',
  'benefitMentioned',
] as const satisfies readonly (keyof ConsultationSignals)[];

export const MIN_SUBSTANCE_SIGNALS = 2;

/**
 * 확신 기준(요청 §7).
 *
 * **두 값 사이는 사람에게 묻는 구간이다.** 애매한 것을 자동으로 통과시키면 엉뚱한
 * 녹음이 들어오고, 자동으로 막으면 진짜 상담이 거절당한다. 둘 다 사용자가 알 수
 * 없는 방식으로 틀린다.
 */
export const CONSULTATION_CONFIDENCE = { auto: 0.8, ask: 0.5 } as const;

/**
 * 판정 다음에 무엇을 하나.
 *
 * **`analyze`만 돈을 더 쓴다.** 나머지는 2차 호출을 부르지 않고 끝난다 — 한 시간짜리
 * 녹음 하나가 48원이고, 1차 판정은 0.4원이다.
 */
export type ConsultationDecision =
  | { kind: 'analyze' }
  | { kind: 'ask'; notice: string }
  | {
      kind: 'stop';
      reason: 'not_wedding' | 'unsupported' | 'low_confidence';
      notice: string;
    };

/** 화면이 그대로 보여줄 말. 원본은 `spec/strings.ko.json`이고 여기는 그 사본이 아니라 기본값이다. */
export const CONSULTATION_NOTICE = {
  notWedding:
    '웨딩 상담 내용이 확인되지 않았어요. 웨딩홀, 스드메, 촬영, 예복 등 웨딩업체와 상담한 녹음을 올려주세요.',
  unsupported: '웨딩 상담은 맞지만 지금은 지원하지 않는 업종이에요.',
  lowConfidence:
    '웨딩 상담 내용이 확인되지 않았어요. 업체와 상담한 부분이 담긴 녹음을 올려주세요.',
  ask: '웨딩 상담으로 보이지만 확실하지 않아요. 이 녹음이 웨딩업체와 상담한 것이 맞나요?',
} as const;

/**
 * 1차 판정 결과로 2차를 부를지 정한다.
 *
 * **순서가 뜻을 갖는다.** 웨딩이 아닌 것을 먼저 걸러야 「지원하지 않는 업종」이라는
 * 말이 엉뚱한 파일에 붙지 않는다 — 치킨 주문 대화에 「지원하지 않는 업종이에요」라고
 * 답하면 사용자는 언젠가 지원될 것으로 읽는다.
 */
export function decideConsultation(input: {
  status: ConsultationStatus;
  confidence: number;
  signals: ConsultationSignals;
}): ConsultationDecision {
  if (input.status === 'NOT_WEDDING_CONSULTATION') {
    return { kind: 'stop', reason: 'not_wedding', notice: CONSULTATION_NOTICE.notWedding };
  }

  if (input.status === 'UNSUPPORTED_WEDDING_CONSULTATION') {
    return { kind: 'stop', reason: 'unsupported', notice: CONSULTATION_NOTICE.unsupported };
  }

  if (input.confidence < CONSULTATION_CONFIDENCE.ask) {
    return { kind: 'stop', reason: 'low_confidence', notice: CONSULTATION_NOTICE.lowConfidence };
  }

  /*
   * **확신이 높아도 상담 성격이 없으면 자동으로 통과시키지 않는다**(요청 §7 마지막 줄).
   *
   * 이 줄이 없으면 「친구와 웨딩홀 얘기한 잡담」이 0.9로 들어온다 — 웨딩 단어가
   * 많이 나오니 모델은 확신한다. 막는 것이 아니라 **사람에게 묻는다**: 진짜 상담인데
   * 신호가 덜 잡히는 녹음도 있다.
   */
  const substance = SUBSTANCE_SIGNALS.filter((key) => input.signals[key]).length;
  const hasConsultationShape =
    input.signals.vendorCustomerConversation && input.signals.productOrServiceDiscussion;

  if (!hasConsultationShape || substance < MIN_SUBSTANCE_SIGNALS) {
    return { kind: 'ask', notice: CONSULTATION_NOTICE.ask };
  }

  return input.confidence >= CONSULTATION_CONFIDENCE.auto
    ? { kind: 'analyze' }
    : { kind: 'ask', notice: CONSULTATION_NOTICE.ask };
}
