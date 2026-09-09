import { TERMS } from './terms';

/**
 * 업체 상세의 정보 순서. 통합정책 v3.10 §8.
 *
 * 앱·웹·IA가 **같은 목록을 본다.** 순서를 화면 코드에만 두면 앱을 고칠 때 웹이
 * 남고, 어느 쪽이 맞는지 물어볼 곳이 없어진다.
 *
 * 자리마다 `ready`를 달아둔 이유: 정책이 정한 열세 자리 중 몇은 아직 우리에게
 * 자료가 없다. 그 자리를 화면에 빈 칸으로 뚫어두면 회색 자리가 남고, 정책이 그걸
 * 금지했다. 그렇다고 목록에서 지우면 자료가 생기는 날 어디에 넣어야 하는지를
 * 다시 정해야 한다 — 그래서 **자리는 남기고 아직 없다고 적어둔다.**
 */
export const VENDOR_DETAIL_SECTIONS = [
  {
    key: 'hero_image',
    label: '대표 이미지',
    ready: false,
    /* 업체 제공·사용동의 이미지가 아직 없다. 카테고리 기본 이미지도 만들지 않았다. */
    note: '업체 제공 이미지가 아직 없어요',
  },
  { key: 'name', label: '업체명', ready: true },
  {
    key: 'key_conditions',
    label: '핵심 조건',
    ready: true,
    /* v3.13 §O-4가 이 자리에 들어갈 항목을 열거했다. 목록은 `vendor-fact.ts`에 있다. */
    note: '주차·식대·보증인원 같은 항목은 vendor-fact.ts가 목록을 갖는다',
  },
  {
    key: 'recommend_reason',
    label: TERMS.recommendReason,
    ready: false,
    /* 추천 이유는 지금 추천 목록에서만 만든다. 상세에서는 무엇과 견줘 고른 것인지가 없다. */
    note: '추천 목록에서만 만들 수 있어요',
  },
  {
    key: 'verified_data',
    label: TERMS.verifiedData,
    ready: true,
    /*
     * 이 한 자리가 화면에서는 두 덩어리다 — `실 제보`(결제내역에서 읽은 금액)와
     * `확인된 계약`(사람이 확인한 계약 금액). 둘 다 우리가 확인한 것이라 정책의
     * 이 자리에 함께 든다. 숫자는 합치지 않는다 — 다른 것을 세는 값이다.
     */
    note: '실 제보와 확인된 계약 두 덩어리다',
  },
  /* 핸드오프 WP-VEND-001 rule — Pick 버튼은 근거를 다 읽은 자리(제보 금액 다음)에 둔다. */
  { key: 'pick', label: `${TERMS.pick} · 비교`, ready: true },
  {
    key: 'vendor_notice',
    label: TERMS.vendorNotice,
    ready: false,
    /* 업체가 안내한 가격을 상세에 실을 자료가 아직 없다. 온보딩 예시에만 있다. */
    note: '업체가 안내한 가격을 아직 모으지 않았어요',
  },
  {
    key: 'benefits',
    label: TERMS.benefits,
    ready: false,
    /* 혜택·이벤트 표가 아직 없다. 없는 혜택을 말할 수 없다. */
    note: '혜택 자료를 아직 모으지 않았어요',
  },
  { key: 'experience', label: TERMS.experience, ready: true },
  { key: 'reviews', label: TERMS.review, ready: true },
  {
    key: 'rebuttals',
    label: '업체 반론',
    ready: true,
    /* 후기 화면 안에 후기와 붙어 있다. 떼어내면 무엇에 대한 반론인지 사라진다. */
    note: '후기 화면 안에 함께 있어요',
  },
  { key: 'official_source', label: '공식정보', ready: true },
  { key: 'report_error', label: '정보 오류 제보', ready: true },
] as const satisfies readonly {
  key: string;
  label: string;
  ready: boolean;
  note?: string;
}[];

export type VendorDetailSection = (typeof VENDOR_DETAIL_SECTIONS)[number]['key'];

/** 지금 화면에 실제로 그릴 수 있는 자리만, 정책 순서대로. */
export function readyVendorDetailSections(): VendorDetailSection[] {
  return VENDOR_DETAIL_SECTIONS.filter((section) => section.ready).map((section) => section.key);
}

/** 아직 자료가 없어 못 그리는 자리. 무엇이 비었는지 한눈에 보이게 한다. */
export function pendingVendorDetailSections(): VendorDetailSection[] {
  return VENDOR_DETAIL_SECTIONS.filter((section) => !section.ready).map((section) => section.key);
}
