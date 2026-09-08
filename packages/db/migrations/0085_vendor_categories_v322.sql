-- 업종 12종 — 디자인 핸드오프 v3.22 §13.6 «준비 현황 · 그룹 분류 · 12개 업종»(2026-09-08).
--
--   시작 준비     결정사 · 웨딩홀
--   스드메        스튜디오 · 드레스 · 메이크업 · 헤어변형
--   본식 준비     본식스냅 · 부케 · 청첩장
--   예물 · 신혼   예물 · 혼수 · 허니문
--
-- 헤어변형(hair)과 부케(bouquet) 두 값을 더한다(packages/domain/src/vendor.ts
-- VENDOR_CATEGORIES 참고). 화면 순서는 도메인 배열이 정한다 — enum의 순서가 아니다.
--
-- ALTER TYPE ... ADD VALUE로 더한 값은 같은 트랜잭션 안에서 쓰지 못한다
-- (0015→0016 · 0074 · 0083→0084 참고). 마이그레이션 러너(packages/db/src/migrate.ts)가
-- 파일마다 트랜잭션을 여니 이 파일은 값만 더한다.

ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'hair';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'bouquet';
