import {
  BUDGET_BRACKET_FIELD_LABEL,
  BUDGET_BRACKET_LABEL,
  BUDGET_STEP_DESCRIPTION,
  BUDGET_STEP_TITLE,
  PREPARED_CATEGORIES_LABEL,
  TASTE_MIN_PICKS,
  TASTE_STEP_TITLE,
  formatDateDot,
  nextTasteCategory,
  summarizePreparedCategories,
  summarizeTasteKeys,
  tasteStepDescription,
  type TasteCategory,
  type VendorCategory,
  type WeddingBudgetBracket,
  type WeddingRegion,
} from '@weddingpick/domain';

/**
 * 초기 설정 5개 질문의 순서와 규칙. 디자인 핸드오프 v3.22 SPEC §13.6 (WP-APP-020).
 *
 *   예식일 1/5 → 지역 2/5 → 준비 현황 3/5 → 예산 4/5 → 취향 5/5 → 완료
 *
 * **큰 질문 하나 = Step 하나.** 지역 안의 시/도 → 구, 준비 현황의 다중 선택은
 * 화면 안에서 끝나고 Step으로 세지 않는다. 진행바와 «N/5»는 이 다섯 개로만 움직인다.
 *
 * 화면(`app/setup.tsx`)은 여기 있는 함수로만 다음·이전·재개·요약을 정한다 —
 * 순서 규칙이 화면 코드 사이에 흩어지면 «바꾸기»로 되돌아간 뒤 어디로 가야 하는지
 * 화면마다 다르게 답하게 된다.
 */
export const QUESTION_STEPS = ['date', 'region', 'prep', 'budget', 'taste'] as const;

export type QuestionStep = (typeof QUESTION_STEPS)[number];

/**
 * 답. `null`은 «아직 답하지 않음»이고, 미정은 **답한 것**이라 null이 아니다 —
 * 예식일 `{ value: null }` · 지역 `{ region: null }` · 준비 현황 `{ categories: [] }` ·
 * 예산 `'unknown'`. 둘을 한 값으로 접으면 «바꾸기»로 되돌아간 질문이 미정으로
 * 답한 것인지 아직 안 답한 것인지 알 수 없다.
 */
export type Answers = {
  date: { value: string | null } | null;
  region: { region: WeddingRegion | null; district: string | null } | null;
  prep: { categories: VendorCategory[] } | null;
  budget: WeddingBudgetBracket | null;
  taste: { category: TasteCategory; keys: string[] } | null;
};

export const EMPTY_ANSWERS: Answers = { date: null, region: null, prep: null, budget: null, taste: null };

/** 예식일 · 지역의 미정 문구 — 둘 다 같은 말로 통일(v3.19). */
export const UNDECIDED_LABEL = '아직 정하지 않았어요';

/** 완료 요약 · 답 줄에서 미정값을 적는 말. 빈칸이나 «—»를 쓰지 않는다(SPEC §13.6). */
export const UNDECIDED_VALUE = '미정';

/** 답 줄 · 완료 요약의 라벨. */
export const STEP_LABEL: Record<QuestionStep, string> = {
  date: '예식일',
  region: '지역',
  prep: PREPARED_CATEGORIES_LABEL,
  budget: BUDGET_BRACKET_FIELD_LABEL,
  taste: '취향',
};

/**
 * 질문 제목. 줄바꿈은 시안(20-onboarding-v2 `q`)이 손으로 나눈 자리 그대로다.
 * 예산·취향 제목은 도메인 상수와 같은 문장이어야 한다(테스트가 지킨다).
 */
export const STEP_TITLE_LINES: Record<QuestionStep, readonly [string, string]> = {
  date: ['예식일이', '언제인가요?'],
  region: ['어디에서', '식을 올리시나요?'],
  prep: ['준비는 어디까지', '하셨어요?'],
  budget: ['앞으로 남은 예산은', '얼마인가요?'],
  taste: ['남은 준비는', '어떤 분위기가 좋으세요?'],
};

