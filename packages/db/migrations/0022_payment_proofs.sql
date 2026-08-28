-- 결제인증 제보.
--
-- 사업계획서 v3 6번이 계약서 원본 업로드를 P1에서 뺐다 — 비밀유지 조항의 위약벌
-- (계약금 2배)이 확인됐고, 그 위험을 지는 쪽이 이 앱을 쓴 사용자다. 대신 결제내역
-- (결제문자·카드영수증)을 받는다. 결제내역에는 계약 조건이 없어 그 조항이 걸리지 않는다.
--
-- **이것은 심사가 아니라 등록이다.** 인증 심사(verification_requests)와 다르다 —
-- 사람이 보지 않고, 등급을 올리지 않으며, 시장 대표가격(comparable_quotes)에도
-- 들어가지 않는다. 하는 일은 둘이다: 이 사람이 그 업체에 돈을 냈다는 표시, 그리고
-- 실제 결제 분포를 볼 자격(Level 3 Unlock).
--
-- 그래서 표를 따로 둔다. 계약 중앙값과 수기 제보에 이어 **세 번째 자리**다. 셋을
-- 한 표에 넣으면 언젠가 한 질의가 셋을 합치고, 그때 근거가 다른 숫자가 하나로 나간다.

CREATE TYPE payment_method AS ENUM ('card', 'transfer', 'cash', 'unknown');

COMMENT ON TYPE payment_method IS
  '결제 수단의 종류. 카드번호가 아니라 "카드"라는 것만 남긴다 (화면데이터구조 스펙 8.2).';

/*
 * 이미지에 있었던 식별정보의 종류.
 *
 * **이 목록이 enum인 것이 요점이다.** 값을 저장하지 못하게 타입으로 막는다 —
 * text[]였다면 언젠가 누군가 '5432-****-****-1234'를 넣고, 그건 여신전문금융업법이
 * 말하는 신용카드 정보가 된다. enum에는 카드번호를 넣을 수 없다.
 *
 * 이름을 여기 두는 것도 같은 이유다. 가족카드 명의자가 영수증에 찍히지만(스펙 8.4)
 * 우리는 "이름이 있었다"까지만 안다.
 */
CREATE TYPE masked_identifier_kind AS ENUM (
  'card_number',
  'approval_number',
  'person_name',
  'phone',
  'account_number'
);

CREATE TABLE structured.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,

  /*
   * 매칭된 업체. 못 찾으면 NULL이고, 그 제보는 통계에도 Unlock에도 쓰이지 않는다.
   * 지우지는 않는다 — 나중에 업체가 등록되면 이어붙일 수 있다.
   */
  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  -- 영수증에 찍힌 가맹점명. 업체명과 다를 수 있어 읽은 그대로 남긴다.
  merchant_name text NOT NULL CHECK (length(btrim(merchant_name)) > 0),

  paid_amount bigint NOT NULL CHECK (paid_amount > 0),
  paid_at timestamptz NOT NULL,
  method payment_method NOT NULL DEFAULT 'unknown',

  masked_identifiers masked_identifier_kind[] NOT NULL DEFAULT '{}',

  /*
   * 원본. 24시간 뒤에 사라지므로 대개 NULL이 된다.
   *
   * ON DELETE SET NULL이라 원본이 지워져도 구조화 데이터는 남는다 — 그게 이
   * 설계의 요점이다. 이미지는 정보를 읽어내는 데만 쓰고, 읽고 나면 버린다.
   */
  raw_document_id uuid REFERENCES originals.raw_documents (id) ON DELETE SET NULL,
  analyzed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- 같은 결제를 두 번 넣어 분포를 끌 수 없게. 가맹점·시각·금액이 같으면 같은 결제다.
  UNIQUE (reporter_user_id, merchant_name, paid_at, paid_amount)
);

COMMENT ON TABLE structured.payment_proofs IS
  '결제인증 제보. 심사가 아니라 등록이다 — 사람이 보지 않고, 등급을 올리지 않으며, 시장 대표가격에 들어가지 않는다.';
COMMENT ON COLUMN structured.payment_proofs.masked_identifiers IS
  '이미지에 있었던 식별정보의 종류. 값은 저장하지 않는다 — enum이라 저장할 수 없다.';

CREATE INDEX payment_proofs_vendor_idx ON structured.payment_proofs (vendor_id, paid_at DESC)
  WHERE vendor_id IS NOT NULL;
CREATE INDEX payment_proofs_reporter_idx ON structured.payment_proofs (reporter_user_id);

/*
 * 통계에 쓸 수 있는 결제인증.
 *
 * 관문을 하나로 둔다. comparable_quotes·usable_price_reports와 같은 자리이고,
 * **셋은 서로 UNION되지 않는다.**
 */
