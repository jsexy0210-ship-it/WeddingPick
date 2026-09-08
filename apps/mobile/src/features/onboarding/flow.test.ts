import { TASTE_CATEGORIES } from '@weddingpick/domain';

import {
  DOMAIN_TITLE,
  EMPTY_ANSWERS,
  STEP_TITLE_LINES,
  answerSummary,
  answeredRows,
  doneRows,
  nextStep,
  prevStep,
  resumeStep,
  stepProgress,
  stepsFor,
  tasteCategoryFor,
  tasteCta,
  type Answers,
} from './flow';

const FULL: Answers = {
  date: { value: '2027-05-15' },
  region: { region: '서울', district: '강남구' },
  prep: { categories: ['hall', 'studio', 'dress'] },
  budget: '10m_20m',
  taste: { category: 'makeup', keys: ['makeup_natural', 'makeup_glow', 'makeup_pure'] },
};

describe('다섯 질문의 순서', () => {
  it('진행바와 N/5는 다섯 질문 기준으로만 움직인다', () => {
    expect(stepProgress('date')).toEqual({ percent: 20, label: '1/5' });
    expect(stepProgress('prep')).toEqual({ percent: 60, label: '3/5' });
    expect(stepProgress('taste')).toEqual({ percent: 100, label: '5/5' });
  });

  it('첫 질문에는 이전이 없고 다음은 순서대로 열린다', () => {
    expect(prevStep('date', EMPTY_ANSWERS)).toBeNull();
    expect(nextStep('date', EMPTY_ANSWERS)).toBe('region');
    expect(nextStep('budget', EMPTY_ANSWERS)).toBe('taste');
    expect(prevStep('taste', EMPTY_ANSWERS)).toBe('budget');
  });

  it('취향은 준비 현황에서 남은 첫 업종을 묻고, 전부 준비했으면 통째로 건너뛴다', () => {
    expect(tasteCategoryFor(FULL)).toBe('makeup');

    const allDone: Answers = { ...FULL, prep: { categories: [...TASTE_CATEGORIES] }, taste: null };

    expect(tasteCategoryFor(allDone)).toBeNull();
    expect(stepsFor(allDone)).toEqual(['date', 'region', 'prep', 'budget']);
    expect(nextStep('budget', allDone)).toBeNull();
    expect(resumeStep(allDone)).toBeNull();
  });

  it('바꾸기로 되돌아가 고친 뒤 다음은 이미 답한 질문을 건너뛴다', () => {
    /* 지역만 다시 열었다 — 준비 현황·예산·취향은 그대로라 곧장 완료다. */
    expect(nextStep('region', FULL)).toBeNull();

    /* 준비 현황을 바꿔 물을 업종이 달라지면 예전 취향은 답이 아니다. */
    const changed: Answers = { ...FULL, prep: { categories: ['hall'] } };

    expect(nextStep('prep', changed)).toBe('taste');
    expect(resumeStep({ ...EMPTY_ANSWERS, date: { value: null } })).toBe('region');
  });
});

describe('답 줄과 완료 요약', () => {
  it('미정은 «미정»으로, 다중 선택은 «첫 항목 외 N»으로 적는다', () => {
    const undecided: Answers = {
      date: { value: null },
      region: { region: null, district: null },
      prep: { categories: [] },
      budget: 'unknown',
      taste: null,
    };

    expect(answerSummary('date', undecided)).toBe('미정');
    expect(answerSummary('region', undecided)).toBe('미정');
    expect(answerSummary('prep', undecided)).toBe('아직 시작 전이에요');
    expect(answerSummary('budget', undecided)).toBe('미정');

    expect(answerSummary('date', FULL)).toBe('2027.05.15(토)');
    expect(answerSummary('region', FULL)).toBe('서울 강남구');
    expect(answerSummary('prep', FULL)).toBe('웨딩홀 외 2곳');
    expect(answerSummary('budget', FULL)).toBe('1,000~2,000만원');
    expect(answerSummary('taste', FULL)).toBe('내추럴 외 2개');
  });

  it('답 줄은 Step 순서대로 쌓이고 열린 질문과 취향은 빠진다', () => {
    expect(answeredRows('budget', FULL).map((row) => row.step)).toEqual(['date', 'region', 'prep']);
    expect(answeredRows('date', FULL).map((row) => row.step)).toEqual(['region', 'prep', 'budget']);
    expect(answeredRows('date', EMPTY_ANSWERS)).toEqual([]);
  });

  it('완료 요약은 항상 다섯 줄이고 빈칸 대신 «미정»이다', () => {
    const rows = doneRows({ ...FULL, taste: null });

    expect(rows.map((row) => row.label)).toEqual(['예식일', '지역', '준비 현황', '준비 예산', '취향']);
    expect(rows[4]!.value).toBe('미정');
    expect(rows.every((row) => row.value !== '' && row.value !== '—')).toBe(true);
  });

  it('취향 CTA는 고른 장수 그대로다', () => {
    expect(tasteCta(3)).toBe('3장 선택');
  });

  it('줄 나눈 제목이 도메인 제목과 같은 문장이다', () => {
    for (const [step, title] of Object.entries(DOMAIN_TITLE)) {
      expect(STEP_TITLE_LINES[step as keyof typeof STEP_TITLE_LINES].join(' ')).toBe(title);
    }
  });
});
