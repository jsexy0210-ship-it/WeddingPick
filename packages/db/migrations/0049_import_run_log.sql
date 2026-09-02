-- 공개 데이터 임포트 실행 이력 및 장애 격리.
--
-- 규격 초안 14번: 업체/출처 단위 실패 격리, 원인 기록, 즉시 중단 스위치.
--
-- import_runs:
--   파일 하나를 읽는 것이 실행 하나다. 어떤 파일을 언제 돌렸는지,
--   몇 건을 등록·갱신·폐업 전환·건너뜀·실패했는지 남긴다.
--
-- import_errors:
--   개별 업체 처리 실패를 기록한다. 실패해도 전체가 중단되지 않고,
--   run이 끝난 뒤 오류 목록을 보고 원인을 파악한다.
--
-- import_switches:
--   출처별 즉시 중단 스위치. enabled = false인 출처의 임포트는
--   실행 전에 거부된다. 특정 출처에 문제가 생겼을 때 코드를 바꾸지 않고 끈다.

CREATE TYPE import_run_status AS ENUM (
  'running',
  'completed',  -- 오류가 있어도 끝까지 돌았으면 completed
  'failed',     -- 파일 파싱 자체가 실패하거나 DB 연결이 끊긴 경우
  'aborted'     -- kill switch로 중단된 경우
);

CREATE TABLE structured.import_runs (
  id             uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key     text               NOT NULL,  -- data_sources.ts DataSource.id (예: 'localdata')
  category       text               NOT NULL,  -- vendor_category (예: 'hall')
  file_name      text,                         -- 원본 파일명 (감사 추적용)
  status         import_run_status  NOT NULL DEFAULT 'running',
  total_rows     int,                          -- 파일에서 읽은 전체 행 수
  created_count  int                NOT NULL DEFAULT 0,
  updated_count  int                NOT NULL DEFAULT 0,
  closed_count   int                NOT NULL DEFAULT 0,  -- 폐업으로 전환된 기존 업체 수
  skipped_count  int                NOT NULL DEFAULT 0,  -- 영업 아님·정보 부족으로 건너뜀
  error_count    int                NOT NULL DEFAULT 0,
  started_at     timestamptz        NOT NULL DEFAULT now(),
  finished_at    timestamptz,

  CONSTRAINT import_run_finished_when_done
    CHECK (status = 'running' OR finished_at IS NOT NULL)
);

CREATE INDEX import_runs_source_idx ON structured.import_runs (source_key, started_at DESC);

CREATE TABLE structured.import_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid        NOT NULL REFERENCES structured.import_runs (id) ON DELETE CASCADE,
  vendor_name   text,
  region        text,
  -- 'parse_error' | 'db_error' | 'validation_error' | 'conflict_error' 등
  error_type    text        NOT NULL,
  error_message text        NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_errors_run_idx ON structured.import_errors (run_id, occurred_at);

-- 0048에서 placeholder로 뒀던 import_run_id에 FK를 연결한다.
ALTER TABLE structured.vendor_change_log
  ADD CONSTRAINT vendor_change_log_import_run_fk
    FOREIGN KEY (import_run_id) REFERENCES structured.import_runs (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 출처별 즉시 중단 스위치
-- ---------------------------------------------------------------------------
--
-- enabled = false인 source_key의 임포트는 실행 전에 거부된다.
-- 특정 출처 파일 형식이 바뀌거나 라이선스 확인이 필요할 때 코드 배포 없이 끈다.

CREATE TABLE structured.import_switches (
  source_key  text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT true,
  reason      text,       -- 왜 껐는지 또는 켰는지
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.import_runs IS
  '공개 데이터 임포트 실행 이력. 파일 하나가 실행 하나다.';

COMMENT ON TABLE structured.import_errors IS
  '임포트 실행 중 개별 업체 처리 실패. 전체를 중단시키지 않고 기록한다.';

COMMENT ON TABLE structured.import_switches IS
  '출처별 임포트 즉시 중단 스위치. enabled = false이면 해당 출처 임포트가 실행되지 않는다.';

-- data.go.kr(localdata) 출처는 기본으로 켜진 상태로 시작한다.
INSERT INTO structured.import_switches (source_key, enabled, reason)
VALUES ('localdata', true, '초기 설정 — data.go.kr 지방행정 인허가 데이터');
