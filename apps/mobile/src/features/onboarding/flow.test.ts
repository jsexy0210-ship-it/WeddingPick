import { TASTE_CATEGORIES } from '@weddingpick/domain';

import {
  EMPTY_ANSWERS,
  STEP_DESCRIPTION,
  STEP_TITLE_LINES,
  TASTE_RESET_NOTICE,
  answerSummary,
  answeredRows,
  ddayLabel,
  doneRows,
  nextStep,
  prepChanged,
  prevStep,
  resumeStep,
  returnStep,
  stepProgress,
  stepsFor,
  tasteCategoryFor,
  tasteCta,
  type Answers,
} from './flow';
import { hasEnoughTasteImages, nextTasteCategoryWithImages, tasteImageCount } from '@/features/taste/images';

/*
 * 오늘 사진이 3장 이상인 업종은 스튜디오뿐이다(IMAGES.md «보유 3장»). 웨딩홀을
 * 아직 안 정했어도 웨딩홀 사진이 없으니 5/5는 스튜디오를 묻는다.
 */
const FULL: Answers = {
  date: { value: '2027-05-15' },
  region: { region: '서울', district: '강남구' },
  prep: { categories: ['hall', 'dress'] },
  budget: '10m_20m',
  taste: { category: 'studio', keys: ['studio_white', 'studio_film', 'studio_minimal'] },
};

