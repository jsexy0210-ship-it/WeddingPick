-- 못 읽은 칸을 사람이 채운다. WP-RPT-004 「직접 입력」.
--
-- 2026-09-14 대표 지시 — 「실패하면 사람이 직접 등록한다」. 0150이 폐기했던
-- WP-RPT-004를 되살린다. 다만 폐기 당시의 형태가 아니라 `pending_review` 관문을
-- 거치는 형태다.
--
-- 0150이 무엇을 왜 폐기했는지부터 적는다. v3.24가 제보를 «사진 한 장»으로 압축하면서
-- 확인 화면(WP-RPT-004)·업체 확인(005)·분할 묶기(006)·증빙 없는 가격 입력(010)이
-- 함께 내려갔다. 그때의 판단은 **「화면이 빈칸을 채워 보내던 자리」를 없애는 것**이었다 —
-- 앱이 채운 값과 기계가 읽은 값이 한 줄에 섞여 들어오면, 그 줄을 나중에 갈라낼 방법이
-- 없기 때문이다. 0150은 그 자리를 상태 하나(`pending_review`)로 바꿨다.
--
-- 그 판단은 옳았고 지금도 옳다. 틀린 것은 **그 뒤에 남은 길이 「다시 찍기」뿐이었다**는
-- 점이다. 사진이 흐리거나 형식이 달라 두 번 찍어도 못 읽는 사람에게는 길이 없었다.
-- 접수는 됐는데 영원히 보류인 줄이 남고, 사용자는 자기 제보가 어디서 멈췄는지 모른다.
--
-- 되살린 것과 폐기된 것의 차이는 셋이다.
--
--   1. **증빙이 먼저다.** 사진을 낸 줄에만 열린다. 폐기된 WP-RPT-010은 사진 없이
--      금액만 받는 화면이었고, 그것은 되살리지 않는다 — 아래 CHECK가 막는다.
--   2. **못 읽은 칸만 채운다.** 기계가 읽어낸 칸은 사람이 덮어쓰지 않는다.
--      어느 칸이 비었는지는 0150의 `pending_fields`가 이미 들고 있다.
--   3. **채웠다고 반영되지 않는다.** 사람이 적은 값은 `pending_review`에 그대로
--      머무르고, 운영자가 확인해야 `accepted`가 된다. 기준금액은 실 제보의
--      중앙값이므로, 확인 안 된 값이 그 계산에 들어가면 「실 제보」가 거짓이 된다.
--
-- **그래서 「값을 지어내지 않는다」는 그대로다.** 사람이 적었다는 사실이 칸 단위로
-- 줄에 남으면 그것은 지어낸 값이 아니라 출처가 다른 값이다. 기계가 읽은 값과 섞이지
-- 않게 하는 것이 이 마이그레이션이 하는 일의 전부다.

-- ---------------------------------------------------------------------------
-- 누가 적었는가
-- ---------------------------------------------------------------------------
--
-- 두 경로를 연다(2026-09-14 지시 — 「사람」이 사용자인지 운영자인지 명시가 없었으므로
-- 둘 다). 한 값으로 합치지 않는 이유는 **믿는 근거가 다르기** 때문이다. 사용자는
-- 자기 영수증을 보고 적고, 운영자는 올라온 원본을 보고 적는다. 검수하는 사람이
-- 목록에서 둘을 구분하지 못하면 무엇을 다시 봐야 하는지 알 수 없다.

CREATE TYPE payment_proof_claim_source AS ENUM ('user', 'operator');

COMMENT ON TYPE payment_proof_claim_source IS
  '못 읽은 칸을 누가 적었는가. user는 제보한 본인, operator는 검수하는 운영자다.';

ALTER TABLE structured.payment_proofs
  /*
   * 사람이 적은 칸. **값이 아니라 어느 칸인지만 적는다** — 값은 원래 자리
   * (merchant_name·paid_amount·paid_at)에 그대로 들어가고, 이 배열이 그 칸을
   * 가리킨다. 값을 두 벌 들면 언젠가 한 벌이 낡고, 낡은 쪽을 누군가 읽는다.
   *
   * 0150의 `payment_proof_field` enum을 그대로 쓴다. 같은 것을 두 목록으로
   * 부르지 않는다.
   */
  ADD COLUMN claimed_fields payment_proof_field[] NOT NULL DEFAULT '{}',
  ADD COLUMN claimed_source payment_proof_claim_source,
  ADD COLUMN claimed_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  ADD COLUMN claimed_at timestamptz;

COMMENT ON COLUMN structured.payment_proofs.claimed_fields IS
  '사람이 직접 적은 칸. 나머지 칸은 기계가 읽은 값이다 — 둘을 섞지 않으려고 칸 단위로 남긴다.';
COMMENT ON COLUMN structured.payment_proofs.claimed_source IS
  '적은 사람의 자리. 값이 있는데 이 칸이 비면 출처를 잃은 값이 된다.';
