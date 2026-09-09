-- 공공데이터 수집 파이프라인 결함 2건.
--
-- 1) sbiz-seoul · sbiz-gyeonggi 중단 스위치 행이 없다.
--    apps/api/src/public-data/sync.ts의 syncOne은 import_switches에 enabled=true
--    행이 없으면 SOURCE_DISABLED로 던진다. 0071이 icheon-halls · jecheon-halls ·
--    sbiz 셋만 넣어서, SBIZ_API_KEY가 등록되는 순간 두 OpenAPI 출처의 --apply가
--    업체 한 건도 빠짐없이 실패한다(수집은 되고 DB 반영만 전량 실패).
--    같은 데이터셋(data.go.kr 15012005)의 CSV 형식인 'sbiz'가 이미 켜져 있으므로
--    같은 이용허락 근거로 켠다. 끌 때는 코드 배포 없이 enabled=false로 바꾼다.
--
-- 2) import_runs에 보류(held) 건수를 남길 자리가 없다.
--    skipped_count가 «변경 없음 + 보류»를 합쳐 담아 둘을 되돌릴 수 없었다.
--    수집 산출물 JSON은 7일 뒤 만료되므로(public-data.yml) DB가 유일한 영구
--    기록이다. skipped_count의 기존 의미는 그대로 두고 held_count를 더한다.

INSERT INTO structured.import_switches (source_key, enabled, reason)
VALUES
  ('sbiz-seoul', true, '2026-09-04 확인한 data.go.kr 15012005와 같은 데이터셋의 OpenAPI 경로'),
  ('sbiz-gyeonggi', true, '2026-09-04 확인한 data.go.kr 15012005와 같은 데이터셋의 OpenAPI 경로')
ON CONFLICT (source_key) DO NOTHING;

ALTER TABLE structured.import_runs
  ADD COLUMN held_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN structured.import_runs.held_count IS
  '반영하지 않고 보류한 건수. skipped_count(변경 없음 + 보류)의 부분집합이다. 사유별 내역은 실행 산출물 JSON의 heldBy를 본다.';
