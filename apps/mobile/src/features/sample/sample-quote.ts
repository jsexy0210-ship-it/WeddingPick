import type { ComparisonResponse, Quote } from '@weddingpick/api-contract';

/**
 * 샘플 미리보기용 고정 데이터.
 *
 * **어디에도 저장되지 않고 서버로도 가지 않는다.** 앱이 무엇을 해주는지 보여주기 위한
 * 것이며, 화면에서 샘플임을 계속 알린다. 실제 업체·실제 계약 데이터가 아니다.
 *
 * 값은 eval/cases/hall-quote 문서에서 가져왔다. 실제 결과 화면과 같은 컴포넌트로
 * 그리므로, 샘플이 실제와 다른 약속을 하지 않는다.
 */
export const SAMPLE_QUOTE: Quote = {
  id: 'sample',
  weddingId: 'sample',
  docType: 'quote',
  vendor: { id: 'sample-vendor', name: '샘플웨딩홀' },
  planner: { id: 'sample-planner', name: '이수진' },
  productName: '그랜드볼룸 토요일 낮',
  totalAmount: 23_700_000,
  discountAmount: 1_500_000,
  contractDate: null,
  weddingDate: '2027-03-20',
  depositAmount: 3_000_000,
  balanceAmount: 20_700_000,
  hallName: '그랜드볼룸',
  guaranteedGuests: 200,
  mealPricePerPerson: 68_000,
  subVendors: [],
  verificationLevel: 'L0',
  source: 'ai_extraction',
  createdAt: '2026-05-16T04:00:00Z',
  confirmedAt: '2026-05-16T04:02:00Z',
  lineItems: [
    { id: 's1', kind: 'included', label: '대관료', amount: 8_000_000, amountMin: null, amountMax: null, standardNote: null },
    { id: 's2', kind: 'included', label: '식대 (68,000원 × 200명)', amount: 13_600_000, amountMin: null, amountMax: null, standardNote: null },
    { id: 's3', kind: 'included', label: '기본 연출', amount: 2_400_000, amountMin: null, amountMax: null, standardNote: null },
    {
      id: 's4',
      kind: 'excluded',
      label: '본식 스냅 및 영상',
      amount: null,
      amountMin: 1_800_000,
      amountMax: null,
      note: '1,800,000원부터',
      standardNote: null,
    },
    {
      id: 's5',
      kind: 'additional_candidate',
      label: '보증인원 초과분',
      amount: null,
      amountMin: null,
      amountMax: null,
      note: '1인당 68,000원',
      standardNote: null,
    },
    {
      id: 's6',
      kind: 'additional_candidate',
      label: '생화 장식 업그레이드',
      amount: null,
      amountMin: 1_500_000,
      amountMax: 3_000_000,
      standardNote: null,
    },
    {
      id: 's7',
      kind: 'additional_candidate',
      label: '드레스 피팅비',
      amount: 80_000,
      amountMin: null,
      amountMax: null,
      standardNote:
        '드레스 피팅비는 공정거래위원회가 기본 제공에 포함하도록 시정한 항목입니다. 별도 청구인지 확인해보세요.',
    },
  ],
  terms: [
    {
      id: 't1',
      category: 'refund',
      body: '계약금 300만원은 어떠한 경우에도 환불되지 않습니다.',
      flagged: true,
      daysBeforeWedding: null,
      penaltyRate: null,
      standardNote: null,
    },
    {
      id: 't2',
      category: 'penalty',
      body: '예식일 30일 이내 취소 시 총 견적금액의 50%를 위약금으로 배상합니다.',
      flagged: true,
      daysBeforeWedding: 29,
      penaltyRate: 0.5,
      standardNote:
        '공정거래위원회 소비자분쟁해결기준 (예식업)은 예식 29일 전 취소 시 총 비용의 35%를 기준으로 합니다. 이 조항은 50%로 더 무겁습니다.',
    },
    {
      id: 't3',
      category: 'schedule',
      body: '예식일 변경은 1회에 한하여 가능합니다.',
      flagged: false,
      daysBeforeWedding: null,
      penaltyRate: null,
      standardNote: null,
    },
  ],
  extractionFields: [
    { path: 'totalAmount', value: '23700000', confidence: 0.95, requiresConfirmation: true, confirmedByUser: true },
    { path: 'contractDate', value: '', confidence: 0, requiresConfirmation: true, confirmedByUser: true },
    { path: 'refundTerms', value: '계약금 300만원은 어떠한 경우에도 환불되지 않습니다.', confidence: 1, requiresConfirmation: true, confirmedByUser: true },
    { path: 'vendorName', value: '샘플웨딩홀', confidence: 0.95, requiresConfirmation: false, confirmedByUser: false },
  ],
};

export const SAMPLE_COMPARISON: ComparisonResponse = {
  available: true,
  docType: 'quote',
  myAmount: 23_700_000,
  stat: {
    sampleCount: 14,
    periodStart: '2026-01-08',
    periodEnd: '2026-06-24',
    median: 21_400_000,
    p25: 19_800_000,
    p75: 23_100_000,
    p90: 24_600_000,
    minVerificationLevel: 'L2',
  },
  judgement: 'high',
};
