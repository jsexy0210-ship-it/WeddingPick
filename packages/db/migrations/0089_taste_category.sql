-- allow-destructive: 취향 축이 바뀌어 옛 축으로 고른 값을 지운다 — v3.19 범용 스타일
-- 취향을 업종별로 — 디자인 핸드오프 v3.19 «취향을 다음 미완료 업종 기준으로 개편»(2026-09-08).
--
-- 온보딩 5/5는 준비 현황에서 완료하지 않은 첫 업종 하나의 취향만 받는다. 업종마다
-- 세트가 다르다(packages/domain/src/taste.ts TASTE_SETS). 그래서 «어느 업종의
-- 취향인지»를 함께 적는다. 허용 키는 도메인이 지킨다(0060과 같은 이유로 CHECK를
-- 두지 않는다).
--
-- 0060의 취향(white · daylight · flower · classic · minimal · film)은 스튜디오 한 세트
-- 였다. 새 스튜디오 세트와 라벨이 같은 다섯을 studio_* 키로 옮기고, 새 세트에 없는
-- flower(플라워 아치)는 버린다. 옮기고 나서 아무것도 안 남으면 행을 지운다 —
-- 행이 없는 것이 «아직 안 골랐다»다.

ALTER TABLE structured.taste_preferences
  ADD COLUMN taste_category vendor_category;

COMMENT ON COLUMN structured.taste_preferences.taste_category IS
  '어느 업종의 취향인지(도메인 TASTE_CATEGORIES 아홉 업종). tastes의 키는 이 업종 세트의 것이다.';

UPDATE structured.taste_preferences t
SET taste_category = 'studio',
    tastes = coalesce(
      (SELECT array_agg(m.new_key ORDER BY u.ord)
       FROM unnest(t.tastes) WITH ORDINALITY AS u(old_key, ord)
       JOIN (VALUES
         ('white', 'studio_white'),
         ('daylight', 'studio_daylight'),
         ('classic', 'studio_classic'),
         ('minimal', 'studio_minimal'),
         ('film', 'studio_film')
       ) AS m(old_key, new_key) ON m.old_key = u.old_key),
      '{}'
    ),
    updated_at = now()
WHERE t.taste_category IS NULL;

DELETE FROM structured.taste_preferences WHERE cardinality(tastes) = 0;

COMMENT ON TABLE structured.taste_preferences IS
  '사용자가 온보딩 5/5에서 고른 한 업종의 취향(2×3 격자). 행이 없으면 아직 안 고른 것이다.';
