-- 수집이 「사람이 봐야 한다」고 판단한 것을 남긴다.
--
-- 왜 필요한가. `replacementDecision`이 'hold'를 돌려주면 sync는 그 업체를 조용히
-- 건너뛰고 끝났다(sync.ts). 건수는 import_runs.skipped_count에 «바뀐 것 없음»과
-- 뭉쳐 들어가므로, 나중에 「무엇이 왜 보류됐나」를 되살릴 방법이 없었다.
-- 보류는 대부분 사람이 판단해야 하는 것들이다 — 같은 이름의 업체가 둘이거나,
-- 관리자가 손댄 업체를 수집이 덮으려 했거나, 업종이 바뀌었거나.
--
-- 특히 **업종 변경은 여기에만 남는다.** 업종이 다르면 replacementDecision이
-- 곧바로 'hold'로 빠지므로 vendor_change_log에는 절대 들어오지 않는다.
CREATE TABLE structured.vendor_import_holds (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid        NOT NULL REFERENCES structured.import_runs (id) ON DELETE CASCADE,
  source_key    text        NOT NULL,
  -- 원천 식별키. 업체를 못 찾아 보류한 경우 vendor_id가 없으므로 이것만 남는다.
  record_key    text        NOT NULL,
  vendor_id     uuid        REFERENCES structured.vendors (id) ON DELETE CASCADE,
  reason        text        NOT NULL CHECK (reason IN (
                              'admin_locked',      -- 사람이 잠근 업체를 수집이 덮으려 했다
                              'multiple_matches',  -- 같은 이름·지역 후보가 둘 이상이다
                              'ambiguous_name',    -- 기존 업체·별칭과 이름이 겹친다
                              'insert_conflict',   -- 넣는 순간 다른 실행이 같은 이름을 넣었다
                              'field_conflict'     -- 값이 달라졌는데 더 최신이라는 근거가 없다
                            )),
  -- 무엇이 달라서 걸렸는지. field_conflict일 때만 채운다.
  field_name    text,
  old_value     text,
  new_value     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 「이번 실행에서 무엇이 보류됐나」가 이 표를 읽는 유일한 질문이다.
CREATE INDEX vendor_import_holds_run_idx ON structured.vendor_import_holds (import_run_id);
