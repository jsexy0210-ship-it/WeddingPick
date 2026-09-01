import { TERMS } from './terms';

/**
 * 무엇을 나란히 놓고 견줄 것인가. 통합정책 v3.13 §O-5.
 *
 * v3.12가 비교에 실을 것을 여덟 가지로 늘렸고, v3.13이 그 조항을 §O-5로 옮겨
 * 담았다. 늘리는 것 자체보다 **어느 값이 누구 말인지 갈라두는 것**이 요점이다.
 *
 * 지금까지 비교표에는 사실상 금액 한 칸뿐이었다. 거기에 업체가 밝힌 공개가격과
 * 우리가 확인한 금액을 같이 넣으면, 읽는 사람은 두 값을 같은 종류로 본다. 그런데
 * 둘은 다르다 — 하나는 업체가 말한 값이고 하나는 사용자 자료에서 확인한 값이다.
 * 축마다 `kind`를 달아 그것을 못 섞게 한다.
 *
 * **순위를 매기지 않는다.** v3.10 §9와 v3.13 §O-5가 비교 화면에서 가격 가치판단을
 * 금지했다. 이 파일에는 정렬도 점수도 `best`도 없다 — 어느 곳이 나은지는 사용자가
 * 정한다.
 */

/**
 * 이 축의 값이 어디서 오는가.
 *
 *   - `pick`   우리가 Pick 인증으로 확인한 값
 *   - `vendor` 업체가 밝힌 값
 *   - `terms`  조건. 금액이 아니라 글이다.
 */
export const AXIS_KINDS = ['pick', 'vendor', 'terms'] as const;

export type AxisKind = (typeof AXIS_KINDS)[number];

export type ComparisonAxis = {
  key: string;
  /** 화면에 그대로 나가는 이름. */
  label: string;
  kind: AxisKind;
  /** 지금 이 축에 채울 자료가 있는지. */
  ready: boolean;
  /** 없으면 왜 없는지. 빈 칸을 그리지 않기 위해 필요하다. */
  note?: string;
};

/**
 * 비교표의 축. **순서가 곧 화면 순서다.**
 *
 * 확인된 값을 위에 둔다. 업체가 밝힌 값과 조건이 그 아래다 — 우리가 확인한 것과
 * 업체가 말한 것 사이에 눈에 보이는 선이 있어야 한다.
 */
export const COMPARISON_AXES = [
  {
    key: 'pick_price_range',
    label: `${TERMS.pick} 가격대`,
    kind: 'pick',
    ready: true,
  },
  {
    key: 'official_price',
    label: '업체가 공개한 가격',
    kind: 'vendor',
    ready: false,
    note: '업체가 공개한 가격을 아직 모으지 않았어요',
  },
  {
    key: 'official_promotion',
    label: '업체가 안내한 혜택',
    kind: 'vendor',
    ready: false,
    note: '혜택 자료를 아직 모으지 않았어요',
  },
  {
    key: 'included_or_separate',
    label: '포함 · 별도',
    kind: 'terms',
    ready: false,
    note: '무엇이 포함인지 갈라 적을 자료가 아직 없어요',
  },
  {
    key: 'possible_extra_cost',
    label: TERMS.extraCost,
    kind: 'terms',
    ready: false,
    note: '추가로 드는 항목을 아직 모으지 않았어요',
  },
  {
    key: 'guaranteed_guests',
    label: '보증인원',
    kind: 'terms',
    ready: false,
    note: '보증인원은 상품마다 달라 상품 자료가 먼저 필요해요',
  },
  {
    key: 'refund_change_terms',
    label: '환불 · 변경 조건',
    kind: 'terms',
    ready: false,
    /* 우리가 요약해 적으면 그 요약이 분쟁의 근거가 된다. 업체 문구를 그대로 싣는다. */
    note: '업체가 밝힌 조건을 그대로 실을 자료가 아직 없어요',
  },
  {
    key: 'discount_condition',
    label: '할인을 유지하는 조건',
    kind: 'terms',
    ready: false,
    note: '할인 유지 조건을 아직 모으지 않았어요',
  },
] as const satisfies readonly ComparisonAxis[];

export type ComparisonAxisKey = (typeof COMPARISON_AXES)[number]['key'];

/** 지금 표에 실제로 그릴 수 있는 축만, 정책 순서대로. */
export function readyAxes(): ComparisonAxisKey[] {
  return COMPARISON_AXES.filter((axis) => axis.ready).map((axis) => axis.key);
}

/** 아직 자료가 없어 못 그리는 축. */
export function pendingAxes(): ComparisonAxisKey[] {
  return COMPARISON_AXES.filter((axis) => !axis.ready).map((axis) => axis.key);
}

/**
 * 한 축을 여는 머리말.
 *
 * `pick`과 `vendor`는 화면에서 같아 보이면 안 된다. 축 이름 옆에 누구 말인지를
 * 늘 붙인다 — 표는 값을 나란히 놓기 때문에, 붙여두지 않으면 나란히 놓였다는 이유만으로
 * 같은 종류로 읽힌다.
 */
export const AXIS_KIND_NOTE: Record<AxisKind, string> = {
  pick: `${TERMS.pick} 인증으로 확인한 금액이에요`,
  vendor: '업체가 밝힌 내용이라 확인 전이에요',
  terms: '업체가 밝힌 조건을 그대로 옮겼어요',
};

/**
 * 같은 표에 넣어도 되는가.
 *
 * 서로 다른 `kind`의 값을 한 칸에 합치는 일을 막는다. 합치면 확인된 금액과
 * 업체가 부른 값이 한 숫자가 되고, 그 숫자는 우리가 확인했다고 읽힌다.
 */
export function canMerge(a: AxisKind, b: AxisKind): boolean {
  return a === b;
}

/** 축 이름을 한 곳에서 꺼내 쓴다. 화면이 제 이름을 따로 적으면 SoT가 둘이 된다. */
export function axisLabel(key: ComparisonAxisKey): string {
  const axis = COMPARISON_AXES.find((candidate) => candidate.key === key);

  /* 키가 타입으로 막혀 있어 여기 올 일이 없다. 그래도 조용히 빈 칸을 그리지는 않는다. */
  if (!axis) throw new Error(`알 수 없는 비교 항목: ${key}`);

  return axis.label;
}