describe('히어로 문구 (SPEC §13.6 확정 표)', () => {
  it('제목과 설명이 표 그대로다', () => {
    expect(STEP_TITLE_LINES.date.join(' ')).toBe('예식일은 언제인가요?');
    expect(STEP_TITLE_LINES.region.join(' ')).toBe('어느 지역에서 하나요?');
    expect(STEP_TITLE_LINES.prep.join(' ')).toBe('준비는 어디까지 했나요?');
    expect(STEP_TITLE_LINES.budget.join(' ')).toBe('앞으로 쓸 예산은 얼마인가요?');
    expect(STEP_TITLE_LINES.taste.join(' ')).toBe('어떤 분위기로 준비할까요?');

    expect(STEP_DESCRIPTION).toEqual({
      date: '남은 기간에 맞춰 준비 순서를 잡아드릴게요',
      region: '선택한 지역을 기준으로 찾아드릴게요',
      prep: '이미 정한 건 빼고 필요한 것만 챙겨드릴게요',
      budget: '예산에 맞는 선택지를 먼저 보여드릴게요',
      taste: '남은 준비에 취향을 반영할게요',
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
    expect(stepProgress('taste')).toEqual({ percent: 100, label: '5/5' });
  });

  it('첫 질문에는 이전이 없고 다음은 순서대로 열린다', () => {
    expect(prevStep('date', EMPTY_ANSWERS)).toBeNull();
    expect(nextStep('date', EMPTY_ANSWERS)).toBe('region');
    expect(nextStep('budget', EMPTY_ANSWERS)).toBe('taste');
    expect(prevStep('taste', EMPTY_ANSWERS)).toBe('budget');
  });

  it('취향은 준비 현황에 없고 사진이 3장 이상인 첫 업종을 묻는다', () => {
    /* 웨딩홀은 사진이 0장이라 건너뛰고 스튜디오. */
    expect(tasteCategoryFor(EMPTY_ANSWERS)).toBe('studio');
    expect(tasteCategoryFor(FULL)).toBe('studio');
  });

  it('스튜디오까지 준비했으면 물을 업종이 없어 5/5를 통째로 건너뛴다', () => {
    const studioDone: Answers = { ...FULL, prep: { categories: ['hall', 'studio'] }, taste: null };

    expect(tasteCategoryFor(studioDone)).toBeNull();
    expect(stepsFor(studioDone)).toEqual(['date', 'region', 'prep', 'budget']);
    expect(nextStep('budget', studioDone)).toBeNull();
    expect(resumeStep(studioDone)).toBeNull();

    const allDone: Answers = { ...FULL, prep: { categories: [...TASTE_CATEGORIES] }, taste: null };

    expect(tasteCategoryFor(allDone)).toBeNull();
  });

  it('바꾸기로 되돌아가 고친 뒤 다음은 이미 답한 질문을 건너뛴다', () => {
    /* 지역만 다시 열었다 — 준비 현황·예산·취향은 그대로라 곧장 완료다. */
    expect(nextStep('region', FULL)).toBeNull();

    /* 준비 현황을 바꿔 물을 업종이 달라지면 예전 업종의 취향은 답이 아니다. */
    const changed: Answers = { ...FULL, taste: { category: 'hall', keys: ['hall_hotel'] } };

    expect(nextStep('prep', changed)).toBe('taste');
    expect(resumeStep({ ...EMPTY_ANSWERS, date: { value: null } })).toBe('region');
  });
});

describe('취향 이미지 규칙 (IMAGES.md)', () => {
  it('오늘은 스튜디오 3장뿐이다', () => {
    expect(tasteImageCount('studio')).toBe(3);
    expect(hasEnoughTasteImages('studio')).toBe(true);
    expect(TASTE_CATEGORIES.filter(hasEnoughTasteImages)).toEqual(['studio']);
  });

  it('사진 조건은 우선순위 위에 얹힌다 — 조건을 바꿔 끼우면 순수 순서가 그대로 나온다', () => {
    expect(nextTasteCategoryWithImages([], () => true)).toBe('hall');
    expect(nextTasteCategoryWithImages(['hall', 'studio', 'dress'], () => true)).toBe('makeup');
    expect(nextTasteCategoryWithImages([], () => false)).toBeNull();
    expect(nextTasteCategoryWithImages(['studio'], (category) => category === 'studio')).toBeNull();
  });
});

describe('「바꾸기」 동작', () => {
  it('고친 뒤 «다음»은 원래 있던 Step으로 바로 돌아간다', () => {
    expect(returnStep('region', 'budget', FULL)).toBe('budget');
    expect(returnStep('date', 'prep', FULL)).toBe('prep');
  });

  it('돌아갈 Step이 사라졌으면 고친 질문 뒤의 첫 미답 질문, 없으면 완료다', () => {
    /* 스튜디오까지 준비했다고 고쳤다 — 취향은 더 묻지 않고 예산은 이미 답했다. */
    const studioDone: Answers = { ...FULL, prep: { categories: ['hall', 'studio'] } };

    expect(returnStep('prep', 'taste', studioDone)).toBeNull();
    expect(returnStep('prep', 'taste', { ...studioDone, budget: null })).toBe('budget');
  });

  it('준비 현황이 실제로 바뀌었을 때만 취향을 초기화한다', () => {
    expect(prepChanged({ categories: ['hall', 'dress'] }, { categories: ['dress', 'hall'] })).toBe(false);
    expect(prepChanged({ categories: ['hall'] }, { categories: ['hall', 'studio'] })).toBe(true);
    expect(prepChanged({ categories: [] }, { categories: [] })).toBe(false);
    expect(prepChanged(null, { categories: [] })).toBe(true);
    expect(TASTE_RESET_NOTICE).toBe('준비 현황이 바뀌어 취향을 다시 골라요');
  });

  it('바꾸는 동안 답 줄은 그 질문 앞의 것만 보인다', () => {
    expect(answeredRows('region', FULL, true).map((row) => row.step)).toEqual(['date']);
    expect(answeredRows('date', FULL, true)).toEqual([]);
    expect(answeredRows('budget', FULL, true).map((row) => row.step)).toEqual(['date', 'region', 'prep']);
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
    expect(answerSummary('prep', FULL)).toBe('웨딩홀 외 1곳');
    expect(answerSummary('budget', FULL)).toBe('1,000~2,000만원');
    expect(answerSummary('taste', FULL)).toBe('깔끔한 화이트 외 2개');
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

  it('취향 CTA는 고른 수 그대로 «N곳 선택»이다', () => {
    expect(tasteCta(3)).toBe('3곳 선택');
  });

  it('시트의 D-day는 «D-250», 당일은 «D-DAY»다', () => {
    expect(ddayLabel(250)).toBe('D-250');
    expect(ddayLabel(1)).toBe('D-1');
    expect(ddayLabel(0)).toBe('D-DAY');
  });
});
