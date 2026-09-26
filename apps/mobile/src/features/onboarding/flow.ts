import {
  MANUAL_DECISION_NAME_MAX,
  PREPARATION_GROUPS,
  PREPARATION_NOT_STARTED_LABEL,
  STYLE_PICK_MIN,
  WEDDING_STYLE_LABEL,
  formatDateDot,
  formatDday,
  type PreparationGroupKey,
  type VendorCategory,
  type WeddingRegion,
  type WeddingStyle,
} from '@weddingpick/domain';

import { common } from '../../../../../spec/strings.ko.json';

/**
 * 초기 설정 **5개 질문**의 순서와 규칙 — v3.28 정본
 * `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html` WP-AUTH-002 ~ 007.
 *
 *   예식일 1/5 → 지역 2/5 → 진행 상황 3/5 → 예산 4/5 → 스타일 5/5 → 완료
 *
 * **셋에서 다시 다섯이 됐다**(2026-09-22 v3.28 — 「5단계로 늘리고 「JUST FOR YOU」
 * 영문 라벨과 「나중에」 건너뛰기를 없앴습니다」). 2026-09-14의 3단계는 그때의
 * 피그마 기준이었고, v3.28이 그 위에 선다(CLAUDE.md 맨 앞 「모든 작업은 v3.28
 * 기준이다」). 준비 현황과 예산은 MY의 웨딩 설정에서도 계속 고칠 수 있다.
 *
 * **큰 질문 하나 = Step 하나.** 지역 안의 시/도 → 구는 화면 안에서 끝나고 Step으로
 * 세지 않는다. 진행바와 «N/5»는 이 다섯으로만 움직인다.
 *
 * 화면(`app/setup.tsx`)은 여기 있는 함수로만 다음·이전·재개·요약을 정한다 —
 * 순서 규칙이 화면 코드 사이에 흩어지면 «바꾸기»로 되돌아간 뒤 어디로 가야 하는지
 * 화면마다 다르게 답하게 된다.
 *
 * 5/5(스타일)만 건너뛰지 못한다 — 최소 1개가 있어야 첫 화면에 보여줄 것이 생긴다.
 * 나머지 넷은 미정도 답이다(정본 대조표 「건너뛰기 → 뺌 · 미정 선택지로 대신」).
 */
export const QUESTION_STEPS = ['date', 'region', 'prep', 'budget', 'style'] as const;

/** 준비 순서에 있는 업종 — «기타»는 준비 단계가 아니라 계약(`preparedCategoriesSchema`)도 받지 않는다. */
export type PreparedCategory = Exclude<VendorCategory, 'etc'>;

export type QuestionStep = (typeof QUESTION_STEPS)[number];

/**
 * 답. `null`은 «아직 답하지 않음»이고, 미정은 **답한 것**이라 null이 아니다 —
 * 예식일 `{ value: null }` · 지역 `{ region: null }` · 진행 상황 `{ categories: [] }` ·
 * 예산 `{ amount: null }`. 둘을 한 값으로 접으면 «바꾸기»로 되돌아간 질문이 미정으로
 * 답한 것인지 아직 안 답한 것인지 알 수 없다. 스타일만 미정이 없다 — 최소 1개 필수.
 */
export type Answers = {
  date: { value: string | null } | null;
  region: { region: WeddingRegion | null; district: string | null } | null;
  /**
   * 이미 정한 업종. 빈 배열은 «아직 시작 전» — 카드를 하나도 안 고르고 «다음»을 누른 것.
   * `vendors`는 카드마다 검색 시트로 고른 업체다(2026-09-26 대표 지시) — 없는 카드는
   * 업체를 안 고른 것이고, 옛 초안에는 칸 자체가 없다.
   */
  prep: { categories: readonly PreparedCategory[]; vendors?: PrepVendors } | null;
  /** 앞으로 쓸 예산(만원). null은 적지 않고 «다음»을 누른 것. */
  budget: { amount: number | null } | null;
  /** 고른 순서 그대로. 빈 배열은 «아직 답하지 않음»과 같다. */
  style: readonly WeddingStyle[] | null;
};

export const EMPTY_ANSWERS: Answers = { date: null, region: null, prep: null, budget: null, style: null };

