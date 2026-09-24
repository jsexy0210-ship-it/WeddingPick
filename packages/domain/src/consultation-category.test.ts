import {
  CONSULTATION_CATEGORIES,
  CONSULTATION_CATEGORY_LABEL,
  CONSULTATION_CONFIDENCE,
  MIN_SUBSTANCE_SIGNALS,
  UNSUPPORTED_CONSULTATION_LABELS,
  type ConsultationSignals,
  type ConsultationStatus,
  decideConsultation,
} from './consultation-category';
import { VENDOR_CATEGORY_LABEL } from './vendor';

/** 상담 성격이 뚜렷한 녹음. 여기서 하나씩 꺼 보며 무엇이 막는지 본다. */
const FULL: ConsultationSignals = {
  vendorCustomerConversation: true,
  productOrServiceDiscussion: true,
  pricingMentioned: true,
  scheduleMentioned: true,
  contractMentioned: false,
  benefitMentioned: true,
};

function decide(
  overrides: {
    status?: ConsultationStatus;
    confidence?: number;
    signals?: Partial<ConsultationSignals>;
  } = {}
) {
  return decideConsultation({
    status: overrides.status ?? 'SUPPORTED_WEDDING_CONSULTATION',
    confidence: overrides.confidence ?? 0.94,
    signals: { ...FULL, ...overrides.signals },
  });
}

describe('상담 분류', () => {
  it('업종과 겹치는 이름은 글자까지 같다', () => {
    /*
     * 같은 것을 두 이름으로 부르지 않는다(2026-09-11 대표 지시). 여기서 「부케·플라워」로
     * 적고 업종에서 「부케」로 적으면 같은 목록이 두 줄로 뜬다.
     */
    for (const key of CONSULTATION_CATEGORIES) {
      const vendorLabel = (VENDOR_CATEGORY_LABEL as Record<string, string | undefined>)[key];

      if (vendorLabel) expect(CONSULTATION_CATEGORY_LABEL[key]).toBe(vendorLabel);
    }
  });

  it('상담기록 전용 셋은 업종 목록에 없다', () => {
    // 업종을 늘리면 홈·Pick·검색·온보딩이 따라 바뀐다. 상담 안에 가둔다(P-1).
    for (const key of ['iphone_snap', 'wedding_video', 'suit'] as const) {
      expect(CONSULTATION_CATEGORIES).toContain(key);
      expect(VENDOR_CATEGORY_LABEL).not.toHaveProperty(key);
    }
  });

  it('청첩장은 업종에 남고 상담에서만 빠진다', () => {
    /*
     * A-12(청첩장 수집 추가)와 이번 미지원 지정이 둘 다 유효하다(P-2). 업종에서까지
     * 빼면 A-12를 뒤집는 것이 된다.
     */
    expect(VENDOR_CATEGORY_LABEL.invitation).toBe('청첩장');
    expect(CONSULTATION_CATEGORIES).not.toContain('invitation');
    expect(UNSUPPORTED_CONSULTATION_LABELS).toContain('청첩장');
  });

  it('결정사 · 플래너 상담은 읽지 않는다', () => {
    // 2026-09-24 대표 지시 — 결정사 불필요. P-3(플래너 → 결정사)을 뒤집었다.
    expect(CONSULTATION_CATEGORIES).not.toContain('wedding_info_company');
    expect(CONSULTATION_CATEGORIES).not.toContain('planner');
    expect(UNSUPPORTED_CONSULTATION_LABELS).toEqual(expect.arrayContaining(['결정사', '플래너']));
  });
});

describe('2차 호출을 부를지 정한다', () => {
  it('웨딩이 아니면 거기서 끝난다', () => {
    const decision = decide({ status: 'NOT_WEDDING_CONSULTATION' });

    expect(decision.kind).toBe('stop');
    expect(decision).toHaveProperty('reason', 'not_wedding');
  });

  it('웨딩이 아닌 파일에 「지원하지 않는 업종」이라고 답하지 않는다', () => {
    /*
     * 순서가 뜻을 갖는다. 치킨 주문 대화에 「지금은 지원하지 않는 업종이에요」라고
     * 답하면 사용자는 언젠가 지원될 것으로 읽는다.
     */
    const decision = decide({ status: 'NOT_WEDDING_CONSULTATION' });

    expect(decision.kind === 'stop' && decision.notice).not.toContain('지원하지 않는');
  });

  it('지원하지 않는 업종이면 상세 분석을 하지 않는다', () => {
    const decision = decide({ status: 'UNSUPPORTED_WEDDING_CONSULTATION' });

    expect(decision.kind).toBe('stop');
    expect(decision).toHaveProperty('reason', 'unsupported');
  });

  it('확신이 바닥이면 묻지 않고 멈춘다', () => {
    expect(decide({ confidence: 0.49 }).kind).toBe('stop');
  });

  it('두 값 사이는 사람에게 묻는다', () => {
    // 자동으로 통과시키면 엉뚱한 녹음이 들어오고, 자동으로 막으면 진짜 상담이 거절당한다.
    expect(decide({ confidence: 0.5 }).kind).toBe('ask');
    expect(decide({ confidence: 0.79 }).kind).toBe('ask');
  });

  it('경계값은 통과 쪽이다', () => {
    expect(decide({ confidence: CONSULTATION_CONFIDENCE.auto }).kind).toBe('analyze');
    expect(decide({ confidence: CONSULTATION_CONFIDENCE.ask }).kind).toBe('ask');
  });

  it('확신이 높아도 상담 성격이 없으면 자동으로 통과시키지 않는다', () => {
    /*
     * 요청 §7의 마지막 줄이다. 이 줄이 없으면 「친구와 웨딩홀 얘기한 잡담」이 0.9로
     * 들어온다 — 웨딩 단어가 많이 나오니 모델은 확신한다.
     */
    expect(decide({ confidence: 0.99, signals: { vendorCustomerConversation: false } }).kind).toBe(
      'ask'
    );
    expect(decide({ confidence: 0.99, signals: { productOrServiceDiscussion: false } }).kind).toBe(
      'ask'
    );
  });

  it('내용 신호가 둘 미만이면 자동으로 통과시키지 않는다', () => {
    const decision = decide({
      confidence: 0.99,
      signals: { pricingMentioned: true, scheduleMentioned: false, benefitMentioned: false },
    });

    expect(decision.kind).toBe('ask');
  });

  it('내용 신호가 딱 둘이면 통과한다', () => {
    // 경계에서 한 번 더 부르지 않는 것과 같은 규칙 — 기준을 적었으면 그 값은 포함이다.
    const decision = decide({
      confidence: 0.99,
      signals: {
        pricingMentioned: true,
        scheduleMentioned: true,
        contractMentioned: false,
        benefitMentioned: false,
      },
    });

    expect(decision.kind).toBe('analyze');
    expect(MIN_SUBSTANCE_SIGNALS).toBe(2);
  });

  it('막을 때는 왜 막혔는지를 함께 말한다', () => {
    // 「올릴 수 없어요」만 보이면 사용자는 파일이 잘못된 줄 안다.
    for (const status of ['NOT_WEDDING_CONSULTATION', 'UNSUPPORTED_WEDDING_CONSULTATION'] as const) {
      const decision = decide({ status });

      expect(decision.kind === 'stop' && decision.notice.length).toBeGreaterThan(10);
    }
  });
});
