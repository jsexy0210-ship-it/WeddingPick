import {
  BUDGET_BRACKET_FIELD_LABEL,
  BUDGET_BRACKET_LABEL,
  PREPARED_CATEGORIES_LABEL,
  STYLE_PICK_MIN,
  WEDDING_STYLE_LABEL,
  formatDateDot,
  summarizePreparedCategories,
  type VendorCategory,
  type WeddingBudgetBracket,
  type WeddingRegion,
  type WeddingStyle,
} from '@weddingpick/domain';

/**
 * 초기 설정 5개 질문의 순서와 규칙. 디자인 핸드오프 v3.22 SPEC §13.6 (WP-APP-020).
 *
 *   예식일 1/5 → 지역 2/5 → 준비 현황 3/5 → 예산 4/5 → 스타일 5/5 → 완료
 *
 * **큰 질문 하나 = Step 하나.** 지역 안의 시/도 → 구, 준비 현황의 다중 선택은
 * 화면 안에서 끝나고 Step으로 세지 않는다. 진행바와 «N/5»는 이 다섯 개로만 움직인다.
 *
 * 화면(`app/setup.tsx`)은 여기 있는 함수로만 다음·이전·재개·요약을 정한다 —
 * 순서 규칙이 화면 코드 사이에 흩어지면 «바꾸기»로 되돌아간 뒤 어디로 가야 하는지
 * 화면마다 다르게 답하게 된다.
 *
 * 5/5는 건너뛰지 않는다 — 스타일 4종은 업종과 무관한 축이라(v3.19 «범용 스타일»)
 * 준비 현황과 연동하지 않고, 준비 현황을 바꿔도 스타일을 지우지 않는다.
 */
export const QUESTION_STEPS = ['date', 'region', 'prep', 'budget', 'style'] as const;

export type QuestionStep = (typeof QUESTION_STEPS)[number];

/**
 * 답. `null`은 «아직 답하지 않음»이고, 미정은 **답한 것**이라 null이 아니다 —
 * 예식일 `{ value: null }` · 지역 `{ region: null }` · 준비 현황 `{ categories: [] }` ·
 * 예산 `'unknown'`. 둘을 한 값으로 접으면 «바꾸기»로 되돌아간 질문이 미정으로
 * 답한 것인지 아직 안 답한 것인지 알 수 없다. 스타일만 미정이 없다 — 최소 1개 필수.
 */
export type Answers = {
  date: { value: string | null } | null;
  region: { region: WeddingRegion | null; district: string | null } | null;
  prep: { categories: VendorCategory[] } | null;
  budget: WeddingBudgetBracket | null;
  /** 고른 순서 그대로. 빈 배열은 «아직 답하지 않음»과 같다. */
  style: readonly WeddingStyle[] | null;
};

export const EMPTY_ANSWERS: Answers = { date: null, region: null, prep: null, budget: null, style: null };

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
  style: '스타일',
};

/**
 * 히어로 문구 — SPEC §13.6 «히어로 문구 (확정)» 첫 표 그대로. 제목의 줄바꿈만
 * 시안(20-onboarding-v2 `q`)이 나눈 자리다. 설명은 «왜 묻는지»만 적는다 — 지시나
 * 기능 설명을 넣지 않고, 높임 어미를 겹치지 않는다(`하나요` `할까요`).
 *
 * 도메인 상수(`BUDGET_STEP_TITLE`)는 v3.21 문구라 여기와 다르다 — 화면은 이 표를
 * 따른다(2026-09-08 지침 «최신 핸드오프 md 기준»).
 */
export const STEP_TITLE_LINES: Record<QuestionStep, readonly [string, string]> = {
  date: ['예식일은', '언제인가요?'],
  region: ['어느 지역에서', '하나요?'],
  prep: ['준비는 어디까지', '했나요?'],
  budget: ['앞으로 쓸 예산은', '얼마인가요?'],
  style: ['어떤 스타일을', '좋아하세요?'],
};

/**
 * 완료 화면 제목.
 *
 * **가입이 끝났다는 사실을 먼저 말한다**(2026-09-09 사용자 결정). 예전 제목은
 * 「이제 필요한 것만 보여드릴게요」로 개인화 이야기만 해서, 이 화면이 회원가입의
 * 마지막 단계라는 것이 드러나지 않았다 — 카카오 개인정보 동의항목 심사가 가입
 * 절차를 확인할 수 없다고 반려한 것과 같은 문제다.
 */
export const DONE_TITLE_LINES = ['가입이', '완료됐어요'] as const;

/** 질문 아래 한 줄 — 서비스가 무엇을 해주는지(SPEC §13.6 첫 표 «설명»). */
export const STEP_DESCRIPTION: Record<QuestionStep, string> = {
  date: '남은 기간에 맞춰 준비 순서를 잡아드릴게요',
  region: '선택한 지역을 기준으로 찾아드릴게요',
  prep: '이미 정한 건 빼고 필요한 것만 챙겨드릴게요',
  budget: '예산에 맞는 선택지를 먼저 보여드릴게요',
  style: '마음에 드는 스타일을 골라주세요',
};

