-- 웨딩피드 소분류 열둘을 앱의 다섯 대분류에 모두 배정한다.
-- 2026-09-27 대표 지시. category_label, category_id, topic과 게시물은 바꾸지 않는다.

INSERT INTO structured.wedding_feed_groups (name, sort_order, active) VALUES
  ('준비',          1, true),
  ('웨딩홀 · 본식', 2, true),
  ('스드메',        3, true),
  ('예산·계약',     4, true),
  ('신혼여행',      5, true)
ON CONFLICT (name) DO UPDATE
  SET sort_order = EXCLUDED.sort_order, active = true, updated_at = now();

UPDATE structured.wedding_feed_categories c
SET group_id = g.id, sort_order = m.sort_order, active = true, updated_at = now()
FROM (VALUES
  ('체크리스트', '준비',          1),
  ('일정',       '준비',          2),
  ('웨딩홀',     '웨딩홀 · 본식', 3),
  ('본식스냅',   '웨딩홀 · 본식', 4),
  ('하객',       '웨딩홀 · 본식', 5),
  ('스튜디오',   '스드메',        6),
  ('드레스',     '스드메',        7),
  ('메이크업',   '스드메',        8),
  ('헤어변형',   '스드메',        9),
  ('예산',       '예산·계약',    10),
  ('계약',       '예산·계약',    11),
  ('허니문',     '신혼여행',     12)
) AS m(name, group_name, sort_order)
JOIN structured.wedding_feed_groups g ON g.name = m.group_name
WHERE c.name = m.name;

-- 0442의 옛 칩 그룹은 소분류를 새 그룹으로 옮긴 뒤 제거한다.
-- 별도 카테고리가 붙어 있어도 ON DELETE SET NULL로 글과 카테고리는 남는다.
DELETE FROM structured.wedding_feed_groups
WHERE name NOT IN ('준비', '웨딩홀 · 본식', '스드메', '예산·계약', '신혼여행');