COMMENT ON COLUMN structured.payment_proofs.claimed_by IS
  '적은 사람. 탈퇴하면 NULL이 되지만 claimed_source는 남아 어느 자리였는지는 잃지 않는다.';

/*
 * 적은 칸이 있으면 누가 언제 적었는지가 반드시 있다.
 *
 * `claimed_by`는 빼둔다 — 탈퇴로 NULL이 될 수 있고(ON DELETE SET NULL), 그때
 * 이 줄의 다른 값을 고치려다 제약에 걸리면 탈퇴가 남긴 줄이 통째로 얼어붙는다.
 * 출처를 잃지 않게 하는 것은 `claimed_source`이고 그쪽은 지워지지 않는다.
 */
ALTER TABLE structured.payment_proofs
  ADD CONSTRAINT payment_proofs_claim_has_source CHECK (
    cardinality(claimed_fields) = 0
    OR (claimed_source IS NOT NULL AND claimed_at IS NOT NULL)
  );

COMMENT ON CONSTRAINT payment_proofs_claim_has_source ON structured.payment_proofs IS
  '사람이 적은 칸이 있으면 누가 언제 적었는지가 함께 남는다.';

/*
 * **증빙이 먼저다.** 사람이 적은 줄에는 올린 원본이 달려 있어야 한다.
 *
 * 이것이 폐기된 WP-RPT-010(증빙 없는 가격 입력)과 이번 경로를 가르는 자리다.
 * 주석으로 적어두면 언젠가 사진 없이 금액만 받는 화면이 다시 생기고, 그 값은
 * 생긴 모양이 같아서 여기까지 흘러들어온다. 타입으로 막는다.
 *
 * `raw_document_id`는 원본 **행**을 가리킨다. 24시간 파기(0022)는 스토리지 키와
 * 페이지만 지우고 행은 `deleted_at`으로 남기므로, 파기가 돌아도 이 제약은 계속
 * 만족된다. 행까지 지우는 길(ON DELETE SET NULL)은 지금 어느 코드에도 없다.
 */
ALTER TABLE structured.payment_proofs
  ADD CONSTRAINT payment_proofs_claim_needs_original CHECK (
    cardinality(claimed_fields) = 0
    OR raw_document_id IS NOT NULL
  );

COMMENT ON CONSTRAINT payment_proofs_claim_needs_original ON structured.payment_proofs IS
  '사람이 적은 값은 올린 원본이 있는 줄에만 붙는다. 증빙 없이 금액만 받는 길(폐기된 WP-RPT-010)을 막는다.';

/*
 * **채웠다고 반영되지 않는다.** 사람이 적은 값이 든 줄은 검수를 거쳐야 쓸 수 있다.
 *
 * 0150이 `usable_payment_proofs`에 `review_state = 'accepted'`를 걸어뒀으므로
 * 관문은 이미 하나다. 여기서 더하는 것은 **그 관문의 뜻**이다 — accepted가
 * 「읽기가 끝났다」에서 「누군가 적었다」로 조용히 넓어지지 않게, 사람이 적은 줄은
 * 검수자가 있어야만 accepted가 될 수 있게 못박는다.
 *
 * 운영자가 직접 채우는 경우(claimed_source='operator')는 그 사람이 곧 검수자라
 * 같은 UPDATE에서 `reviewed_by`가 함께 찬다. 한 번 더 볼 사람을 요구하지 않는다 —
 * 원본을 보고 적은 사람과 그 값을 보고 판단할 사람이 같아도, 그 판단은 있었다.
 */
ALTER TABLE structured.payment_proofs
  ADD CONSTRAINT payment_proofs_claim_needs_review CHECK (
    cardinality(claimed_fields) = 0
    OR review_state <> 'accepted'
    OR reviewed_by IS NOT NULL
  );

COMMENT ON CONSTRAINT payment_proofs_claim_needs_review ON structured.payment_proofs IS
  '사람이 적은 값은 검수자가 있어야 쓸 수 있다. 적는 것과 반영되는 것은 다른 일이다.';

-- ---------------------------------------------------------------------------
-- 관문은 그대로 둔다
-- ---------------------------------------------------------------------------
--
-- `usable_payment_proofs`(0022 · 0150)를 고치지 않는다. 조건은 이미
-- `vendor_id IS NOT NULL AND review_state = 'accepted'`이고, 위 CHECK가 사람이
-- 적은 줄은 검수 없이 accepted가 되지 못하게 막으므로 **그 뷰가 보는 것이 그대로
-- 맞다.** 뷰에 조건을 하나 더 다는 것은 같은 규칙을 두 곳에 적는 일이고, 그러면
-- 언젠가 한 곳만 고쳐진다.
--
-- `wedding_expenses`(0150)도 같은 이유로 그대로다.

-- 검수 목록이 사람이 적은 줄을 먼저 알아보게. 0150의 pending 인덱스 옆자리다.
CREATE INDEX payment_proofs_claimed_idx
  ON structured.payment_proofs (created_at)
  WHERE cardinality(claimed_fields) > 0 AND review_state = 'pending_review';