/** 예식일의 미정 칩 문구(WP-AUTH-002 `chipUndecided`). 지역 화면에는 칩이 없다(v3.28). */
export const UNDECIDED_LABEL = '아직 정하지 않았어요';

/** 완료 요약 · 답 줄에서 미정값을 적는 말. 빈칸이나 «—»를 쓰지 않는다(SPEC §13.6). */
export const UNDECIDED_VALUE = '미정';

/** 완료 요약의 라벨 — WP-AUTH-007 `summary` 다섯 줄 그대로. */
export const STEP_LABEL: Record<QuestionStep, string> = {
  date: '예식일',
  region: '지역',
  prep: '준비 현황',
  budget: '예산',
  style: '스타일',
};

/**
 * 히어로 문구 — WP-AUTH-002 ~ 006 `qTitle` 그대로. 제목의 줄바꿈은 시안의 `<br>`
 * 자리다.
 */
export const STEP_TITLE_LINES: Record<QuestionStep, readonly [string, string]> = {
  date: ['예식일은', '언제인가요?'],
  region: ['어디에서', '식을 올리시나요?'],
  prep: ['준비는', '어디까지 했나요?'],
  budget: ['앞으로 쓸 예산은', '얼마인가요?'],
  style: ['어떤 스타일을', '좋아하세요?'],
};

/** 완료 화면 제목 — WP-AUTH-007 「이대로 시작할까요?」. */
export const DONE_TITLE_LINES = ['이대로', '시작할까요?'] as const;

/** 완료 화면 제목 아래 한 줄 — WP-AUTH-007 `qSub`. */
export const DONE_DESCRIPTION = 'MY에서 언제든 바꿀 수 있어요';

/**
 * 질문 아래 한 줄 — v3.29 정본 `대메뉴_홈(로그인, 온보딩).dc.html` WP-AUTH-002 ~ 006
 * `qSub` 그대로.
 *
 * **v3.28까지 budget 줄이 「예산에 맞춰 웨딩픽이 골라드려요」였다.** v3.29 핵심
 * 메시지가 「웨딩픽이 골라준다」 표현을 전부 지운다(README·PROJECT_RULES.md
 * 「추천 · 결정사 · 플래너 대행 개념은 어디에도 쓰지 않는다」) — 온보딩 질문
 * 문구도 예외가 아니다. v3.29 시안 문구로 그대로 바꾼다.
 */
export const STEP_DESCRIPTION: Record<QuestionStep, string> = {
  date: '남은 기간에 맞춰 지금 정할 것부터 알려드려요',
  region: '선택한 지역으로 좁혀드려요',
  prep: '이미 정한 건 내 웨딩 준비에 바로 넣어드려요',
  budget: '예산에 맞는 업체부터 보여드려요',
  style: '마음에 드는 스타일을 골라주세요',
};

/** WP-AUTH-006 `styleBtns`의 보조 문구. */
export const STYLE_DESCRIPTION: Record<WeddingStyle, string> = {
  URBAN: '모던하고 세련된 도심 분위기',
  NATURAL: '편안하고 빛이 좋은 야외 느낌',
  ROMANTIC: '부드럽고 사랑스러운 분위기',
  GLAMOROUS: '풍성하고 존재감 있는 스타일',
};

/**
 * 진행 상황(3/5)의 카드 넷 — WP-AUTH-004 `PREP_CATS` 그대로(이름 · 부제). 부제는
 * 시안 문구를 그대로 쓴다. 카드 하나가 업종 묶음 하나다 — 고르면 그 업종이 전부
 * «결정 완료»로 서버(`preparedCategories`)에 간다.
 *
 * 업종 묶음은 `PREPARATION_GROUPS`(도메인 v3.22)와 같다 — 첫 카드 «웨딩홀 · 예식장 ·
 * 식대 · 대관»은 웨딩홀 하나다. 결정사는 2026-09-24 대표 지시로 업종에서 뺐다.
 */
export type PrepCard = {
  key: 'hall' | 'sdm' | 'ceremony' | 'goods';
  name: string;
  description: string;
  /**
   * 이 카드가 들어가는 Pick 묶음 — `/pick?group=<group>`의 그 키다(`PREPARATION_GROUPS`).
   * 카드에서 고른 업체는 업종이 이 묶음 안이라 Pick «담은 곳»의 같은 묶음에 선다.
   */
  group: PreparationGroupKey;
  categories: readonly PreparedCategory[];
};

