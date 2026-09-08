-- 업종 10종 — 디자인 핸드오프 v3.18 §1.3 (2026-09-08).
--
--   결정사 → 웨딩홀 → 스튜디오 → 드레스 → 메이크업 → 본식스냅 → 예물 → 혼수 → 허니문 → 청첩장
--
-- 스드메(sdm) 한 칸을 스튜디오·드레스·메이크업 셋으로 나누고, 혼수·청첩장을 더한다.
-- vendor_category enum에는 studio · dress · makeup · dowry · invitation 다섯 값이
-- 없었다(packages/domain/src/vendor.ts VENDOR_CATEGORIES 참고).
--
-- Postgres는 enum 값을 지우지 못한다 — `sdm`은 값만 남기고(0081의 planner_agency와
-- 같은 처리) 화면·API·시드 어디에서도 쓰지 않는다.
--
-- ALTER TYPE ... ADD VALUE로 더한 값은 같은 트랜잭션 안에서 쓰지 못한다
-- (0015→0016 · 0074 참고). 마이그레이션 러너(packages/db/src/migrate.ts)가 파일마다
-- 트랜잭션을 여니 이 파일은 값만 더하고, 남은 sdm 업체를 옮기는 UPDATE는 0084에 둔다.

ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'studio';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'dress';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'makeup';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'dowry';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'invitation';
