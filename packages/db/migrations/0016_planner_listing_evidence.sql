-- 등록 요청의 근거.
--
-- 0015가 enum 값을 더했다. Postgres는 ALTER TYPE ... ADD VALUE로 더한 값을 같은
-- 트랜잭션 안에서 쓸 수 없어 파일을 나눈다.
--
-- 공개는 저절로 되지 않는다. "이 사람을 실어달라"는 말만으로는 부족하고, 왜 실어도
-- 되는지가 있어야 한다. 그것을 확인하는 것은 사람이다.

ALTER TABLE structured.inquiries
  /*
   * 무엇을 근거로 공개해도 되는지. 업체 공식 페이지 주소, 소속 증명 등.
   *
   * 값이 아니라 가리키는 곳을 받는다 — 우리가 신분증 사본 같은 것을 들고 있을
   * 이유가 없다. 확인은 사람이 그 주소를 열어보고 한다.
   */
  ADD COLUMN evidence_url text;

COMMENT ON COLUMN structured.inquiries.evidence_url IS
  '공개 근거가 있는 곳. 확인은 사람이 직접 열어보고 한다. 증빙 파일을 우리가 보관하지 않는다.';

/*
 * 등록 요청에는 누구를 실을지와 근거가 함께 있어야 한다.
 *
 * 노출 중단(delisting_names_the_subject)은 대상만 요구한다 — 내려달라는 요청에
 * 근거를 요구하면 내리기가 올리기보다 어려워진다. 그 비대칭은 의도한 것이다.
 */
ALTER TABLE structured.inquiries
  ADD CONSTRAINT listing_names_the_subject_and_basis
    CHECK (
      category <> 'planner_listing'
      OR (subject_kind = 'planner' AND length(btrim(coalesce(evidence_url, ''))) > 0)
    );