/** 묶음의 업종 — 카드마다 손으로 다시 적지 않고 `PREPARATION_GROUPS` 하나에서 읽는다. */
function groupCategories(group: PreparationGroupKey): readonly PreparedCategory[] {
  return (PREPARATION_GROUPS.find((one) => one.key === group)?.categories ?? []) as readonly PreparedCategory[];
}

export const PREP_CARDS: readonly PrepCard[] = [
  { key: 'hall', name: '웨딩홀', description: '예식장 · 식대 · 대관', group: 'start', categories: groupCategories('start') },
  {
    key: 'sdm',
    name: '스드메',
    description: '스튜디오 · 드레스 · 메이크업',
    group: 'sdm',
    categories: groupCategories('sdm'),
  },
  { key: 'ceremony', name: '본식', description: '본식스냅 · 부케 · 청첩장', group: 'ceremony', categories: groupCategories('ceremony') },
  { key: 'goods', name: '예물 · 신혼', description: '예물 · 혼수 · 허니문', group: 'goods', categories: groupCategories('goods') },
];

/** 준비 현황 카드에서 목록으로 고른 업체 한 곳. 줄에 이름을 적고 저장할 때 id를 보낸다. */
export type PrepVendor = { id: string; name: string; category: PreparedCategory };

/**
 * 목록에 없어 **직접 입력한** 곳(2026-09-26 대표 지시 「직접입력하는 방법 고안하라」).
 * 업체가 없어 id가 없다 — 저장하면 서버가 그 묶음의 결정으로 이름만 남긴다.
 */
export type PrepManual = { manual: true; name: string };

/** 카드 하나의 답 — 목록 업체 또는 직접 입력한 이름. */
export type PrepChoice = PrepVendor | PrepManual;

export type PrepVendors = Partial<Record<PrepCard['key'], PrepChoice>>;

export function isPrepManual(choice: PrepChoice): choice is PrepManual {
  return 'manual' in choice && choice.manual === true;
}

/** 카드를 켜고 그 카드의 답을 적는다. */
function withChoice(prep: Answers['prep'], card: PrepCard, choice: PrepChoice): NonNullable<Answers['prep']> {
  const categories = prep?.categories ?? [];
  const on = isPrepCardSelected(card, categories) ? [...categories] : togglePrepCard(card, categories);

  return { categories: on, vendors: { ...prep?.vendors, [card.key]: choice } };
}

/**
 * 검색 시트에서 업체를 골랐다 — 그 카드를 켜고(업종 전부 «결정 완료») 업체를 적는다.
 * 카드 밖 업종의 업체는 받지 않는다(시트가 카드 업종으로만 찾으므로 오지 않지만,
 * 오면 Pick의 다른 묶음에 들어가 홈과 Pick이 어긋난다).
 */
export function choosePrepVendor(
  prep: Answers['prep'],
  card: PrepCard,
  vendor: PrepVendor
): NonNullable<Answers['prep']> {
  if (!card.categories.includes(vendor.category)) return prep ?? { categories: [] };

  return withChoice(prep, card, vendor);
}

/** 직접 입력한 이름 — 앞뒤 공백을 떼고, 비었거나 30자를 넘으면 null(저장 단추가 잠긴다). */
export function manualPrepName(text: string): string | null {
  const name = text.trim();

  return name.length > 0 && name.length <= MANUAL_DECISION_NAME_MAX ? name : null;
}

/** 직접 입력으로 정했다 — 그 카드를 켜고 이름을 적는다. 이름이 맞지 않으면 그대로 둔다. */
export function choosePrepManual(prep: Answers['prep'], card: PrepCard, text: string): NonNullable<Answers['prep']> {
  const name = manualPrepName(text);

  if (name === null) return prep ?? { categories: [] };

  return withChoice(prep, card, { manual: true, name });
}

/**
 * 시트의 «아직 정한 곳이 없어요» — 그 카드를 지금의 미정 상태(꺼짐)로 돌린다. 업체도
 * 지운다. Pick에는 아무것도 넣지 않는다.
 */
export function clearPrepCard(prep: Answers['prep'], card: PrepCard): NonNullable<Answers['prep']> {
  const categories = (prep?.categories ?? []).filter((category) => !card.categories.includes(category));
  const vendors: PrepVendors = { ...prep?.vendors };

  delete vendors[card.key];

  return Object.keys(vendors).length > 0 ? { categories, vendors } : { categories };
}

