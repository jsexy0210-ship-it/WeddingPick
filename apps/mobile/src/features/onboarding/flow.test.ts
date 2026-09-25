import {
  BUDGET_QUICK_CHIPS,
  DONE_DESCRIPTION,
  DONE_TITLE_LINES,
  EMPTY_ANSWERS,
  PREP_CARDS,
  QUESTION_STEPS,
  STEP_DESCRIPTION,
  STEP_LABEL,
  STEP_TITLE_LINES,
  STYLE_DESCRIPTION,
  answerSummary,
  canAdvance,
  ddayLabel,
  doneRows,
  isPrepCardSelected,
  nextStep,
  prevStep,
  resumeStep,
  settleAnswer,
  stepProgress,
  stepsFor,
  summarizeBudget,
  summarizePrep,
  summarizeStyles,
  togglePrepCard,
  type Answers,
} from './flow';

const FULL: Answers = {
  date: { value: '2027-05-15' },
  region: { region: '서울', district: '강남구' },
  prep: { categories: ['hall'] },
  budget: { amount: 5_000 },
  style: ['URBAN', 'ROMANTIC'],
};

describe('히어로 문구 (v3.28 WP-AUTH-002 ~ 007)', () => {
  it('제목과 설명이 다섯 질문 그대로다', () => {
    expect(STEP_TITLE_LINES.date.join(' ')).toBe('예식일은 언제인가요?');
    expect(STEP_TITLE_LINES.region.join(' ')).toBe('어디에서 식을 올리시나요?');
    expect(STEP_TITLE_LINES.prep.join(' ')).toBe('준비는 어디까지 했나요?');
    expect(STEP_TITLE_LINES.budget.join(' ')).toBe('앞으로 쓸 예산은 얼마인가요?');
    expect(STEP_TITLE_LINES.style.join(' ')).toBe('어떤 스타일을 좋아하세요?');

    expect(STEP_DESCRIPTION).toEqual({
      date: '남은 기간에 맞춰 지금 정할 것부터 알려드려요',
      region: '선택한 지역으로 좁혀드려요',
      prep: '이미 정한 건 내 웨딩 준비에 바로 넣어드려요',
      budget: '예산에 맞는 업체부터 보여드려요',
      style: '마음에 드는 스타일을 골라주세요',
    });
    /* v3.29 핵심 메시지 — 「웨딩픽이 골라준다」 표현을 온보딩 문구에도 남기지 않는다. */
    expect(STEP_DESCRIPTION.date).not.toContain('추천드려요');
    expect(STEP_DESCRIPTION.budget).not.toContain('골라드려요');

    expect(DONE_TITLE_LINES.join(' ')).toBe('이대로 시작할까요?');
    expect(DONE_DESCRIPTION).toBe('MY에서 언제든 바꿀 수 있어요');

    expect(STYLE_DESCRIPTION).toEqual({
      URBAN: '모던하고 세련된 도심 분위기',
      NATURAL: '편안하고 빛이 좋은 야외 느낌',
      ROMANTIC: '부드럽고 사랑스러운 분위기',
      GLAMOROUS: '풍성하고 존재감 있는 스타일',
    });
  });

  it('높임 어미를 겹치지 않는다 — «하시나요» «좋으세요»를 쓰지 않는다', () => {
    for (const lines of Object.values(STEP_TITLE_LINES)) {
      expect(lines.join(' ')).not.toMatch(/하시나요|좋으세요|하셨어요/);
    }
  });

  it('진행 상황 카드 넷과 예산 칩 넷은 시안 문구 그대로다', () => {
    expect(PREP_CARDS.map((card) => [card.name, card.description])).toEqual([
      ['웨딩홀', '예식장 · 식대 · 대관'],
      ['스드메', '스튜디오 · 드레스 · 메이크업'],
      ['본식', '본식스냅 · 부케 · 청첩장'],
      ['예물 · 신혼', '예물 · 혼수 · 허니문'],
    ]);
    expect(BUDGET_QUICK_CHIPS.map((chip) => chip.label)).toEqual(['+100만', '+500만', '+1,000만', '지우기']);
  });
});

