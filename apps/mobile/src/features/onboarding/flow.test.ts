import {
  EMPTY_ANSWERS,
  QUESTION_STEPS,
  STEP_DESCRIPTION,
  STEP_TITLE_LINES,
  STYLE_DESCRIPTION,
  answerSummary,
  canAdvance,
  ddayLabel,
  doneRows,
  nextStep,
  prevStep,
  resumeStep,
  stepProgress,
  stepsFor,
  styleCta,
  summarizeStyles,
  type Answers,
} from './flow';

const FULL: Answers = {
  date: { value: '2027-05-15' },
  region: { region: '서울', district: '강남구' },
  style: ['URBAN', 'ROMANTIC'],
};

describe('히어로 문구', () => {
  it('제목과 설명이 세 질문 그대로다', () => {
    expect(STEP_TITLE_LINES.date.join(' ')).toBe('예식일은 언제인가요?');
    expect(STEP_TITLE_LINES.region.join(' ')).toBe('어디에서 식을 올리시나요?');
    expect(STEP_TITLE_LINES.style.join(' ')).toBe('어떤 스타일을 좋아하세요?');

    expect(STEP_DESCRIPTION).toEqual({
      date: '남은 기간에 맞춰 웨딩픽이 추천드려요',
      region: '선택한 지역으로 좁혀드려요',
      style: '마음에 드는 스타일을 골라주세요',
    });

    expect(STYLE_DESCRIPTION).toEqual({
      URBAN: '모던하고 세련된 도심 분위기',
      NATURAL: '편안하고 빛이 좋은 야외 느낌',
      ROMANTIC: '부드럽고 사랑스러운 분위기',
      GLAMOROUS: '풍성하고 존재감 있는 스타일',
    });
    expect(styleCta(0)).toBe('0개 선택');
    expect(styleCta(2)).toBe('2개 선택');
  });

  it('높임 어미를 겹치지 않는다 — «하시나요» «좋으세요»를 쓰지 않는다', () => {
    for (const lines of Object.values(STEP_TITLE_LINES)) {
      expect(lines.join(' ')).not.toMatch(/하시나요|좋으세요|하셨어요/);
    }
  });
});

describe('세 질문의 순서 (2026-09-14 대표 확정 · 피그마 3단계)', () => {
  it('예식일 → 지역 → 스타일 셋뿐이다 — 준비 현황·예산은 여기서 묻지 않는다', () => {
    expect(QUESTION_STEPS).toEqual(['date', 'region', 'style']);
  });

  it('진행바와 N/3은 세 질문 기준으로만 움직인다', () => {
    expect(stepProgress('date').label).toBe('1/3');
    expect(stepProgress('region').label).toBe('2/3');
    expect(stepProgress('style')).toEqual({ percent: 100, label: '3/3' });
  });

  it('첫 질문에는 이전이 없고 다음은 순서대로 열린다', () => {
    expect(prevStep('date', EMPTY_ANSWERS)).toBeNull();
    expect(nextStep('date', EMPTY_ANSWERS)).toBe('region');
    expect(nextStep('region', EMPTY_ANSWERS)).toBe('style');
    expect(prevStep('style', EMPTY_ANSWERS)).toBe('region');
  });

  it('스타일(3/3)은 건너뛰지 않는다 — 마지막 질문이고 최소 1개가 필요하다', () => {
    expect(stepsFor(EMPTY_ANSWERS)).toEqual(QUESTION_STEPS);
    expect(nextStep('region', { ...FULL, style: null })).toBe('style');
    expect(resumeStep({ ...FULL, style: [] })).toBe('style');
    expect(resumeStep(FULL)).toBeNull();
  });

  it('이미 답한 질문은 «다음»이 건너뛴다', () => {
    /* 지역에서 «다음» — 스타일이 이미 차 있어 곧장 완료다. */
    expect(nextStep('region', FULL)).toBeNull();
    expect(resumeStep({ ...EMPTY_ANSWERS, date: { value: null } })).toBe('region');
  });

  it('스타일만 최소 1개 필수 — 예식일·지역은 미정도 답이다', () => {
    expect(canAdvance('style', { ...FULL, style: [] })).toBe(false);
    expect(canAdvance('style', { ...FULL, style: ['NATURAL'] })).toBe(true);
    expect(canAdvance('date', { ...EMPTY_ANSWERS, date: { value: null } })).toBe(true);
    expect(canAdvance('region', { ...EMPTY_ANSWERS, region: { region: null, district: null } })).toBe(true);
  });
});

describe('완료 요약', () => {
  it('미정은 «미정»으로, 스타일은 «·»로 잇는다', () => {
    const undecided: Answers = {
      date: { value: null },
      region: { region: null, district: null },
      style: null,
    };

    expect(answerSummary('date', undecided)).toBe('미정');
    expect(answerSummary('region', undecided)).toBe('미정');
    expect(answerSummary('style', undecided)).toBeNull();

    expect(answerSummary('date', FULL)).toBe('2027.05.15(토)');
    expect(answerSummary('region', FULL)).toBe('서울 강남구');
    expect(answerSummary('style', FULL)).toBe('도시적인 · 로맨틱한');
    expect(summarizeStyles(['GLAMOROUS'])).toBe('화려한');
  });

  it('완료 요약은 항상 세 줄이고 빈칸 대신 «미정»이다', () => {
    const rows = doneRows({ ...FULL, style: null });

    expect(rows.map((row) => row.label)).toEqual(['예식일', '지역', '스타일']);
    expect(rows[2]!.value).toBe('미정');
    expect(rows.every((row) => row.value !== '' && row.value !== '—')).toBe(true);

    expect(doneRows(FULL)[2]).toEqual({ step: 'style', label: '스타일', value: '도시적인 · 로맨틱한' });
  });

  it('시트의 D-day는 «D-250», 당일은 «D-DAY»다', () => {
    expect(ddayLabel(250)).toBe('D-250');
    expect(ddayLabel(1)).toBe('D-1');
    expect(ddayLabel(0)).toBe('D-DAY');
  });
});