/** 카드 줄에 적는 답(업체 · 직접 입력). 카드가 꺼져 있으면(답이 남아 있어도) 없다. */
export function prepVendorOf(prep: Answers['prep'], card: PrepCard): PrepChoice | null {
  const vendor = prep?.vendors?.[card.key];

  if (!vendor || !isPrepCardSelected(card, prep?.categories ?? [])) return null;

  return vendor;
}

/** 저장할 때 서버(`preparedVendorIds`)에 보낼 업체 id — 카드 순서대로, 켜진 카드만. 직접 입력은 없다. */
export function preparedVendorIds(prep: Answers['prep']): string[] {
  return PREP_CARDS.map((card) => prepVendorOf(prep, card))
    .filter((choice): choice is PrepVendor => choice !== null && !isPrepManual(choice))
    .map((vendor) => vendor.id);
}

/** 저장할 때 서버(`preparedManualVendors`)에 보낼 직접 입력 — 카드(묶음)와 이름. */
export function preparedManualVendors(prep: Answers['prep']): { group: PreparationGroupKey; name: string }[] {
  return PREP_CARDS.flatMap((card) => {
    const choice = prepVendorOf(prep, card);

    return choice !== null && isPrepManual(choice) ? [{ group: card.group, name: choice.name }] : [];
  });
}

/**
 * 온보딩 «완료» 요청에 얹는 준비 현황 답 — 빈 칸은 키째 보내지 않는다. 서버가 같은
 * 트랜잭션에서 Pick 담기 · 결정을 남긴다(`POST /v1/me/setup`).
 */
export function preparedChoicesPayload(prep: Answers['prep']): {
  preparedVendorIds?: string[];
  preparedManualVendors?: { group: PreparationGroupKey; name: string }[];
} {
  const vendorIds = preparedVendorIds(prep);
  const manual = preparedManualVendors(prep);

  return {
    ...(vendorIds.length > 0 ? { preparedVendorIds: vendorIds } : {}),
    ...(manual.length > 0 ? { preparedManualVendors: manual } : {}),
  };
}

/** 카드가 켜져 있는가 — 카드의 업종이 전부 고른 목록에 있어야 켜진 것이다. */
export function isPrepCardSelected(card: PrepCard, categories: readonly PreparedCategory[]): boolean {
  return card.categories.every((category) => categories.includes(category));
}

/** 카드를 누른 뒤의 업종 목록. 켜져 있으면 그 카드의 업종을 전부 빼고, 꺼져 있으면 전부 넣는다. */
export function togglePrepCard(card: PrepCard, categories: readonly PreparedCategory[]): PreparedCategory[] {
  if (isPrepCardSelected(card, categories)) {
    return categories.filter((category) => !card.categories.includes(category));
  }

  return [...categories.filter((category) => !card.categories.includes(category)), ...card.categories];
}

/**
 * 진행 상황 요약 «웨딩홀 · 본식» — 카드 순서대로. 하나도 없으면 «아직 시작 전이에요».
 * 카드에서 업체를 골랐거나 직접 입력했으면 그 이름을 괄호로 붙인다 «웨딩홀(○○홀) · 본식»
 * (2026-09-26 대표 지시 — 직접 입력한 이름이 완료 요약에도 보여야 한다).
 */
export function summarizePrep(prep: Answers['prep']): string {
  const categories = prep?.categories ?? [];
  const names = PREP_CARDS.filter((card) => isPrepCardSelected(card, categories)).map((card) => {
    const choice = prepVendorOf(prep, card);

    return choice === null ? card.name : `${card.name}(${choice.name})`;
  });

  return names.length > 0 ? names.join(' · ') : PREPARATION_NOT_STARTED_LABEL;
}

/**
 * 예산(4/5) 빠른 입력 칩 — WP-AUTH-005 `amtQuick` 그대로. 앞 셋은 지금 금액에
 * 더하고 «지우기»는 비운다.
 */
export const BUDGET_QUICK_CHIPS: readonly { label: string; add: number | null }[] = [
  { label: '+100만', add: 100 },
  { label: '+500만', add: 500 },
  { label: '+1,000만', add: 1_000 },
  { label: '지우기', add: null },
];

