-- 저장 허용 공공데이터의 필드 최신성 및 원천 추적. 기존 업체/감사 테이블 재사용.
ALTER TABLE structured.vendors
  ADD COLUMN source_url text,
  ADD COLUMN collection_status text NOT NULL DEFAULT 'needs_verification'
    CHECK (collection_status IN ('needs_verification', 'operating', 'closed_suspected', 'closed'));

CREATE TABLE structured.vendor_source_records (
  source_key text NOT NULL,
  record_key text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES structured.vendors(id),
  source_url text NOT NULL,
  published_on date,
  collected_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  PRIMARY KEY(source_key, record_key)
);
CREATE INDEX vendor_source_records_vendor_idx ON structured.vendor_source_records(vendor_id);

INSERT INTO structured.import_switches(source_key, enabled, reason)
VALUES ('icheon-halls', true, '2026-09-04 이용허락범위 제한 없음 확인'),
       ('jecheon-halls', true, '2026-09-04 이용허락범위 제한 없음 확인'),
       ('sbiz', true, '2026-09-04 이용허락범위 제한 없음 확인')
ON CONFLICT(source_key) DO NOTHING;
