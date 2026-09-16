/**
 * 「업체 공식인증 완료」를 판정하는 한 곳.
 *
 * 2026-09-15 대표 지시 — 「어차피 앱은 업체 공식인증 완료된것만 나오게할거고 공공데이터는
 * 웹사이트(업체 등록용)으로 분류할것이다. 여기서 말하는 업체 공식인증이란 — 업체 승인을
 * 통해 수급한 이미지와 기타 정보들」.
 *
 * ## 아직 무엇으로 자를지 고르지 않았다
 *
 * 그 한 줄을 코드로 옮길 수 있는 길이 셋이고, **어느 것인지는 대표님이 정하신다.**
 *
 *   가  `vendors.source = 'vendor_official'`
 *   나  승인된 `vendor_claims`가 있다
 *   다  승인된 claim + `copyright_basis = 'vendor_provided'` 이미지 1장 이상
 *
 * 그래서 이 파일은 **셋을 각각 계산해서 내놓기만 한다.** 「공식인증인가」 하나로 접는
 * 것은 부르는 쪽이 한다 — 여기서 골라 버리면 고른 사실이 이 파일 안에 묻히고, 다음
 * 사람은 그것이 결정이었는지 기본값이었는지 알 수 없다.
 *
 * ## 한 곳에 두는 이유
 *
 * 이미지 쪽이 그 본보기다(`vendor-image.ts`). 같은 판정을 질의마다 손으로 적어두면
 * 언젠가 한 벌만 고쳐지고, 그때 화면마다 다른 답이 나온다. 앱 필터를 켜는 날 고칠
 * 자리가 **한 곳**이어야 한다.
 *
 * **지금은 아무 화면도 이것으로 자르지 않는다**(2026-09-16 대표 지시 — 「일단 화면은
 * 냅두고 백 작업만 실행해」). 지금 DB의 업체는 전부 `public_data`라, 켜는 순간 홈 ·
 * 검색 · Pick 추천이 빈 화면이 된다. 켜는 것은 앱 개편 뒤다.
 */

/** `source_type` enum의 그 값(0001_init.sql). 문자열을 두 군데 적지 않는다. */
export const VENDOR_OFFICIAL_SOURCE = 'vendor_official';

/** 자를 수 있는 세 가지. 고르는 것은 이 파일이 아니라 부르는 쪽이다. */
export const OFFICIAL_VENDOR_RULES = ['source', 'approvedClaim', 'vendorProvidedImage'] as const;

export type OfficialVendorRule = (typeof OFFICIAL_VENDOR_RULES)[number];

export type OfficialVendorSignals = {
  /** 가 — 업체의 출처 표시가 `vendor_official`이다. */
  source: boolean;
  /** 나 — 이 업체에 승인된 관계자 인증이 하나라도 있다. */
  approvedClaim: boolean;
  /** 다 — 나에 더해, 업체가 직접 준 사진이 한 장이라도 있다. */
  vendorProvidedImage: boolean;
};

/**
 * 셋을 값으로 계산한다. 서버 밖(관리자 집계 · 테스트)에서 쓴다.
 *
 * **다는 나를 포함한다.** 「승인된 claim + 이미지」라서, 사진만 있고 승인이 없으면
 * 다가 아니다 — 그런 사진은 업체가 준 것이 아니라 그렇게 적힌 것뿐이다. 그래서
 * 세 값은 가 · 나 ⊇ 다 관계이고, 세어 놓으면 다가 나보다 클 수 없다.
 */
export function officialVendorSignals(input: {
  source: string;
  approvedClaimCount: number;
  vendorProvidedImageCount: number;
}): OfficialVendorSignals {
  const approvedClaim = input.approvedClaimCount > 0;

  return {
    source: input.source === VENDOR_OFFICIAL_SOURCE,
    approvedClaim,
    vendorProvidedImage: approvedClaim && input.vendorProvidedImageCount > 0,
  };
}

/**
 * 같은 판정을 SQL 조건으로 만든다. 질의마다 다시 적지 않는다.
 *
 * `alias`는 `structured.vendors`를 가리키는 별칭이고 `alias.id` · `alias.source`를 쓴다.
 *
 * 승인된 claim은 표가 아니라 **뷰**(`structured.approved_vendor_claims`, 0038)를 본다 —
 * 그 뷰에는 연락처 · 증빙 열이 아예 없어서, 이 조건을 붙인 질의가 실수로 증빙을 꺼낼
 * 수 없다(원문 27번).
 *
 * **사진에 대해 «화면에 내보내도 되는가»는 묻지 않는다.** 그것은
 * `displayableImageCondition`이 따로 답하는 질문이고, 여기서 묻는 것은 「업체 승인을
 * 통해 수급한 것인가」다. 둘을 섞으면 저작권 판정이 덜 끝난 업체가 공식인증에서
 * 빠졌다가 판정이 끝나면 조용히 들어온다.
 */
export function officialVendorCondition(alias: string, rule: OfficialVendorRule): string {
  const hasApprovedClaim = `EXISTS (
       SELECT 1 FROM structured.approved_vendor_claims c WHERE c.vendor_id = ${alias}.id
     )`;

  switch (rule) {
    case 'source':
      return `${alias}.source = '${VENDOR_OFFICIAL_SOURCE}'`;

    case 'approvedClaim':
      return hasApprovedClaim;

    case 'vendorProvidedImage':
      return `${hasApprovedClaim}
     AND EXISTS (
       SELECT 1 FROM structured.vendor_images i
        WHERE i.vendor_id = ${alias}.id AND i.copyright_basis = 'vendor_provided'
     )`;
  }
}
