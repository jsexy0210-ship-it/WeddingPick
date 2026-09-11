-- import_runs에 보류(held) 건수를 남길 자리를 만든다.
--
-- skipped_count가 «변경 없음 + 보류»를 합쳐 담아서 둘을 되돌릴 수 없었다.
-- 사유별 내역은 0101의 structured.vendor_import_holds에 행으로 남지만, 실행
-- 요약만 보고 「이번 실행에 사람이 봐야 하는 건이 있었나」를 알 수 없으면
-- 그 표를 열어 볼지조차 정할 수 없다. 수집 산출물 JSON은 7일 뒤 만료되므로
-- (public-data.yml) DB가 유일한 영구 기록이다.
--
-- skipped_count의 기존 의미(반영하지 않은 전체)는 그대로 두고 held_count를 더한다.
--
-- PR #135는 이 변경을 0092_public_data_switches_held_count.sql로 냈지만 그 번호는
-- main의 0092_reward_payouts.sql과 겹친다. 겹치면 하나는 적용 기록만 남고 DDL이
-- 조용히 빠진다(2026-09-10에 실제로 그래서 시험 셋이 깨졌다). 그래서 이번 배정인
-- 0210번대로 옮겼다. 같은 PR이 함께 넣으려던 sbiz-seoul · sbiz-gyeonggi 스위치
-- 행은 main의 0092a_sbiz_api_import_switches.sql에 이미 같은 내용으로 들어 있어
-- 여기서 다시 넣지 않는다.
ALTER TABLE structured.import_runs
  ADD COLUMN IF NOT EXISTS held_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN structured.import_runs.held_count IS
  '반영하지 않고 보류한 건수. skipped_count(변경 없음 + 보류)의 부분집합이다. 사유별 내역은 structured.vendor_import_holds를 본다.';
