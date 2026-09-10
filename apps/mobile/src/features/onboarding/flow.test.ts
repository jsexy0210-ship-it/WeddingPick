import {
  EMPTY_ANSWERS,
  QUESTION_STEPS,
  STEP_DESCRIPTION,
  STEP_TITLE_LINES,
  answerSummary,
  answeredRows,
  canAdvance,
  ddayLabel,
  doneRows,
  nextStep,
  prevStep,
  resumeStep,
  returnStep,
  stepProgress,
  stepsFor,
  styleCta,
  summarizeStyles,
  type Answers,
} from './flow';

const FULL: Answers = {
  date: { value: '2027-05-15' },
  region: { region: '서울', district: '강남구' },
  prep: { categories: ['hall', 'dress'] },
  budget: '10m_20m',
  style: ['URBAN', 'ROMANTIC'],
};

describe('히어로 문구 (핸드오프 v3.26 SPEC §13.6)', () => {
  it('제목과 설명이 표 그대로다', () => {
    expect(STEP_TITLE_LINES.date.join(' ')).toBe('예식일은 언제인가요?');
    expect(STEP_TITLE_LINES.region.join(' ')).toBe('어느 지역에서 하나요?');
    expect(STEP_TITLE_LINES.prep.join(' ')).toBe('준비는 어디까지 했나요?');
    expect(STEP_TITLE_LINES.budget.join(' ')).toBe('앞으로 쓸 예산은 얼마인가요?');
    expect(STEP_TITLE_LINES.style.join(' ')).toBe('어떤 스타일을 좋아하세요?');

    expect(STEP_DESCRIPTION).toEqual({
      date: '남은 기간에 맞춰 준비 순서를 잡아드릴게요',
      region: '선택한 지역을 기준으로 찾아드릴게요',
      prep: '이미 정한 건 빼고 필요한 것만 챙겨드릴게요',
      budget: '예산에 맞는 선택지를 먼저 보여드릴게요',
      style: '마음에 드는 스타일을 골라주세요',
    });
  });

  it('높임 어미를 겹치지 않는다 — «하시나요» «좋으세요»를 쓰지 않는다', () => {
    for (const lines of Object.values(STEP_TITLE_LINES)) {
      expect(lines.join(' ')).not.toMatch(/하시나요|좋으세요|하셨어요/);
    }
  });
});

describe('다섯 질문의 순서', () => {
  it('진행바와 N/5는 다섯 질문 기준으로만 움직인다', () => {
    expect(stepProgress('date')).toEqual({ percent: 20, label: '1/5' });
    expect(stepProgress('prep')).toEqual({ percent: 60, label: '3/5' });
    expect(stepProgress('style')).toEqual({ percent: 100, label: '5/5' });
  });

  it('첫 질문에는 이전이 없고 다음은 순서대로 열린다', () => {
    expect(prevStep('date', EMPTY_ANSWERS)).toBeNull();
    expect(nextStep('date', EMPTY_ANSWERS)).toBe('region');
    expect(nextStep('budget', EMPTY_ANSWERS)).toBe('style');
    expect(prevStep('style', EMPTY_ANSWERS)).toBe('budget');
  });

  it('스타일(5/5)은 건너뛰지 않는다 — 준비 현황과 무관하게 항상 묻는다', () => {
    expect(stepsFor(EMPTY_ANSWERS)).toEqual(QUESTION_STEPS);
    expect(stepsFor({ ...FULL, prep: { categories: ['hall', 'studio', 'dress', 'makeup'] } })).toEqual(QUESTION_STEPS);
    expect(nextStep('budget', { ...FULL, style: null })).toBe('style');
    expect(resumeStep({ ...FULL, style: [] })).toBe('style');
    expect(resumeStep(FULL)).toBeNull();
  });

  it('바꾸기로 되돌아가 고친 뒤 다음은 이미 답한 질문을 건너뛴다', () => {
    /* 지역만 다시 열었다 — 준비 현황·예산·스타일은 그대로라 곧장 완료다. */
    expect(nextStep('region', FULL)).toBeNull();
    expect(resumeStep({ ...EMPTY_ANSWERS, date: { value: null } })).toBe('region');
  });

  it('스타일만 최소 1개 필수 — 나머지는 미정도 답이다', () => {
    expect(canAdvance('style', { ...FULL, style: [] })).toBe(false);
    expect(canAdvance('style', { ...FULL, style: ['NATURAL'] })).toBe(true);
    expect(canAdvance('date', { ...EMPTY_ANSWERS, date: { value: null } })).toBe(true);
  });
});

