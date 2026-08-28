-- 보관 점검.
--
-- 서비스정책서 4번은 자동삭제 실패에 "알림 및 수동 처리 프로세스"를 요구한다.
-- 지우는 쪽은 있었지만 실패한 것을 사람에게 보여주는 쪽이 없었다.
-- 개인정보가 보관 기간을 넘겨 남아 있는데 아무도 모르는 상태가 가능했다.

-- ---------------------------------------------------------------------------
-- 삭제 작업이 놓치는 문서
-- ---------------------------------------------------------------------------
--
-- expired_documents는 raw_document_pages와 INNER JOIN이다. 지울 키를 함께
-- 주려는 것인데, 그 때문에 페이지가 없는 문서는 목록에 아예 오르지 않는다.
-- 보관 기간이 지나도 영원히 남고, 삭제 작업은 실패조차 하지 않으므로
-- delete_attempts도 오르지 않는다. 조용히 남는 것이 가장 나쁘다.
--
-- 지금 업로드 경로는 문서와 페이지를 한 트랜잭션에서 넣으므로 정상적으로는
-- 생기지 않는다. 그러나 "지금은 안 생긴다"는 것은 안전장치가 아니다.
-- 생기면 보이게 해둔다.

CREATE VIEW originals.unreachable_expired_documents AS
SELECT
  d.id,
  d.owner_user_id,
  d.retention_until,
  d.status,
  d.page_count,
  d.personal_info_kinds
FROM originals.raw_documents d
WHERE d.deleted_at IS NULL
  AND d.retention_until IS NOT NULL
  AND d.retention_until <= now()
  AND NOT EXISTS (
    SELECT 1 FROM originals.raw_document_pages p WHERE p.raw_document_id = d.id
  );

COMMENT ON VIEW originals.unreachable_expired_documents IS
  '보관 기간이 지났는데 삭제 작업이 집어가지 못하는 문서. 페이지 기록이 없어 expired_documents에 오르지 않는다. 비어 있는 것이 정상이다.';

-- ---------------------------------------------------------------------------
-- 손이 필요한 문서 한 곳에 모으기
-- ---------------------------------------------------------------------------
--
-- 운영자가 봐야 하는 것은 두 가지다: 지우려다 실패한 것과, 아예 시도되지도
-- 않는 것. 서로 다른 이유로 남아 있지만 결과는 같다 — 개인정보가 기간을 넘겨
-- 남아 있다. 한 목록으로 본다.

-- 두 갈래는 겹칠 수 있다. 페이지가 없는 문서를 처리 목록에 올려두면 status는
-- delete_failed가 되지만 페이지는 여전히 없다. 그때 한 문서가 두 줄로 나오면
-- 건수가 부풀고, 운영자는 문서 수를 셀 수 없게 된다. 그래서 한 줄만 나오게 하고,
-- 이유는 더 구체적인 쪽을 남긴다 — 페이지가 없다는 사실이 무엇을 해야 하는지를
-- 결정하기 때문이다(지울 키를 우리가 모른다).
CREATE VIEW originals.retention_attention AS
SELECT
  d.id,
  d.owner_user_id,
  d.retention_until,
  d.delete_attempts,
  d.personal_info_kinds,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM originals.raw_document_pages p WHERE p.raw_document_id = d.id
    ) THEN 'unreachable'
    ELSE 'delete_failed'
  END AS reason
FROM originals.raw_documents d
WHERE d.deleted_at IS NULL
  AND d.retention_until IS NOT NULL
  AND d.retention_until <= now()
  AND (
    d.status = 'delete_failed'
    OR NOT EXISTS (
      SELECT 1 FROM originals.raw_document_pages p WHERE p.raw_document_id = d.id
    )
  );

COMMENT ON VIEW originals.retention_attention IS
  '사람 손이 필요한 원본. 지우려다 실패했거나, 삭제 작업이 집어가지 못하는 것. 서비스정책서 4번의 수동 처리 대상이다.';