export const DONE_CTA = '웨딩픽 시작하기';
export const NEXT_CTA = '다음';
export const PREV_CTA = '이전';

/**
 * 스타일 CTA — 고른 **장수** 그대로 «N장 선택». 완료 화면이 뒤에 있으므로
 * «시작하기»를 붙이지 않는다. 0장이면 비활성.
 *
 * 세는 것이 이미지 장수라 단위는 «장»이다 — `spec/strings.ko.json`
 * `onboarding.taste.cta` · SPEC.md §「CTA는 «N장 선택»」 · 시안
 * `20-onboarding-v2.dc.html` «3장 선택». CHANGELOG v3.19가 한 번 «곳»으로
 * 적었지만 «곳»은 업체를 세는 말이고, 그 뒤의 SPEC과 시안이 «장»으로 돌아왔다.
 */
export function styleCta(count: number): string {
  return `${count}장 선택`;
}

/** 이 답 상태에서 묻는 Step. 다섯 개 전부 — 건너뛰는 질문이 없다. */
export function stepsFor(_answers: Answers): readonly QuestionStep[] {
  return QUESTION_STEPS;
}

/** 답했는가. 스타일은 최소 1개(`STYLE_PICK_MIN`)를 골라야 답한 것이다. */
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
    case 'style':
      return answers.style !== null && answers.style.length >= STYLE_PICK_MIN;
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

export function stepDescription(step: QuestionStep): string {
  return STEP_DESCRIPTION[step];
}

/** 스타일 요약 «도시적인 · 로맨틱한» — 고른 순서 그대로. */
export function summarizeStyles(styles: readonly WeddingStyle[]): string {
  return styles.map((style) => WEDDING_STYLE_LABEL[style]).join(' · ');
}

/**
 * 답 줄과 완료 요약에 적는 값. 답하지 않았으면 null. 미정은 «미정», 준비 현황은
 * «아직 시작 전이에요»(도메인 요약이 그렇게 적는다), 다중 선택은 «첫 항목 외 N»,
 * 스타일은 최대 2개라 «도시적인 · 로맨틱한»으로 다 적는다.
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
    case 'style':
      if (!isAnswered('style', answers) || answers.style === null) return null;

      return summarizeStyles(answers.style);
  }
}

export type AnsweredRowModel = { step: QuestionStep; label: string; value: string };

/**
 * 화면 아래에 쌓이는 답 줄. Step 순서 그대로 위에서 아래로 — 최근 답을 위로
 * 올리지 않는다. 지금 열린 질문은 빠진다.
 *
 * «바꾸기»로 다시 연 동안(`editing`)은 그 질문 **앞**의 답만 보인다 — 뒤에 답한
 * 값은 그대로 두되 화면에서 잠시 숨긴다(SPEC §13.6 «「바꾸기」 동작 정의 · 아래 줄»).
 */
export function answeredRows(active: QuestionStep, answers: Answers, editing = false): AnsweredRowModel[] {
  const rows: AnsweredRowModel[] = [];
  const activeIndex = QUESTION_STEPS.indexOf(active);

  for (const step of QUESTION_STEPS) {
    if (step === active) continue;
    if (editing && QUESTION_STEPS.indexOf(step) > activeIndex) continue;

    const value = answerSummary(step, answers);

    if (value !== null) rows.push({ step, label: STEP_LABEL[step], value });
  }

  return rows;
}

/**
 * «바꾸기»로 고친 뒤 «다음»이 돌아갈 곳. 원래 있던 Step으로 바로 복귀한다 —
 * 2/5를 고쳤다고 3/5 · 4/5를 다시 묻지 않는다(SPEC §13.6). 연쇄 초기화가 없으므로
 * 돌아갈 Step은 항상 남아 있다.
 */
export function returnStep(edited: QuestionStep, cameFrom: QuestionStep, answers: Answers): QuestionStep | null {
  return stepsFor(answers).includes(cameFrom) ? cameFrom : nextStep(edited, answers);
}

/**
 * 완료 요약 5행. 항상 다섯 줄이다 — 미정은 «미정»으로 적는다. 빈칸이나 «—»는
 * 쓰지 않는다.
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

/** 시트의 «D-250». 0이면 «D-DAY»(SPEC §13.6 «D-day 계산» 표). 음수는 고를 수 없어 오지 않는다. */
export function ddayLabel(days: number): string {
  return days === 0 ? 'D-DAY' : `D-${days}`;
}

/** 지금 답으로 «다음»을 누를 수 있는가. 스타일만 최소 1개 필수 — 나머지는 미정도 답이다. */
export function canAdvance(step: QuestionStep, answers: Answers): boolean {
  return isAnswered(step, answers);
}