describe('다섯 질문의 순서 (v3.28)', () => {
  it('예식일 → 지역 → 진행 상황 → 예산 → 스타일 다섯이다', () => {
    expect(QUESTION_STEPS).toEqual(['date', 'region', 'prep', 'budget', 'style']);
    expect(Object.values(STEP_LABEL)).toEqual(['예식일', '지역', '준비 현황', '예산', '스타일']);
  });

  it('진행바와 N/5는 다섯 질문 기준으로만 움직인다', () => {
    expect(stepProgress('date')).toEqual({ percent: 20, label: '1/5' });
    expect(stepProgress('region').label).toBe('2/5');
    expect(stepProgress('prep').label).toBe('3/5');
    expect(stepProgress('budget').label).toBe('4/5');
    expect(stepProgress('style')).toEqual({ percent: 100, label: '5/5' });
  });

  it('첫 질문에는 이전이 없고 다음은 순서대로 열린다', () => {
    expect(prevStep('date', EMPTY_ANSWERS)).toBeNull();
    expect(nextStep('date', EMPTY_ANSWERS)).toBe('region');
    expect(nextStep('region', EMPTY_ANSWERS)).toBe('prep');
    expect(nextStep('prep', EMPTY_ANSWERS)).toBe('budget');
    expect(nextStep('budget', EMPTY_ANSWERS)).toBe('style');
    expect(prevStep('style', EMPTY_ANSWERS)).toBe('budget');
  });

  it('스타일(5/5)은 건너뛰지 않는다 — 마지막 질문이고 최소 1개가 필요하다', () => {
    expect(stepsFor(EMPTY_ANSWERS)).toEqual(QUESTION_STEPS);
    expect(nextStep('budget', { ...FULL, style: null })).toBe('style');
    expect(resumeStep({ ...FULL, style: [] })).toBe('style');
    expect(resumeStep(FULL)).toBeNull();
  });

  it('이미 답한 질문은 «다음»이 건너뛴다', () => {
    /* 지역에서 «다음» — 뒤가 전부 차 있어 곧장 완료다. */
    expect(nextStep('region', FULL)).toBeNull();
    expect(resumeStep({ ...EMPTY_ANSWERS, date: { value: null } })).toBe('region');
    /* 3단계 시절의 초안 — 진행 상황부터 이어 묻는다. */
    expect(resumeStep({ ...FULL, prep: null, budget: null })).toBe('prep');
  });

  it('스타일 최소 1개 · 지역 시/도는 필수 — 진행 상황 · 예산은 미정도 답이다', () => {
    expect(canAdvance('style', { ...FULL, style: [] })).toBe(false);
    expect(canAdvance('style', { ...FULL, style: ['NATURAL'] })).toBe(true);
    /* 예식일만 칩으로 미정을 고른다 — 안 고르면 «다음»이 잠긴다. */
    expect(canAdvance('date', EMPTY_ANSWERS)).toBe(false);
    expect(canAdvance('date', { ...EMPTY_ANSWERS, date: { value: null } })).toBe(true);
    /* 지역은 필수(2026-09-25 대표 지시) — 시/도를 골라야 «다음»이 켜진다. */
    expect(canAdvance('region', EMPTY_ANSWERS)).toBe(false);
    expect(canAdvance('region', { ...EMPTY_ANSWERS, region: { region: null, district: null } })).toBe(false);
    expect(canAdvance('region', { ...EMPTY_ANSWERS, region: { region: '서울', district: null } })).toBe(true);
    /* 진행 상황 · 예산은 아무것도 안 골라도 «다음»을 누를 수 있다 — 누르면 미정이 된다. */
    expect(canAdvance('prep', EMPTY_ANSWERS)).toBe(true);
    expect(canAdvance('budget', EMPTY_ANSWERS)).toBe(true);
  });

  it('«다음»이 진행 상황 · 예산의 빈 답을 미정으로 확정한다(지역은 필수라 확정하지 않는다)', () => {
    expect(settleAnswer('region', EMPTY_ANSWERS)).toBe(EMPTY_ANSWERS);
    expect(settleAnswer('prep', EMPTY_ANSWERS).prep).toEqual({ categories: [] });
    expect(settleAnswer('budget', EMPTY_ANSWERS).budget).toEqual({ amount: null });
    expect(settleAnswer('prep', FULL)).toBe(FULL);
    expect(settleAnswer('date', EMPTY_ANSWERS)).toBe(EMPTY_ANSWERS);
  });
});

