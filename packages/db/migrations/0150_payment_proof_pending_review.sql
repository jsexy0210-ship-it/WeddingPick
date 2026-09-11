-- 사진 한 장으로 접수하고, 못 읽은 것은 보류로 남긴다. WP-RPT-002 · 007 · 008.
--
-- 디자인 핸드오프 v3.24가 제보를 «사진 찍기 또는 업로드»로 압축했다. 확인 화면
-- (WP-RPT-004)·업체 확인(WP-RPT-005)·분할 묶기(WP-RPT-006)·증빙 없는 가격 입력
-- (WP-RPT-010)이 전부 폐기됐고, 남은 사용자 행동은 사진 한 장뿐이다.
--
-- 그런데 0022의 표는 가맹점명·금액·시각을 NOT NULL로 받는다. 화면에서 입력칸을
-- 없애면 읽지 못한 사진은 **보낼 곳이 없다.** 그래서 화면보다 표가 먼저다.
--
-- **값을 지어내지 않는다.** 「못 읽었다」가 정상 상태다. 못 읽은 채로 접수는
-- 성립하고, 그 줄은 보류(pending_review)로 남아 어떤 통계에도 들어가지 않는다.
-- 사용자에게는 «확인 필요»로만 보이고, 재입력 경로는 다시 찍기/올리기뿐이다.

-- ---------------------------------------------------------------------------
-- 어느 칸을 못 읽었는가
-- ---------------------------------------------------------------------------
--
-- enum으로 둔다. text[]였다면 언젠가 오타 난 칸 이름이 들어가고, 그 줄은 아무도
-- 고치지 않는 보류로 영원히 남는다. 값은 domain의 PAYMENT_PROOF_FIELDS와 같다.

CREATE TYPE payment_proof_field AS ENUM (
  'merchantName',
  'paidAmount',
  'paidAt',
  'method'
);

COMMENT ON TYPE payment_proof_field IS
  '결제인증에서 읽어야 하는 칸. domain PAYMENT_PROOF_FIELDS와 같은 목록이다.';

-- ---------------------------------------------------------------------------
-- 접수 상태
-- ---------------------------------------------------------------------------
--
-- 둘뿐이다. 「접수 안 됨」이 없는 것이 요점이다 — 사진을 올렸으면 접수는 됐다.
-- 갈리는 것은 그 줄을 지금 쓸 수 있는가이고, 그것만 표시한다.

CREATE TYPE payment_proof_review_state AS ENUM ('accepted', 'pending_review');

COMMENT ON TYPE payment_proof_review_state IS
  '접수 상태. accepted는 읽기가 끝나 쓸 수 있는 줄, pending_review는 접수는 됐지만 검수를 기다리는 줄.';

ALTER TABLE structured.payment_proofs
  ADD COLUMN review_state payment_proof_review_state NOT NULL DEFAULT 'accepted',
  ADD COLUMN pending_fields payment_proof_field[] NOT NULL DEFAULT '{}',
  -- 왜 보류인지. 사용자에게 그대로 보여주는 문장이라 사람 말로 적는다.
  ADD COLUMN review_note text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid REFERENCES structured.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN structured.payment_proofs.review_state IS
  '접수 상태. 보류는 어떤 통계·Unlock·지출에도 들어가지 않는다.';
COMMENT ON COLUMN structured.payment_proofs.pending_fields IS
  '읽지 못했거나 확신이 낮아 검수를 기다리는 칸. 값을 지어내지 않고 못 읽었다고 적는다.';
COMMENT ON COLUMN structured.payment_proofs.review_note IS
  '보류 사유. 화면이 그대로 보여준다.';

/*
 * 못 읽은 값을 NULL로 담을 수 있게 연다.
 *
 * **NOT NULL을 푸는 대신 상태로 지킨다.** 아래 CHECK가 「쓸 수 있는 줄에는 셋이
 * 다 있다」를 보증하므로, 열어도 빈 값이 통계로 새지 않는다. 화면이 지어낸 값을
 * 채워 넣던 자리를 상태 하나로 바꾸는 것이 이 마이그레이션의 전부다.
 */
ALTER TABLE structured.payment_proofs
  ALTER COLUMN merchant_name DROP NOT NULL,
  ALTER COLUMN paid_amount DROP NOT NULL,
  ALTER COLUMN paid_at DROP NOT NULL;

