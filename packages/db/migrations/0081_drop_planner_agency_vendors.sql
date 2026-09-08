-- 플래닝(planner_agency) 업종을 없앤다 — 2026-09-08 결정(플래너 기능 삭제와 같은 결).
--
-- Postgres는 enum 값을 지우지 못한다. 값은 남기되 화면·API·시드 어디에서도 쓰지
-- 않고(packages/domain vendor.ts), 그 업종의 업체 행은 여기서 지운다 — 남겨두면
-- 검색 결과에 «플래닝»으로 이름 붙일 수 없는 업체가 섞여 나온다. 후보·후기 등
-- 업체에 매달린 행은 FK CASCADE/SET NULL이 정한 대로 따라간다.

DELETE FROM structured.vendors WHERE category = 'planner_agency';

COMMENT ON TYPE vendor_category IS
  '업종. planner_agency는 2026-09-08 폐기 — 값만 남아 있고 쓰지 않는다(0081).';
