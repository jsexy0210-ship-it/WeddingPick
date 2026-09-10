/**
 * 업체 사진을 화면에 내보내도 되는 조건.
 *
 * 검증 두 가지는 **서로 다른 것을 묻는다**(migrations/0050_vendor_images.sql).
 *
 *   copyright_basis    이 그림을 써도 되는가
 *   match_confidence   이 그림이 **정말 그 업체 것인가**
 *
 * 지금까지 화면 질의는 앞의 것만 봤다(`copyright_basis <> 'unknown'`). 그래서 운영에
 * 들어 있는 720장이 안 나가고 있었는데, 그것은 **우연이었다** — 저작권 값만 배치로
 * 바꾸면 그대로 나간다. 그 720장은 업체 이름 없이 「서울 웨딩홀」 같은 업종 검색 결과를
 * 업체마다 세 장씩 잘라 붙인 것이고, `match_confidence`가 전부 0으로 그 사실을 정확히
 * 적어두고 있다(2026-09-10 실측). 남의 사진을 그 업체 사진으로 보여주는 일은
 * 저작권보다 먼저 막아야 한다.
 *
 * 그래서 조건을 한 곳에 모으고 매칭도 함께 본다.
 */

/**
 * 이 값 미만이면 화면에 내보내지 않는다.
 *
 * 0을 막는 것이 목적이라 문턱은 0보다 크기만 하면 된다. 0.5로 잡은 이유는 「이름만
 * 같아서 찾은 것」과 「업체가 직접 준 것(1.0)」 사이에 선을 긋기 위해서다 — 이름만
 * 일치하는 검색 결과는 0050 주석이 「낮은 값을 받는다」고 정한 쪽이다.
 */
export const MIN_IMAGE_MATCH_CONFIDENCE = 0.5;

/** 화면에 내보낼 사진을 고르는 SQL 조건. 질의마다 다시 적지 않는다 — 한 곳만 고치면 된다. */
export function displayableImageCondition(alias: string): string {
  return `${alias}.status = 'approved'
     AND ${alias}.copyright_basis <> 'unknown'
     AND ${alias}.match_confidence >= ${MIN_IMAGE_MATCH_CONFIDENCE}`;
}

/** 같은 판정을 값으로 한다. 서버 밖(관리자 화면·테스트)에서 쓴다. */
export function isDisplayableImage(image: {
  status: string;
  copyrightBasis: string;
  matchConfidence: number | null;
}): boolean {
  return (
    image.status === 'approved' &&
    image.copyrightBasis !== 'unknown' &&
    (image.matchConfidence ?? 0) >= MIN_IMAGE_MATCH_CONFIDENCE
  );
}
