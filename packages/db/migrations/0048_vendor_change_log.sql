-- 업체 데이터 변경 이력.
--
-- 규격 초안 11번: "기존값 → 신규수집 → 변경점 탐지 → 반영" 방식.
-- 어떤 필드가 언제 무엇에서 무엇으로 바뀌었는지, 어떤 원인으로 바뀌었는지 기록한다.
--
-- import_run_id는 0049에서 import_runs 테이블이 생기면 FK를 추가한다.
-- 지금은 uuid를 그대로 저장하고, 임포트 실행과 사후에 연결할 수 있다.

CREATE TYPE vendor_change_cause AS ENUM (
  -- 공개 데이터 임포트. import_run_id로 어느 실행인지 찾는다.
  'import',
  -- 관리자가 직접 수정. changed_by에 사람이 찍힌다.
  'admin',
  -- 업체 정정 신청 승인(0051 vendor_corrections). changed_by에 승인한 사람이 찍힌다.
  'correction',
  -- 업체 관계자 인증(0038 vendor_claims) 후 수정.
  'claim'
);

CREATE TABLE structured.vendor_change_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid        NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,
  field_name    text        NOT NULL CHECK (length(btrim(field_name)) > 0),
  old_value     text,       -- NULL이면 이전에 값이 없었다는 뜻
  new_value     text,       -- NULL이면 값이 지워졌다는 뜻
  cause         vendor_change_cause NOT NULL,
  changed_by    uuid        REFERENCES structured.users (id) ON DELETE SET NULL,
  import_run_id uuid,       -- 0049에서 import_runs FK 추가 예정
  changed_at    timestamptz NOT NULL DEFAULT now()
);

-- 업체별 최신 이력 조회. 변경이 많은 업체도 빠르게 읽는다.
CREATE INDEX vendor_change_log_vendor_idx
  ON structured.vendor_change_log (vendor_id, changed_at DESC);

COMMENT ON TABLE structured.vendor_change_log IS
  '업체 데이터의 변경 이력. 임포트·관리자 수정·정정 승인 때마다 바뀐 필드를 기록한다.';

COMMENT ON COLUMN structured.vendor_change_log.changed_by IS
  'admin·correction·claim 원인일 때 실제 변경한 사람. import는 NULL.';

COMMENT ON COLUMN structured.vendor_change_log.import_run_id IS
  '어느 임포트 실행에서 바뀌었는지. 0049 import_runs.id를 가리킨다.';
