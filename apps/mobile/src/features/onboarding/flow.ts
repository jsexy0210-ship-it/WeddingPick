import {
  STYLE_PICK_MIN,
  WEDDING_STYLE_LABEL,
  formatDateDot,
  type WeddingRegion,
  type WeddingStyle,
} from '@weddingpick/domain';

import { common } from '../../../../../spec/strings.ko.json';

/**
 * 초기 설정 **3개 질문**의 순서와 규칙(2026-09-14 대표 확정 — 피그마
 * `docs/design/figma-export` `src/app/components/FlowScreens.tsx` `steps` 3단계 기준).
 *
 *   예식일 1/3 → 지역 2/3 → 스타일 3/3 → 완료
 *
 * **다섯에서 셋으로 줄였다.** 준비 현황과 예산을 첫 진입에서 묻지 않는다 — 두 값은
 * 없어진 것이 아니라 MY의 웨딩 설정(`app/(tabs)/my/wedding-settings.tsx`)에서 계속
 * 고칠 수 있고, 서버 계약(`completeSetup`)도 둘을 선택 항목으로 그대로 받는다.
 * 처음 들어온 사람에게 다섯 번 묻던 것을 세 번으로 줄인 것뿐이다.
 *
 * **3/3은 스타일이다.** 최신 06 정본도 4개 텍스트 버튼(도시적인 · 자연스러운 ·
 * 로맨틱한 · 화려한)으로 같은 계약을 쓴다. 최소 1개, 최대 2개다.
 *
 * 예식일은 3열 날짜 휠, 지역은 시/도 · 시/군/구 2열 휠 바텀시트다. 진행 화면에는
 * 선택한 값을 56px 필드로 보여준다.
 *
 * **큰 질문 하나 = Step 하나.** 지역 안의 시/도 → 구는 화면 안에서 끝나고 Step으로
 * 세지 않는다. 진행바와 «N/3»은 이 셋으로만 움직인다.
 *
 * 화면(`app/setup.tsx`)은 여기 있는 함수로만 다음·이전·재개·요약을 정한다 —
 * 순서 규칙이 화면 코드 사이에 흩어지면 «바꾸기»로 되돌아간 뒤 어디로 가야 하는지
 * 화면마다 다르게 답하게 된다.
 *
 * 3/3은 건너뛰지 않는다 — 스타일 4종은 업종과 무관한 축이고(v3.19 «범용 스타일»)
 * 최소 1개가 있어야 첫 화면에 보여줄 것이 생긴다.
 */
export const QUESTION_STEPS = ['date', 'region', 'style'] as const;

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
  /** 고른 순서 그대로. 빈 배열은 «아직 답하지 않음»과 같다. */
  style: readonly WeddingStyle[] | null;
};

export const EMPTY_ANSWERS: Answers = { date: null, region: null, style: null };

/** 예식일 · 지역의 미정 문구 — 둘 다 같은 말로 통일(v3.19). */
export const UNDECIDED_LABEL = '아직 정하지 않았어요';

/** 완료 요약 · 답 줄에서 미정값을 적는 말. 빈칸이나 «—»를 쓰지 않는다(SPEC §13.6). */
export const UNDECIDED_VALUE = '미정';

/** 답 줄 · 완료 요약의 라벨. */
export const STEP_LABEL: Record<QuestionStep, string> = {
  date: '예식일',
  region: '지역',
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
  region: ['어디에서', '식을 올리시나요?'],
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
export const DONE_TITLE_LINES = ['선택한 정보로', '준비할게요'] as const;

/**
 * 질문 아래 한 줄.
 *
 * 06-onboarding-login의 1/3은 «웨딩픽이 추천드려요»라고 그리지만 `spec/glossary.json`은
 * «추천드려요»를 값매김 표현으로 금지한다. 보이는 디자인보다 용어·금지어 정책이
 * 우선하므로 같은 뜻을 준비 순서로 풀어 쓴다.
 */
export const STEP_DESCRIPTION: Record<QuestionStep, string> = {
  date: '남은 기간에 맞춰 준비 순서를 잡아드릴게요',
  region: '선택한 지역으로 좁혀드려요',
  style: '마음에 드는 스타일을 골라주세요',
};

/** 06-onboarding-login 정본의 스타일 버튼 보조 문구. */
export const STYLE_DESCRIPTION: Record<WeddingStyle, string> = {
  URBAN: '모던하고 세련된 도심 분위기',
  NATURAL: '편안하고 빛이 좋은 야외 느낌',
  ROMANTIC: '부드럽고 사랑스러운 분위기',
  GLAMOROUS: '풍성하고 존재감 있는 스타일',
};

export const DONE_CTA = '웨딩픽 시작하기';

/** 1/3 · 2/3의 하단 CTA. 3/3은 정본대로 선택 개수를 표시한다. */
export const NEXT_CTA = common['cta.next'];
export const PREV_CTA = '이전';

/** 3/3 정본 CTA — 사진 단위 «장»이 아니라 버튼 선택 개수 «개». */
export function styleCta(count: number): string {
  return `${count}개 선택`;
}

/** 이 답 상태에서 묻는 Step. 셋 전부 — 건너뛰는 질문이 없다. */
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

/** 진행바 33 → 67 → 100%와 «N/3». 세 질문 기준으로만 움직인다. */
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
 * 답 줄과 완료 요약에 적는 값. 답하지 않았으면 null. 미정은 «미정»이고, 스타일은
 * 최대 두 가지라 고른 값을 순서대로 모두 적는다.
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
    case 'style':
      if (!isAnswered('style', answers) || answers.style === null) return null;

      return summarizeStyles(answers.style);
  }
}

/**
 * 완료 요약 한 줄. **«바꾸기» 단추는 없다** — 2026-09-15 대표 지시로 답 줄과 함께
 * 걷어냈다. 라벨과 값만 읽는다.
 */
export type SummaryRow = { step: QuestionStep; label: string; value: string };

/**
 * 완료 요약 3행. 항상 세 줄이다 — 미정은 «미정»으로 적는다. 빈칸이나 «—»는
 * 쓰지 않는다.
 */
export function doneRows(answers: Answers): SummaryRow[] {
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