CREATE VIEW structured.usable_payment_proofs AS
SELECT p.id, p.vendor_id, p.reporter_user_id, p.paid_amount, p.paid_at, p.method
FROM structured.payment_proofs p
WHERE p.vendor_id IS NOT NULL;

COMMENT ON VIEW structured.usable_payment_proofs IS
  '업체가 매칭된 결제인증. 시장 대표가격(comparable_quotes)과 다른 숫자다 — 합치지 않는다.';

-- ---------------------------------------------------------------------------
-- 원본 보관 기간을 종류별로
-- ---------------------------------------------------------------------------
--
-- 0018이 "검증 완료 후 30일"을 정할 때 원본은 견적서·계약서 하나뿐이었다. 그 값은
-- **사람이 심사할 시간**이었다 — 심사자가 원본을 다시 볼 수 있어야 해서 길게 잡았다.
--
-- 결제내역은 다르다. 심사가 없고(등록이다), 카드번호가 찍혀 있다. 들고 있을 이유가
-- 없는 것을 오래 들고 있으면 그건 그냥 위험이다. 화면데이터구조 스펙 8.3이 정한
-- 24시간을 쓴다.
--
-- 두 값이 다른 것은 두 가지가 다른 것을 재기 때문이다. 하나로 합치면 둘 중 하나가
-- 틀린 값이 된다.

CREATE TYPE original_kind AS ENUM ('document', 'payment_proof');

ALTER TABLE originals.raw_documents
  ADD COLUMN kind original_kind NOT NULL DEFAULT 'document';

COMMENT ON COLUMN originals.raw_documents.kind IS
  '무엇을 찍은 것인가. 보관 기간이 이 값으로 갈린다.';

CREATE FUNCTION originals.retention_interval(kind original_kind) RETURNS interval
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$
    SELECT CASE kind
      -- 스펙 8.3. 분석이 끝나면 버린다. 실패 건은 재시도 큐가 이 시간 안에 끝난다.
      WHEN 'payment_proof' THEN interval '24 hours'
      -- 0018. 사람이 심사할 시간이다.
      ELSE (originals.retention_days() || ' days')::interval
    END
  $$;

COMMENT ON FUNCTION originals.retention_interval(original_kind) IS
  '원본 종류별 보관 기간. 결제내역 24시간(스펙 8.3), 그 밖은 검증 완료 후 30일(0018).';

-- ---------------------------------------------------------------------------
-- 파기 일정 다시 세우기
-- ---------------------------------------------------------------------------

/*
 * 뷰를 갈아엎는다.
 *
 * CREATE OR REPLACE는 컬럼을 끝에만 붙일 수 있어 kind를 중간에 넣지 못한다. 그리고
 * 어차피 파기 일정의 뜻이 달라졌다 — 한 값이 아니라 종류별 값이 됐다. 딸린 뷰까지
 * 한 번에 다시 세우고, 무엇이 딸려 있었는지 여기 남겨 다음 사람이 찾아 헤매지 않게 한다.
 */
DROP VIEW originals.retention_held_for_verification;
DROP VIEW originals.retention_attention;
DROP VIEW originals.unreachable_expired_documents;
DROP VIEW originals.documents_due_for_deletion;
DROP VIEW originals.expired_documents;
DROP VIEW originals.document_retention_schedule;
DROP VIEW originals.document_retention;

CREATE VIEW originals.document_retention AS
SELECT
  d.id,
  d.owner_user_id,
  d.uploaded_at,
  d.deleted_at,
  d.status,
  d.delete_attempts,
  d.personal_info_kinds,
  d.kind,

  /*
   * 결제내역은 심사에 붙지 않는다 — 심사가 없는 경로다. 그래서 이 값이 참이 될 수
   * 없고, 조건에 kind를 함께 적어 그 사실을 눈에 보이게 둔다. 나중에 결제내역을
   * 증빙으로 붙이는 길이 생기더라도 24시간이 조용히 무기한으로 늘어나지 않는다.
   */
  d.kind = 'document' AND EXISTS (
    SELECT 1
      FROM structured.verification_evidence e
      JOIN structured.verification_requests r ON r.id = e.request_id
     WHERE e.raw_document_id = d.id
       AND r.status IN ('received', 'in_review')
  ) AS awaiting_verification,

  CASE
    WHEN d.kind = 'document' AND EXISTS (
      SELECT 1
        FROM structured.verification_evidence e
        JOIN structured.verification_requests r ON r.id = e.request_id
       WHERE e.raw_document_id = d.id
         AND r.status IN ('received', 'in_review')
    ) THEN NULL
    WHEN d.kind = 'payment_proof' THEN
      -- 스펙 8.3은 "분석 완료 후"라고 적는다. 분석이 끝나지 않았으면 업로드가 바닥이다.
      greatest(
        d.uploaded_at,
        (SELECT max(p.analyzed_at) FROM structured.payment_proofs p WHERE p.raw_document_id = d.id)
      )
    ELSE greatest(
      d.uploaded_at,
      (SELECT max(q.confirmed_at) FROM structured.quotes q WHERE q.raw_document_id = d.id),
      (SELECT max(r.decided_at)
         FROM structured.verification_evidence e
         JOIN structured.verification_requests r ON r.id = e.request_id
        WHERE e.raw_document_id = d.id)
    )
  END AS verified_at