/** 예산 칸 아래 한 줄 — WP-AUTH-005 `amtNote`. */
export const BUDGET_NOTE = '이미 정한 곳에 쓴 돈은 빼고 적어주세요';

/** 예산 칸의 단위 — 만원 단위로만 적는다. */
export const BUDGET_UNIT = '만원';

/** 만원 금액에 천단위 쉼표 — «5,000». 단위는 붙이지 않는다(칸 옆에 따로 선다). */
export function formatManWonDigits(manWon: number): string {
  return manWon.toLocaleString('ko-KR');
}

/** 예산 요약 «5,000만원». 적지 않았으면 «미정». */
export function summarizeBudget(amount: number | null): string {
  return amount === null || amount <= 0 ? UNDECIDED_VALUE : `${formatManWonDigits(amount)}${BUDGET_UNIT}`;
}

export const DONE_CTA = '웨딩픽 시작하기';

/** 하단 CTA — 다섯 질문 모두 «다음»이다(WP-AUTH-002 ~ 006 dock). */
export const NEXT_CTA = common['cta.next'];
export const PREV_CTA = '이전';

/** 완료 요약 행의 단추 — WP-AUTH-007 `sumEdit`. 누르면 그 질문으로 돌아간다. */
export const EDIT_CTA = '바꾸기';

/** 이 답 상태에서 묻는 Step. 다섯 전부 — 건너뛰는 질문이 없다. */
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
 * 답 줄과 완료 요약에 적는 값. 답하지 않았으면 null. 미정은 «미정»이고, 스타일은
 * 고른 값을 순서대로 모두 적는다(개수 제한 없음 — 넷이면 넷 다).
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

      return summarizePrep(answers.prep);
    case 'budget':
      if (answers.budget === null) return null;

      return summarizeBudget(answers.budget.amount);
    case 'style':
      if (!isAnswered('style', answers) || answers.style === null) return null;

      return summarizeStyles(answers.style);
  }
}

/**
 * 완료 요약 한 줄 — 라벨 · 값 · «바꾸기»(WP-AUTH-007 「여기서 바꾸면 해당 단계로
 * 돌아갑니다」). 2026-09-15에 걷어냈던 «바꾸기»가 v3.28 정본에서 돌아왔다.
 */
export type SummaryRow = { step: QuestionStep; label: string; value: string };

/**
 * 완료 요약 5행. 항상 다섯 줄이다 — 미정은 «미정»으로 적는다. 빈칸이나 «—»는
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

/** 시트의 «D-250». 0이면 «D-DAY»(SPEC §13.6 «D-day 계산» 표) — domain `formatDday` 하나를 쓴다. */
export function ddayLabel(days: number): string {
  return formatDday(days);
}

/**
 * «다음»이 미정으로 확정해 주는 질문 — 진행 상황 · 예산. 지역은 2026-09-25 대표 지시
 * 「지역 선택 필수값이다」로 빠졌다 — 시/도를 골라야 «다음»이 켜진다.
 */
const SETTLED_BY_NEXT: readonly QuestionStep[] = ['prep', 'budget'];

/**
 * 지금 답으로 «다음»을 누를 수 있는가. 스타일은 최소 1개, 지역은 시/도 하나가 필수다.
 * 진행 상황 · 예산은 아무것도 안 고르고도 누를 수 있다(누르는 순간 `settleAnswer`가
 * 미정으로 적는다).
 */
export function canAdvance(step: QuestionStep, answers: Answers): boolean {
  if (SETTLED_BY_NEXT.includes(step)) return true;
  if (step === 'region') return answers.region !== null && answers.region.region !== null;

  return isAnswered(step, answers);
}

/**
 * «다음»을 누를 때 아직 null인 진행 상황 · 예산을 미정으로 확정한다 — 카드를 하나도
 * 안 골랐으면 «아직 시작 전», 금액을 안 적었으면 «미정»(지역은 필수라 여기 없다). 시안의 세 화면에는 미정 칩이 따로 없어서 «다음» 자체가 미정 선택이다.
 */
export function settleAnswer(step: QuestionStep, answers: Answers): Answers {
  if (step === 'prep' && answers.prep === null) return { ...answers, prep: { categories: [] } };
  if (step === 'budget' && answers.budget === null) return { ...answers, budget: { amount: null } };

  return answers;
}
