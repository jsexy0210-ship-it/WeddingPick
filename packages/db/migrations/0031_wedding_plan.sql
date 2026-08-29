-- 우리웨딩 — 웨딩 스케줄 · 지출내역 · 방문노트. 디자인 핸드오프 14~16번.
--
-- 셋 다 **웨딩에 매단다. 사람이 아니라.** 후보 저장(0026)과 같은 이유다 — 배우자와
-- 같은 목록을 보지 못하면 각자 다른 목록을 들고 같은 이야기를 하게 된다.

-- ---------------------------------------------------------------------------
-- 웨딩 스케줄
-- ---------------------------------------------------------------------------

CREATE TYPE task_state AS ENUM ('upcoming', 'in_progress', 'done');

CREATE TABLE structured.wedding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,

  label text NOT NULL CHECK (length(btrim(label)) > 0),
  /** 기본 열넷 중 하나면 그 키. 사용자가 더한 것이면 NULL. */
  preset_key text,

  due_date date,
  /** 어느 업체와 하는 일인지. 이름만 적어도 되고 업체를 고를 수도 있다. */
  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  vendor_label text,

  /*
   * 사용자가 직접 정한 상태.
   *
   * NULL이면 날짜로 자동 판정한다(도메인 resolveTaskState). 값이 있으면 그 값이
   * 이긴다 — 자동 판정은 날짜만 보고 짐작하는 것이라, 사람이 아니라고 말했으면
   * 그쪽이 맞다. 화면은 "직접 지정"이라고 적는다.
   */
  state_override task_state,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- 같은 기본 항목을 두 번 깔지 않는다.
  UNIQUE (wedding_id, preset_key)
);

COMMENT ON TABLE structured.wedding_tasks IS
  '웨딩 스케줄. 기본 열넷을 미리 깔아준다 — 처음 결혼을 준비하는 사람은 무엇을 해야 하는지부터 모른다.';
COMMENT ON COLUMN structured.wedding_tasks.state_override IS
  'NULL이면 날짜로 자동 판정. 값이 있으면 그 값이 이긴다 — 사람이 아니라고 말했으면 그쪽이 맞다.';

CREATE INDEX wedding_tasks_wedding_idx ON structured.wedding_tasks (wedding_id, due_date);

-- ---------------------------------------------------------------------------
-- 총 예산
-- ---------------------------------------------------------------------------
--
-- **기본값을 두지 않는다.** 결혼 예산은 사람마다 열 배씩 차이가 나서, 평균값을
-- 깔아두면 그건 안내가 아니라 유도다.

ALTER TABLE structured.weddings
  ADD COLUMN budget_amount bigint CHECK (budget_amount IS NULL OR budget_amount > 0);

COMMENT ON COLUMN structured.weddings.budget_amount IS
  '총 예산. NULL이면 아직 안 정한 것이다 — 평균값을 깔아두지 않는다.';

-- ---------------------------------------------------------------------------
-- 지출내역
-- ---------------------------------------------------------------------------
--
-- 결제인증(0022)은 이미 있다. 여기 두는 것은 **직접 입력한 항목**과 아직 내지 않은
-- 잔금이다. 둘을 합쳐 보여주는 것은 아래 뷰가 한다.

CREATE TYPE expense_status AS ENUM ('paid', 'scheduled');

CREATE TABLE structured.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,

  label text NOT NULL CHECK (length(btrim(label)) > 0),
  amount bigint NOT NULL CHECK (amount > 0),
  category vendor_category,

  status expense_status NOT NULL DEFAULT 'paid',
  /** 낸 날. 아직 안 낸 것(scheduled)이면 낼 예정일. */
  spent_on date,

  added_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_wedding_idx ON structured.expenses (wedding_id, spent_on DESC);

/*
 * 우리웨딩이 보는 지출 한 줄.
 *
 * 결제인증과 직접 입력을 한 목록에 모은다. **섞어도 되는 이유는 둘 다 내 돈이기
 * 때문이다** — 섞으면 안 되는 것은 근거가 다른 남들의 숫자였다(comparable_quotes
 * ·usable_payment_proofs·usable_price_reports). 대신 어디서 온 값인지를 줄마다 적는다.
 */
CREATE VIEW structured.wedding_expenses AS
SELECT
  e.id,
  e.wedding_id,
  e.label,
  e.amount,
  e.category,
  e.status,
  e.spent_on,
  'manual' AS source
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
  'payment_proof' AS source
FROM structured.payment_proofs p
JOIN structured.weddings w
  ON w.owner_user_id = p.reporter_user_id OR w.partner_user_id = p.reporter_user_id
LEFT JOIN structured.vendors v ON v.id = p.vendor_id;

COMMENT ON VIEW structured.wedding_expenses IS
  '우리웨딩의 지출. 결제인증과 직접 입력을 모으되 출처를 줄마다 적는다 — 둘 다 내 돈이라 섞어도 된다.';

-- ---------------------------------------------------------------------------
-- 방문노트
-- ---------------------------------------------------------------------------

CREATE TABLE structured.visit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,

  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  /** 업체를 못 찾아도 적을 수 있어야 한다. 방문은 계약보다 먼저다. */
  vendor_label text NOT NULL CHECK (length(btrim(vendor_label)) > 0),

  visited_on date NOT NULL,
  /** 그 자리에서 들은 금액. 계약가가 아니라 제안가다. */
  quoted_amount bigint CHECK (quoted_amount IS NULL OR quoted_amount > 0),
  memo text,

  added_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.visit_notes IS
  '방문노트. 제안금액은 계약가가 아니라 그 자리에서 들은 값이라 가격 통계에 쓰지 않는다.';
COMMENT ON COLUMN structured.visit_notes.quoted_amount IS
  '제안가. comparable_quotes·usable_payment_proofs 어디에도 들어가지 않는다 — 문서도 결제도 아니다.';

CREATE INDEX visit_notes_wedding_idx ON structured.visit_notes (wedding_id, visited_on DESC);
