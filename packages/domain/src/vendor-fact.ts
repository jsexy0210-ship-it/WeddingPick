/**
 * 업체 상세에 싣는 사실 하나. 통합정책 v3.12 §3.
 *
 * v3.12가 상세에 더할 항목을 열거하면서 **마지막 확인일과 출처**를 같은 줄에
 * 넣었다. 그 둘은 항목이 아니라 **모든 항목이 함께 달고 다녀야 하는 것**이다 —
 * 주차 가능 여부를 적어두고 그것을 언제 어디서 확인했는지 적지 않으면, 반년 전
 * 업체 홈페이지에서 본 값과 어제 업체가 알려준 값이 화면에서 똑같아 보인다.
 *
 * 그래서 값과 출처와 확인일을 한 덩어리로 묶는다. **출처 없는 값은 만들 수 없다** —
 * 타입이 그것을 막는다. 나중에 항목을 더하는 사람이 정책을 안 읽어도, 값만 넣으면
 * 컴파일이 되지 않는다.
 */

/**
 * 이 값을 누가 말했는가.
 *
 * 섞지 않는다. 업체가 안내한 값과 사용자 자료에서 확인한 값은 다른 것이고,
 * 한 칸에 합쳐 적으면 어느 쪽이 틀렸을 때 무엇을 고쳐야 하는지 알 수 없다.
 */
export const VENDOR_FACT_SOURCES = ['vendor_notice', 'official_page', 'pick_verified'] as const;

export type VendorFactSource = (typeof VENDOR_FACT_SOURCES)[number];

/** 화면에 그대로 나가는 출처 표기. */
export const VENDOR_FACT_SOURCE_LABEL: Record<VendorFactSource, string> = {
  vendor_notice: '업체 안내',
  official_page: '업체 공식 페이지',
  pick_verified: 'Pick 인증으로 확인',
};

/**
 * 값 하나. 값·출처·확인일이 한 덩어리다.
 *
 * `value`가 null이면 **아직 모르는 것**이다. 0이나 빈 문자열로 두지 않는다 —
 * 주차 대수 0과 "주차 정보를 아직 모른다"는 화면에서 전혀 다른 말이어야 한다.
 */
export type VendorFact<T> = {
  value: T | null;
  source: VendorFactSource;
  /** `2026-08-14` 형태. 이 값을 마지막으로 확인한 날. */
  checkedOn: string;
};

/**
 * 상세에 싣는 항목들. v3.12 §3이 이름을 정했다.
 *
 * `ready`는 지금 우리에게 그 자료가 있는지다. 없는 자리는 화면에 빈 칸으로 뚫지
 * 않고 목록에서도 지우지 않는다(`vendor-detail.ts`와 같은 규칙) — 지우면 자료가
 * 생기는 날 어디에 넣을지를 다시 정해야 한다.
 */
export const VENDOR_FACT_FIELDS = [
  { key: 'parking', label: '주차', ready: false, note: '업체별 주차 자료를 아직 모으지 않았어요' },
  { key: 'valet', label: '발렛', ready: false, note: '발렛 운영 여부를 아직 모으지 않았어요' },
  {
    key: 'guaranteed_guests',
    label: '보증인원',
    ready: false,
    note: '보증인원은 상품마다 달라 상품 자료가 먼저 필요해요',
  },
  { key: 'meal_price', label: '식대', ready: false, note: '식대 자료를 아직 모으지 않았어요' },
  { key: 'hall_fee', label: '대관료', ready: false, note: '대관료 자료를 아직 모으지 않았어요' },
  { key: 'options', label: '선택 항목', ready: false, note: '선택 항목 자료를 아직 모으지 않았어요' },
  {
    key: 'extra_items',
    label: '추가로 드는 항목',
    ready: false,
    note: '추가 항목 자료를 아직 모으지 않았어요',
  },
  {
    key: 'change_cancel_terms',
    label: '변경·취소 조건',
    ready: false,
    /*
     * 이 자리는 특히 조심한다. 취소 조건을 우리가 요약해서 적으면 그 요약이
     * 분쟁의 근거가 된다. 자료가 생겨도 업체가 밝힌 문구를 그대로 싣고 출처를 단다.
     */
    note: '업체가 밝힌 조건을 그대로 실을 자료가 아직 없어요',
  },
] as const satisfies readonly {
  key: string;
  label: string;
  ready: boolean;
  note?: string;
}[];

export type VendorFactField = (typeof VENDOR_FACT_FIELDS)[number]['key'];

/** 지금 실제로 그릴 수 있는 항목. */
export function readyVendorFactFields(): VendorFactField[] {
  return VENDOR_FACT_FIELDS.filter((field) => field.ready).map((field) => field.key);
}

/** 아직 자료가 없어 못 그리는 항목. 무엇이 비었는지 한눈에 보이게 한다. */
export function pendingVendorFactFields(): VendorFactField[] {
  return VENDOR_FACT_FIELDS.filter((field) => !field.ready).map((field) => field.key);
}

/**
 * 값 아래에 붙는 한 줄. `업체 안내 · 2026-08-14 확인`
 *
 * 값을 화면에 적을 때 이 줄을 함께 적는다. 함수 하나로 만드는 이유는 화면마다
 * 다르게 적히는 것을 막기 위해서다.
 */
export function factCaption(fact: VendorFact<unknown>): string {
  return `${VENDOR_FACT_SOURCE_LABEL[fact.source]} · ${fact.checkedOn} 확인`;
}

/**
 * 값이 오래되었는가.
 *
 * 오래된 값을 지우지는 않는다 — 지우면 아무것도 안 보이고, 그것이 더 나쁘다.
 * 대신 언제 확인한 값인지가 눈에 띄게 한다.
 */
export const FACT_STALE_DAYS = 180;

export function isStale(fact: VendorFact<unknown>, today: Date): boolean {
  const checked = new Date(`${fact.checkedOn}T00:00:00Z`);

  if (Number.isNaN(checked.getTime())) return true;

  const days = (today.getTime() - checked.getTime()) / 86_400_000;

  return days > FACT_STALE_DAYS;
}

/** 오래된 값 옆에 붙는 말. 틀렸다고 말하지 않는다 — 오래되었다고만 말한다. */
export const STALE_FACT_NOTICE = '확인한 지 오래된 정보예요';