describe('진행 상황 카드', () => {
  const sdm = PREP_CARDS[1]!;

  it('카드 하나가 업종 묶음 하나다 — 켜면 전부 들어가고 끄면 전부 빠진다', () => {
    const on = togglePrepCard(sdm, ['hall']);

    expect(on).toEqual(['hall', 'studio', 'dress', 'makeup', 'hair']);
    expect(isPrepCardSelected(sdm, on)).toBe(true);
    expect(togglePrepCard(sdm, on)).toEqual(['hall']);
  });

  it('묶음의 일부만 있으면 켜진 것이 아니다', () => {
    expect(isPrepCardSelected(sdm, ['studio'])).toBe(false);
  });

  it('요약은 카드 이름을 «·»로 잇고, 없으면 «아직 시작 전이에요»다', () => {
    expect(summarizePrep(['hall', 'snap', 'bouquet', 'invitation'])).toBe('웨딩홀 · 본식');
    expect(summarizePrep([])).toBe('아직 시작 전이에요');
  });
});

describe('완료 요약', () => {
  it('미정은 «미정»으로, 스타일은 «·»로 잇는다', () => {
    const undecided: Answers = {
      date: { value: null },
      region: { region: null, district: null },
      prep: { categories: [] },
      budget: { amount: null },
      style: null,
    };

    expect(answerSummary('date', undecided)).toBe('미정');
    expect(answerSummary('region', undecided)).toBe('미정');
    expect(answerSummary('prep', undecided)).toBe('아직 시작 전이에요');
    expect(answerSummary('budget', undecided)).toBe('미정');
    expect(answerSummary('style', undecided)).toBeNull();

    expect(answerSummary('date', FULL)).toBe('2027.05.15(토)');
    expect(answerSummary('region', FULL)).toBe('서울 강남구');
    expect(answerSummary('prep', FULL)).toBe('웨딩홀');
    expect(answerSummary('budget', FULL)).toBe('5,000만원');
    expect(answerSummary('style', FULL)).toBe('도시적인 · 로맨틱한');
    expect(summarizeStyles(['GLAMOROUS'])).toBe('화려한');
  });

  it('예산은 천단위 쉼표 + 만원이다', () => {
    expect(summarizeBudget(5_000)).toBe('5,000만원');
    expect(summarizeBudget(300)).toBe('300만원');
    expect(summarizeBudget(0)).toBe('미정');
    expect(summarizeBudget(null)).toBe('미정');
  });

  it('완료 요약은 항상 다섯 줄이고 빈칸 대신 «미정»이다', () => {
    const rows = doneRows({ ...FULL, style: null });

    expect(rows.map((row) => row.label)).toEqual(['예식일', '지역', '준비 현황', '예산', '스타일']);
    expect(rows[4]!.value).toBe('미정');
    expect(rows.every((row) => row.value !== '' && row.value !== '—')).toBe(true);

    expect(doneRows(FULL)[4]).toEqual({ step: 'style', label: '스타일', value: '도시적인 · 로맨틱한' });
  });

  it('시트의 D-day는 «D-250», 당일은 «D-DAY»다', () => {
    expect(ddayLabel(250)).toBe('D-250');
    expect(ddayLabel(1)).toBe('D-1');
    expect(ddayLabel(0)).toBe('D-DAY');
  });
});
