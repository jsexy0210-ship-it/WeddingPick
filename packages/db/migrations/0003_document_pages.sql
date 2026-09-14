-- allow-destructive: 문서 페이지를 별도 표로 옮기며 raw_documents의 옛 컬럼을 뗀다
-- 문서 한 건은 여러 장이다. 장마다 스토리지 키가 따로 있어야 워커가 전부 읽는다.
-- 0001에서 raw_documents에 키 하나만 두었던 것을 바로잡는다.

CREATE TABLE originals.raw_document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_document_id uuid NOT NULL REFERENCES originals.raw_documents (id) ON DELETE CASCADE,
  page_index integer NOT NULL CHECK (page_index >= 0),
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  UNIQUE (raw_document_id, page_index)
);

CREATE INDEX raw_document_pages_document_idx
  ON originals.raw_document_pages (raw_document_id, page_index);

-- 기존 문서의 첫 장을 옮긴다.
INSERT INTO originals.raw_document_pages (raw_document_id, page_index, storage_key, mime_type)
SELECT id, 0, storage_key, mime_type FROM originals.raw_documents;

DROP VIEW originals.expired_documents;

ALTER TABLE originals.raw_documents
  DROP COLUMN storage_key,
  DROP COLUMN mime_type;

-- 삭제 작업이 지울 키까지 함께 준다. 문서 단위로 한 행이다.
CREATE VIEW originals.expired_documents AS
SELECT
  d.id,
  d.owner_user_id,
  d.retention_until,
  d.delete_attempts,
  array_agg(p.storage_key ORDER BY p.page_index) AS storage_keys
FROM originals.raw_documents d
JOIN originals.raw_document_pages p ON p.raw_document_id = d.id
WHERE d.deleted_at IS NULL
  AND d.retention_until IS NOT NULL
  AND d.retention_until <= now()
GROUP BY d.id;

COMMENT ON VIEW originals.expired_documents IS
  '보관 기간이 지난 원본과 지워야 할 스토리지 키. 삭제 작업이 이 목록만 본다.';

-- 문서에서 어떤 종류의 개인정보가 발견됐는지. 값이 아니라 종류만 남긴다.
-- 마스킹 검토와 삭제 우선순위 판단에 쓴다. 서비스정책서 4번.
ALTER TABLE originals.raw_documents
  ADD COLUMN personal_info_kinds text[] NOT NULL DEFAULT '{}';
