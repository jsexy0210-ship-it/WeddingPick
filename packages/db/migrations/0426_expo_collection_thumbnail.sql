-- 박람회 지속 수집 실행 이력 + 대표 이미지 후보/권리 상태.
-- 이미지는 외부에서 무단 복제해 저장하지 않는다. 자동 수집은 후보 URL만 남기고,
-- 공개용 thumbnail_url은 운영자가 권리 상태를 확인한 뒤에만 채운다.

ALTER TABLE structured.expos
  ADD COLUMN IF NOT EXISTS thumbnail_url           text,
  ADD COLUMN IF NOT EXISTS thumbnail_candidate_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_source_url    text,
  ADD COLUMN IF NOT EXISTS thumbnail_rights        text
    CHECK (
      thumbnail_rights IS NULL OR thumbnail_rights IN (
        'ORGANIZER_PROVIDED',
        'LICENSED',
        'OFFICIAL_PUBLIC',
        'WEDDINGPICK_CREATED'
      )
    );

COMMENT ON COLUMN structured.expos.thumbnail_candidate_url IS
  '자동 수집이 공식 페이지에서 발견한 대표 이미지 후보. 공개에 직접 사용하지 않는다.';
COMMENT ON COLUMN structured.expos.thumbnail_url IS
  '권리 상태를 확인한 뒤 사용자 화면에 노출하는 대표 이미지 URL.';
COMMENT ON COLUMN structured.expos.thumbnail_rights IS
  '대표 이미지 사용 근거. 값이 없으면 thumbnail_url을 사용자 API에 내보내지 않는다.';

CREATE TABLE IF NOT EXISTS structured.expo_collection_runs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger               text        NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  status                text        NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  model                 text        NOT NULL,
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  discovered_count      integer     NOT NULL DEFAULT 0,
  created_count         integer     NOT NULL DEFAULT 0,
  updated_count         integer     NOT NULL DEFAULT 0,
  duplicate_count       integer     NOT NULL DEFAULT 0,
  review_required_count integer     NOT NULL DEFAULT 0,
  error_message         text
);

CREATE INDEX IF NOT EXISTS expo_collection_runs_started_at_idx
  ON structured.expo_collection_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS structured.expo_change_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL,
  change_type  text        NOT NULL CHECK (change_type IN (
    'DATE_CHANGED', 'VENUE_CHANGED', 'TIME_CHANGED', 'URL_CHANGED',
    'BENEFIT_CHANGED', 'CANCELLED', 'POSTPONED', 'EVENT_ENDED', 'EVENT_DELETED'
  )),
  before_value text,
  after_value  text,
  source_url   text,
  detected_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expo_change_log_event_idx
  ON structured.expo_change_log (event_id, detected_at DESC);
