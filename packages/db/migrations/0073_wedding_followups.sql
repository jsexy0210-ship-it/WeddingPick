-- 우리웨딩 후속 3화면 — 결정한 업체(WP-OUR-003) · 지출 상세(WP-OUR-010) · 메모(WP-OUR-011).
--
-- 셋 다 기존 표를 additive하게만 늘린다. 이미 있는 웨딩 스케줄·지출·후보 결정
-- 표를 다시 만들지 않는다.

-- ---------------------------------------------------------------------------
-- 지출 상세 — 환불 상태 · 분할 결제. WP-OUR-010.
-- ---------------------------------------------------------------------------
--
-- 결제인증(payment_proofs)에서 온 줄에는 두지 않는다. 그 표는 아직 환불·취소를
-- 추적하지 않고, 여기에 억지로 열을 만들면 없는 값을 채워 넣게 된다. 직접 입력한
-- 지출(structured.expenses)에만 두고, 결제인증 줄은 화면에서 '정상' · 분할 결제
-- 없음으로 고정해 보여준다.

ALTER TABLE structured.expenses
  ADD COLUMN refund_status text NOT NULL DEFAULT 'normal'
    CHECK (refund_status IN ('normal', 'partial_refund', 'cancelled'));

COMMENT ON COLUMN structured.expenses.refund_status IS
  '정상/부분환불/전액취소. 결제인증에서 온 줄에는 없다 — 직접 입력한 지출에만 쓴다.';

CREATE TABLE structured.expense_split_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES structured.expenses (id) ON DELETE CASCADE,

  -- 화면에 보이는 순서. 같은 지출 안에서만 뜻이 있다.
  seq smallint NOT NULL CHECK (seq > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  amount bigint NOT NULL CHECK (amount > 0),
  paid_on date,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (expense_id, seq)
);

COMMENT ON TABLE structured.expense_split_payments IS
  '지출 한 줄을 여러 번에 나눠 낸 내역. 지출 상세(WP-OUR-010)의 분할 결제 3행에 쓴다.';

CREATE INDEX expense_split_payments_expense_idx
  ON structured.expense_split_payments (expense_id);

-- wedding_expenses 뷰(0031)에 refund_status를 더한다. 결제인증 줄은 늘 'normal'이다.
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
LEFT JOIN structured.vendors v ON v.id = p.vendor_id;

COMMENT ON VIEW structured.wedding_expenses IS
  '우리웨딩의 지출. 결제인증과 직접 입력을 모으되 출처를 줄마다 적는다 — 둘 다 내 돈이라 섞어도 된다.';

-- ---------------------------------------------------------------------------
-- 메모. WP-OUR-011.
-- ---------------------------------------------------------------------------
--
-- 업체에 매달 수도, 자유롭게 남길 수도 있다(vendor_id/vendor_label이 둘 다 NULL이면
-- 자유 메모). wedding_tasks·wedding_events의 vendor_id/vendor_label 패턴과 같다.
--
-- **작성자와 수정 여부를 항상 남긴다** — 규칙이다. author_user_id는 지우지 않고,
-- edited_by_user_id·updated_at으로 고쳤는지와 누가 고쳤는지를 안다.
--
-- version은 동시 수정 충돌(WP-CPL-005 conflict 화면)을 판정하는 값이다. 고칠 때
-- 클라이언트가 마지막으로 본 version을 함께 보내고, 서버 값과 다르면 배우자가
-- 먼저 고친 것이니 conflict 오류로 돌려준다.

CREATE TABLE structured.wedding_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,

  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  vendor_label text,

  body text NOT NULL CHECK (length(btrim(body)) > 0),

  author_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  edited_by_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.wedding_notes IS
  '우리웨딩 메모. 업체별로 남기거나(vendor_id/vendor_label) 자유롭게 남긴다(둘 다 NULL).';
COMMENT ON COLUMN structured.wedding_notes.version IS
  '동시 수정 충돌 판정용. 고칠 때 이 값이 다르면 배우자가 먼저 고친 것이다.';

CREATE INDEX wedding_notes_wedding_idx ON structured.wedding_notes (wedding_id, created_at DESC);