export const DONE_TITLE_LINES = ['이제 필요한 것만', '보여드릴게요'] as const;

/** 질문 아래 한 줄 — 입력 안내가 아니라 서비스가 해주는 일(v3.21 «문구 최종»). */
const STEP_DESCRIPTION: Record<Exclude<QuestionStep, 'taste'>, string> = {
  date: '남은 기간에 맞춰 웨딩픽이 도와드려요',
  region: '선택한 지역으로 좁혀드려요',
  prep: '이미 준비한 건 추천에서 제외해요',
  budget: BUDGET_STEP_DESCRIPTION,
};

export const DONE_CTA = '웨딩픽 시작하기';
export const NEXT_CTA = '다음';
export const PREV_CTA = '이전';

/** 취향 CTA — «N장 선택». 완료 화면이 뒤에 있으므로 «시작하기»를 붙이지 않는다. */
export function tasteCta(count: number): string {
  return `${count}장 선택`;
}

/**
 * 5/5에서 물을 업종. 준비 현황에서 완료로 체크하지 않은 첫 업종이고, 아직
 * 준비 현황을 답하지 않았으면 «아무것도 준비 안 함»으로 보고 첫 업종(웨딩홀)이다.
 * 전부 준비했으면 null — 그때 5/5는 통째로 건너뛴다.
 */
export function tasteCategoryFor(answers: Answers): TasteCategory | null {
  return nextTasteCategory(answers.prep?.categories ?? []);
}

/** 이 답 상태에서 실제로 묻는 Step. 취향은 물을 업종이 있을 때만 들어간다. */
export function stepsFor(answers: Answers): readonly QuestionStep[] {
  return tasteCategoryFor(answers) === null
    ? QUESTION_STEPS.filter((step) => step !== 'taste')
    : QUESTION_STEPS;
}

/**
 * 답했는가. 취향은 «지금 물을 업종»의 키가 최소 장수만큼 있어야 답한 것이다 —
 * 준비 현황을 바꿔 업종이 달라지면 예전 업종의 취향은 답이 아니다.
 */
export function isAnswered(step: QuestionStep, answers: Answers): boolean {
  switch (step) {
    case 'date':
      return answers.date !== null;
    case 'region':
      return answers.region !== null;
    case 'prep':
      return answers.prep !== null;
    case 'budget':
      return answers.budget !== null;
    case 'taste':
      return (
        answers.taste !== null &&
        answers.taste.category === tasteCategoryFor(answers) &&
        answers.taste.keys.length >= TASTE_MIN_PICKS
      );
  }
}

/**
 * «다음»이 여는 질문. 지금 질문 뒤에서 아직 답하지 않은 첫 질문이고, 남은 것이
 * 없으면 null — 완료로 간다. «바꾸기»로 되돌아가 고친 뒤 «다음»을 누르면 이미
 * 답한 질문을 다시 거치지 않는다(SPEC §13.6 «뒤의 답은 유지됩니다»).
 */
export function nextStep(current: QuestionStep, answers: Answers): QuestionStep | null {
  const steps = stepsFor(answers);
  const index = steps.indexOf(current);

  return steps.slice(index + 1).find((step) => !isAnswered(step, answers)) ?? null;
}

/** «이전»이 여는 질문. 첫 질문이면 null — 로그인으로 나간다. */
export function prevStep(current: QuestionStep, answers: Answers): QuestionStep | null {
  const steps = stepsFor(answers);
  const index = steps.indexOf(current);

  return index > 0 ? steps[index - 1]! : null;
}

/** 다시 열었을 때 이어서 물을 질문. 전부 답했으면 null. */
export function resumeStep(answers: Answers): QuestionStep | null {
  return stepsFor(answers).find((step) => !isAnswered(step, answers)) ?? null;
}

/** 진행바 20 → 40 → 60 → 80 → 100%와 «N/5». 다섯 질문 기준으로만 움직인다. */
export function stepProgress(step: QuestionStep): { percent: number; label: string } {
  const index = QUESTION_STEPS.indexOf(step);

  return { percent: ((index + 1) / QUESTION_STEPS.length) * 100, label: `${index + 1}/${QUESTION_STEPS.length}` };
}