FROM originals.raw_documents d;

COMMENT ON VIEW originals.document_retention IS
  '원본의 파기 일정. 저장하지 않고 계산한다 — 확인과 심사가 끝날 때마다 달라지는 값이라, 저장해두면 낡는다.';

CREATE VIEW originals.document_retention_schedule AS
SELECT
  r.*,
  CASE
    WHEN r.verified_at IS NULL THEN NULL
    ELSE r.verified_at + originals.retention_interval(r.kind)
  END AS retention_until
FROM originals.document_retention r;

COMMENT ON VIEW originals.document_retention_schedule IS
  '계산된 파기 예정 시각. 종류별 보관 기간을 적용한다 — 결제내역 24시간, 그 밖은 30일.';

-- 아래는 0018과 같다. 딸린 뷰라 함께 지워졌을 뿐이다.

CREATE VIEW originals.expired_documents AS
SELECT
  s.id,
  s.owner_user_id,
  s.retention_until,
  s.delete_attempts,
  array_agg(p.storage_key ORDER BY p.page_index) AS storage_keys
FROM originals.document_retention_schedule s
JOIN originals.raw_document_pages p ON p.raw_document_id = s.id
WHERE s.deleted_at IS NULL
  AND s.retention_until IS NOT NULL
  AND s.retention_until <= now()
GROUP BY s.id, s.owner_user_id, s.retention_until, s.delete_attempts;

COMMENT ON VIEW originals.expired_documents IS
  '보관 기간이 지난 원본과 지워야 할 스토리지 키. 삭제 작업이 이 목록만 본다.';

CREATE VIEW originals.documents_due_for_deletion AS
SELECT
  s.id,
  s.owner_user_id,
  s.retention_until,
  s.status,
  s.delete_attempts,
  s.personal_info_kinds,
  s.kind
FROM originals.document_retention_schedule s
WHERE s.deleted_at IS NULL
  AND s.retention_until IS NOT NULL
  AND s.retention_until <= now();

COMMENT ON VIEW originals.documents_due_for_deletion IS
  '파기 예정 시각이 지난 원본. 사람이 지운다.';

CREATE VIEW originals.unreachable_expired_documents AS
SELECT
  s.id,
  s.owner_user_id,
  s.retention_until,
  s.status,
  (SELECT d.page_count FROM originals.raw_documents d WHERE d.id = s.id) AS page_count,
  s.personal_info_kinds
FROM originals.document_retention_schedule s
WHERE s.deleted_at IS NULL
  AND s.retention_until IS NOT NULL
  AND s.retention_until <= now()
  AND NOT EXISTS (
    SELECT 1 FROM originals.raw_document_pages p WHERE p.raw_document_id = s.id
  );

CREATE VIEW originals.retention_attention AS
SELECT
  s.id,
  s.owner_user_id,
  s.retention_until,
  s.delete_attempts,
  s.personal_info_kinds,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM originals.raw_document_pages p WHERE p.raw_document_id = s.id
    ) THEN 'unreachable'
    ELSE 'delete_failed'
  END AS reason
FROM originals.document_retention_schedule s
WHERE s.deleted_at IS NULL
  AND s.retention_until IS NOT NULL
  AND s.retention_until <= now()
  AND (
    s.status = 'delete_failed'
    OR NOT EXISTS (
      SELECT 1 FROM originals.raw_document_pages p WHERE p.raw_document_id = s.id
    )
  );

CREATE VIEW originals.retention_held_for_verification AS
SELECT
  s.id,
  s.owner_user_id,
  s.uploaded_at,
  s.personal_info_kinds
FROM originals.document_retention_schedule s
WHERE s.deleted_at IS NULL
  AND s.awaiting_verification;

COMMENT ON VIEW originals.retention_held_for_verification IS
  '심사가 열려 있어 파기 일정이 서지 않는 원본. 결제내역은 여기 들어오지 않는다 — 심사가 없는 경로다.';
