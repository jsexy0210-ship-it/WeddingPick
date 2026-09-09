-- allow-destructive: 파기 예정일을 저장하지 않고 뷰로 계산하도록 바꾸며 옛 컬럼을 뗀다
-- 보관 기간 기준을 "검증 완료 후"로 바꾼다.
--
-- 0017은 업로드일 + 30일로 두었다. 서비스정책서 4번의 원래 메모는
-- "검증 완료 후 최소 기간"이었고, 그 차이가 실제 문제를 만들었다 — 심사가
-- 늦어지면 증빙 파일이 심사 전에 파기 대상이 되어, 심사자가 확인할 근거를 잃는다.
--
-- 기준을 바꾸면 파기 시각의 성격이 달라진다. 업로드 때 한 번 찍고 끝나는 값이
-- 아니라, 확인과 심사가 끝날 때마다 달라지는 **계산값**이다. 그래서 컬럼에
-- 저장하지 않고 뷰가 계산한다. 저장해두면 어딘가에서 다시 계산하는 것을 잊고,
-- 화면에 적힌 날짜와 실제로 지워지는 날이 달라진다.

-- ---------------------------------------------------------------------------
-- 보관 일수
-- ---------------------------------------------------------------------------
--
-- SQL 쪽의 유일한 정본이다. 도메인의 RETENTION_POLICY.originalDays와 같아야 하고,
-- 테스트가 둘이 같은지 확인한다.

CREATE FUNCTION originals.retention_days() RETURNS integer
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT 30 $$;

COMMENT ON FUNCTION originals.retention_days() IS
  '원본 보관 일수. 검증이 끝난 날로부터 센다. 도메인의 RETENTION_POLICY.originalDays와 같아야 한다.';

-- ---------------------------------------------------------------------------
-- 언제 검증이 끝나는가
-- ---------------------------------------------------------------------------
--
-- 원본이 더 이상 필요하지 않게 된 시점이다. 셋 중 가장 나중이 기준이 된다.
--
--   업로드           아무 일도 일어나지 않은 문서의 바닥. 이게 없으면 분석되지
--                    않고 버려진 업로드가 영원히 남는다.
--   사용자 확인      A-07. 핵심 필드를 사람이 확인한 시점.
--   심사 결론        인증 신청이 승인·반려된 시점.
--
-- 그리고 **아직 결론이 나지 않은 인증 신청의 증빙이면 일정이 서지 않는다.**
-- 그게 이 변경의 이유다. 다만 그동안 원본이 무기한 남으므로, 그 상태를 눈에
-- 보이게 따로 표시한다(awaiting_verification) — 조용히 쌓이는 것이 가장 나쁘다.

CREATE VIEW originals.document_retention AS
SELECT
  d.id,
  d.owner_user_id,
  d.uploaded_at,
  d.deleted_at,
  d.status,
  d.delete_attempts,
  d.personal_info_kinds,

  EXISTS (
    SELECT 1
      FROM structured.verification_evidence e
      JOIN structured.verification_requests r ON r.id = e.request_id
     WHERE e.raw_document_id = d.id
       AND r.status IN ('received', 'in_review')
  ) AS awaiting_verification,

  CASE
    WHEN EXISTS (
      SELECT 1
        FROM structured.verification_evidence e
        JOIN structured.verification_requests r ON r.id = e.request_id
       WHERE e.raw_document_id = d.id
         AND r.status IN ('received', 'in_review')
    ) THEN NULL
    ELSE greatest(
      d.uploaded_at,
      -- 이 원본에서 나온 문서의 사용자 확인. greatest는 NULL을 무시한다.
      (SELECT max(q.confirmed_at) FROM structured.quotes q WHERE q.raw_document_id = d.id),
      -- 이 원본을 증빙으로 낸 인증 신청의 마지막 결론.
      (SELECT max(r.decided_at)
         FROM structured.verification_evidence e
         JOIN structured.verification_requests r ON r.id = e.request_id
        WHERE e.raw_document_id = d.id)
    )
  END AS verified_at
FROM originals.raw_documents d;

COMMENT ON VIEW originals.document_retention IS
  '원본의 파기 일정. 저장하지 않고 계산한다 — 확인과 심사가 끝날 때마다 달라지는 값이라, 저장해두면 낡는다.';

-- 계산된 파기 예정일. 위 뷰를 한 번 더 감싸 verified_at을 재사용한다.
CREATE VIEW originals.document_retention_schedule AS
SELECT
  r.*,
  CASE
    WHEN r.verified_at IS NULL THEN NULL
    ELSE r.verified_at + (originals.retention_days() || ' days')::interval
  END AS retention_until
FROM originals.document_retention r;

-- ---------------------------------------------------------------------------
-- 저장된 컬럼을 버린다
-- ---------------------------------------------------------------------------
--
-- 계산값과 저장값이 함께 있으면 둘 중 무엇이 참인지 두고 다투게 된다. 뷰들이
-- 먼저 새 계산을 보게 한 뒤 컬럼을 지운다.

CREATE OR REPLACE VIEW originals.expired_documents AS
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

CREATE OR REPLACE VIEW originals.documents_due_for_deletion AS
SELECT
  s.id,
  s.owner_user_id,
  s.retention_until,
  s.status,
  s.delete_attempts,
  s.personal_info_kinds
FROM originals.document_retention_schedule s
WHERE s.deleted_at IS NULL
  AND s.retention_until IS NOT NULL
  AND s.retention_until <= now();

COMMENT ON VIEW originals.documents_due_for_deletion IS
  '파기 예정일이 지난 원본. 검증이 끝난 날로부터 센다. 사람이 지운다.';

CREATE OR REPLACE VIEW originals.unreachable_expired_documents AS
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

CREATE OR REPLACE VIEW originals.retention_attention AS
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

/*
 * 심사가 열려 있어 파기 일정이 서지 않는 문서.
 *
 * 이 상태는 무기한이다 — 심사에 결론이 날 때까지 원본이 남는다. 그게 이 변경의
 * 대가이고, 조용히 두면 안 된다. 심사가 적체되면 개인정보가 그만큼 오래 남는다.
 */
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
  '심사가 열려 있어 파기 일정이 서지 않는 원본. 심사가 적체되면 개인정보가 그만큼 오래 남는다.';

ALTER TABLE originals.raw_documents DROP COLUMN retention_until;