export const DONE_PROGRESS = { percent: 100, label: '완료' } as const;

export function stepDescription(step: QuestionStep, answers: Answers): string {
  if (step !== 'taste') return STEP_DESCRIPTION[step];

  const category = tasteCategoryFor(answers);

  /* 물을 업종이 없으면 이 Step 자체가 열리지 않는다 — 형식상 첫 업종의 문구다. */
  return tasteStepDescription(category ?? 'hall');
}

/**
 * 답 줄과 완료 요약에 적는 값. 답하지 않았으면 null. 미정은 «미정», 준비 현황은
 * «아직 시작 전이에요»(도메인 요약이 그렇게 적는다), 다중 선택은 «첫 항목 외 N».
 */
export function answerSummary(step: QuestionStep, answers: Answers): string | null {
  switch (step) {
    case 'date':
      if (answers.date === null) return null;

      return answers.date.value === null ? UNDECIDED_VALUE : formatDateDot(answers.date.value);
    case 'region':
      if (answers.region === null) return null;
      if (answers.region.region === null) return UNDECIDED_VALUE;

      return answers.region.district
        ? `${answers.region.region} ${answers.region.district}`
        : answers.region.region;
    case 'prep':
      if (answers.prep === null) return null;

      return summarizePreparedCategories(answers.prep.categories);
    case 'budget':
      if (answers.budget === null) return null;

      return answers.budget === 'unknown' ? UNDECIDED_VALUE : BUDGET_BRACKET_LABEL[answers.budget];
    case 'taste':
      if (!isAnswered('taste', answers) || answers.taste === null) return null;

      return summarizeTasteKeys(answers.taste.category, answers.taste.keys);
  }
}

export type AnsweredRowModel = { step: QuestionStep; label: string; value: string };

/**
 * 화면 아래에 쌓이는 답 줄. Step 순서 그대로 위에서 아래로 — 최근 답을 위로
 * 올리지 않는다. 지금 열린 질문은 빠지고, 취향은 줄로 접지 않는다(시안 5/5에는
 * 답 줄이 없다 — 사진 격자가 화면을 다 쓴다).
 */
export function answeredRows(active: QuestionStep, answers: Answers): AnsweredRowModel[] {
  const rows: AnsweredRowModel[] = [];

  for (const step of QUESTION_STEPS) {
    if (step === active || step === 'taste') continue;

    const value = answerSummary(step, answers);

    if (value !== null) rows.push({ step, label: STEP_LABEL[step], value });
  }

  return rows;
}

/**
 * 완료 요약 5행. 항상 다섯 줄이다 — 취향을 건너뛰었으면 «미정»으로 적는다.
 * 빈칸이나 «—»는 쓰지 않는다.
 */
export function doneRows(answers: Answers): AnsweredRowModel[] {
  return QUESTION_STEPS.map((step) => ({
    step,
    label: STEP_LABEL[step],
    value: answerSummary(step, answers) ?? UNDECIDED_VALUE,
  }));
}

/** D-day 한 줄 «예식일까지 250일 남았어요». 숫자만 코랄이라 세 조각으로 준다. */
export function ddayParts(days: number): { prefix: string; number: string; suffix: string } {
  return { prefix: '예식일까지', number: `${days}일`, suffix: '남았어요' };
}

/** 지금 답으로 «다음»을 누를 수 있는가. 취향만 최소 1장 필수 — 나머지는 미정도 답이다. */
export function canAdvance(step: QuestionStep, answers: Answers): boolean {
  return isAnswered(step, answers);
}

/** `TASTE_STEP_TITLE` 등 도메인 제목과 줄 나눈 제목이 같은 문장인지 확인하는 데 쓴다. */
export const DOMAIN_TITLE: Partial<Record<QuestionStep, string>> = {
  budget: BUDGET_STEP_TITLE,
  taste: TASTE_STEP_TITLE,
};