ALTER TABLE structured.payment_proofs
  ADD CONSTRAINT payment_proofs_accepted_is_complete CHECK (
    review_state <> 'accepted'
    OR (merchant_name IS NOT NULL AND paid_amount IS NOT NULL AND paid_at IS NOT NULL)
  );

COMMENT ON CONSTRAINT payment_proofs_accepted_is_complete ON structured.payment_proofs IS
  '쓸 수 있다고 표시된 줄에는 가맹점명·금액·시각이 다 있다. 보류 줄만 비어 있을 수 있다.';

/*
 * 보류 줄에는 못 읽은 칸이 적혀 있어야 한다. 비어 있으면 「왜 보류인지 아무도
 * 모르는 보류」가 되고, 그런 줄은 검수 목록에서 건너뛰어진다.
 */
ALTER TABLE structured.payment_proofs
  ADD CONSTRAINT payment_proofs_pending_has_reason CHECK (
    review_state <> 'pending_review'
    OR cardinality(pending_fields) > 0
    OR review_note IS NOT NULL
  );

/*
 * 0022의 UNIQUE는 그대로 둔다. PostgreSQL이 NULL을 서로 다르게 보므로 보류 줄은
 * 서로 부딪히지 않고, 값이 다 찬 줄만 예전처럼 막힌다 — 같은 결제를 두 번 넣어
 * 분포를 끄는 것을 막는 것이 그 제약의 목적이고, 분포에 들어가는 줄은 accepted뿐이다.
 */

-- ---------------------------------------------------------------------------
-- 관문에 상태를 더한다
-- ---------------------------------------------------------------------------
--
-- 0022가 만든 한 관문에 조건 한 줄을 더한다. data_unlocks(0024) · vendor_paid_window
-- (0035) · 보상 · 대시보드가 전부 이 뷰를 지나므로, 보류를 여기서 막으면 아래쪽을
-- 하나씩 고칠 일이 없다.

CREATE OR REPLACE VIEW structured.usable_payment_proofs AS
SELECT p.id, p.vendor_id, p.reporter_user_id, p.paid_amount, p.paid_at, p.method
FROM structured.payment_proofs p
WHERE p.vendor_id IS NOT NULL
  AND p.review_state = 'accepted';

COMMENT ON VIEW structured.usable_payment_proofs IS
  '업체가 매칭되고 읽기가 끝난 결제인증. 시장 대표가격(comparable_quotes)과 다른 숫자다 — 합치지 않는다.';

-- ---------------------------------------------------------------------------
-- 지출에도 보류는 세우지 않는다
-- ---------------------------------------------------------------------------
--
-- wedding_expenses(0031 · 0073)는 usable_payment_proofs를 지나지 않고 표를 바로
-- 본다. 금액이 NULL인 줄이 그대로 올라가면 지출 합계가 조용히 어긋나고, 화면에는
-- 금액 없는 줄이 선다. 같은 조건을 여기에도 적는다.

CREATE OR REPLACE VIEW structured.wedding_expenses AS
SELECT
  e.id,
  e.wedding_id,
  e.label,
  e.amount,
  e.category,
  e.status,
  e.spent_on,
  'manual' AS source,
  e.refund_status
FROM structured.expenses e

UNION ALL

SELECT
  p.id,
  w.id AS wedding_id,
  -- 매칭된 업체 이름이 있으면 그것을, 없으면 영수증에 찍힌 가맹점 이름을 쓴다.
  coalesce(v.name, p.merchant_name) AS label,
  p.paid_amount AS amount,
  v.category,
  'paid'::expense_status AS status,
  p.paid_at::date AS spent_on,
  'payment_proof' AS source,
  'normal' AS refund_status
FROM structured.payment_proofs p
JOIN structured.weddings w
  ON w.owner_user_id = p.reporter_user_id OR w.partner_user_id = p.reporter_user_id
LEFT JOIN structured.vendors v ON v.id = p.vendor_id
WHERE p.review_state = 'accepted';

COMMENT ON VIEW structured.wedding_expenses IS
  '우리웨딩의 지출. 결제인증과 직접 입력을 모으되 출처를 줄마다 적는다 — 둘 다 내 돈이라 섞어도 된다. 검수를 기다리는 결제인증은 세지 않는다.';

-- 검수 목록은 오래 기다린 것부터 본다.
CREATE INDEX payment_proofs_pending_idx
  ON structured.payment_proofs (created_at)
  WHERE review_state = 'pending_review';