describe('「바꾸기」 동작', () => {
  it('고친 뒤 «다음»은 원래 있던 Step으로 바로 돌아간다', () => {
    expect(returnStep('region', 'budget', FULL)).toBe('budget');
    expect(returnStep('date', 'prep', FULL)).toBe('prep');
    expect(returnStep('prep', 'style', FULL)).toBe('style');
  });

  it('준비 현황을 바꿔도 스타일은 그대로다 — 연쇄 초기화가 없다', () => {
    const changed: Answers = { ...FULL, prep: { categories: [] } };

    expect(answerSummary('style', changed)).toBe('도시적인 · 로맨틱한');
    expect(nextStep('prep', changed)).toBeNull();
  });

  it('바꾸는 동안 답 줄은 그 질문 앞의 것만 보인다', () => {
    expect(answeredRows('region', FULL, true).map((row) => row.step)).toEqual(['date']);
    expect(answeredRows('date', FULL, true)).toEqual([]);
    expect(answeredRows('budget', FULL, true).map((row) => row.step)).toEqual(['date', 'region', 'prep']);
  });
});

describe('답 줄과 완료 요약', () => {
  it('미정은 «미정»으로, 다중 선택은 «첫 항목 외 N»으로, 스타일은 «·»로 잇는다', () => {
    const undecided: Answers = {
      date: { value: null },
      region: { region: null, district: null },
      prep: { categories: [] },
      budget: 'unknown',
      style: null,
    };

    expect(answerSummary('date', undecided)).toBe('미정');
    expect(answerSummary('region', undecided)).toBe('미정');
    expect(answerSummary('prep', undecided)).toBe('아직 시작 전이에요');
    expect(answerSummary('budget', undecided)).toBe('미정');
    expect(answerSummary('style', undecided)).toBeNull();

    expect(answerSummary('date', FULL)).toBe('2027.05.15(토)');
    expect(answerSummary('region', FULL)).toBe('서울 강남구');
    expect(answerSummary('prep', FULL)).toBe('웨딩홀 외 1곳');
    expect(answerSummary('budget', FULL)).toBe('1,000~2,000만원');
    expect(answerSummary('style', FULL)).toBe('도시적인 · 로맨틱한');
    expect(summarizeStyles(['GLAMOROUS'])).toBe('화려한');
  });

  it('답 줄은 Step 순서대로 쌓이고 열린 질문은 빠진다', () => {
    expect(answeredRows('budget', FULL).map((row) => row.step)).toEqual(['date', 'region', 'prep', 'style']);
    expect(answeredRows('style', FULL).map((row) => row.step)).toEqual(['date', 'region', 'prep', 'budget']);
    expect(answeredRows('date', EMPTY_ANSWERS)).toEqual([]);
  });

  it('완료 요약은 항상 다섯 줄이고 빈칸 대신 «미정»이다', () => {
    const rows = doneRows({ ...FULL, style: null });

    expect(rows.map((row) => row.label)).toEqual(['예식일', '지역', '준비 현황', '준비 예산', '스타일']);
    expect(rows[4]!.value).toBe('미정');
    expect(rows.every((row) => row.value !== '' && row.value !== '—')).toBe(true);

    expect(doneRows(FULL)[4]).toEqual({ step: 'style', label: '스타일', value: '도시적인 · 로맨틱한' });
  });

  it('스타일 CTA는 고른 장수 그대로 «N장 선택»이다', () => {
    expect(styleCta(0)).toBe('0장 선택');
    expect(styleCta(2)).toBe('2장 선택');
  });

  it('시트의 D-day는 «D-250», 당일은 «D-DAY»다', () => {
    expect(ddayLabel(250)).toBe('D-250');
    expect(ddayLabel(1)).toBe('D-1');
    expect(ddayLabel(0)).toBe('D-DAY');
  });
});
