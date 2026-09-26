-- 웨딩피드 탭 · 카테고리 표를 앱 정본 칩과 같게 맞춘다.
--
-- 2026-09-26 대표 지적 — 「관리자 웨딩피드 카테고리와 앱웹 카테고리와 정보가 전혀 다르다」.
--
-- **왜 달랐나.** 0421부터 탭은 준비·예산 · 업체·서비스 · 계약·여행 셋이었고 관리자가
-- 고쳤다. 그 탭을 그리던 앱 화면은 2026-09-25 정본에 없는 화면이라 지워졌고(#535),
-- 남은 라운지 「웨딩정보」는 정본 칩(docs/design/React_Native/my.js `cats` — 전체 ·
-- 웨딩홀 · 스드메 · 본식 · 예물 · 신혼 · 예산)을 그렸다. 관리자가 무엇을 고쳐도 앱은
-- 그대로였다.
--
-- **이제 목록은 domain 상수 하나다**(`WEDDING_FEED_CHIPS` · `WEDDING_FEED_CATEGORIES`).
-- 서버 검사 · 관리자 화면 · 앱 칩이 전부 그것을 보고, 아무것도 이 표에서 탭을 읽지
-- 않는다. 표를 지우지 않는 것은 글이 `category_id`로 카테고리를 가리키고 있어서다.
-- 그래서 이 파일은 표를 **상수와 같은 모양으로 맞춰만 둔다** — 누가 표를 열어 봤을 때
-- 옛 탭 셋이 현행처럼 보이지 않게.
--
-- 이름을 바꾸는 것은 하나뿐이다 — **«준비 순서» → «일정»**. 같은 자리(«무엇부터
-- 정하나»)를 정본은 «일정»으로 적는다(my.js lg-3 · rl-2 · sv-3 세 번, «준비 순서» 0번).
-- 자동 작성 주제 키(schedule-order · stats-marriage-seoul)는 그대로라 「이미 쓴 주제」
-- 기록은 안 끊어진다.
--
-- 결정사는 다시 넣지 않는다(0433). 목록 밖 카테고리 — 결정사가 남아 있었다면 그것,
-- 2026-09-16~26 사이 관리자가 따로 만든 것 — 는 **지우지 않고 끈다**. 그 이름을 단
-- 글도 그대로 남는다. 관리자 글 목록이 «목록 밖»으로 표시하고 운영자가 다시 고른다.

-- 1) «준비 순서» → «일정». '일정'이 이미 있으면(운영자가 만들었으면) 이름은 두고 글만 옮긴다 —
--    두 줄이 같은 이름을 가질 수 없고(UNIQUE), 옮긴 글은 7)이 새 줄에 다시 잇는다.
UPDATE structured.wedding_feed_categories
SET name = '일정', updated_at = now()
WHERE name = '준비 순서'
  AND NOT EXISTS (
    SELECT 1 FROM structured.wedding_feed_categories WHERE name = '일정'
  );

UPDATE structured.wedding_feed_posts
SET category_label = '일정'
WHERE category_label = '준비 순서';

-- 2) 목록의 열둘이 표에 다 있게 한다(운영자가 지웠을 수 있다).
INSERT INTO structured.wedding_feed_categories (name)
SELECT seed.name
FROM (VALUES
  ('웨딩홀'), ('스튜디오'), ('드레스'), ('메이크업'), ('헤어변형'), ('본식스냅'),
  ('허니문'), ('예산'), ('체크리스트'), ('일정'), ('하객'), ('계약')
) AS seed(name)
ON CONFLICT (name) DO NOTHING;

-- 3) 탭 = 정본 칩 다섯(«전체»는 거르지 않는다는 뜻이라 표에 없다 — 0421과 같다).
INSERT INTO structured.wedding_feed_groups (name, sort_order, active) VALUES
  ('웨딩홀',      1, true),
  ('스드메',      2, true),
  ('본식',        3, true),
  ('예물 · 신혼', 4, true),
  ('예산',        5, true)
ON CONFLICT (name) DO UPDATE
  SET sort_order = EXCLUDED.sort_order, active = true, updated_at = now();

-- 4) 목록의 열둘 — 칩 배정 · 차례 · 켬. 칩이 없는 넷(체크리스트 · 일정 · 하객 · 계약)은
--    탭 없이 «전체»에서만 보인다. 정본 카드도 «일정» · «체크리스트» 배지를 달지만 그 칩은 없다.
UPDATE structured.wedding_feed_categories c
SET group_id = g.id, sort_order = m.sort_order, active = true, updated_at = now()
FROM (VALUES
  ('웨딩홀',     '웨딩홀',       1),
  ('스튜디오',   '스드메',       2),
  ('드레스',     '스드메',       3),
  ('메이크업',   '스드메',       4),
  ('헤어변형',   '스드메',       5),
  ('본식스냅',   '본식',         6),
  ('허니문',     '예물 · 신혼',  7),
  ('예산',       '예산',         8),
  ('체크리스트', NULL,           9),
  ('일정',       NULL,          10),
  ('하객',       NULL,          11),
  ('계약',       NULL,          12)
) AS m(name, chip, sort_order)
LEFT JOIN structured.wedding_feed_groups g ON g.name = m.chip
WHERE c.name = m.name;

-- 5) 목록 밖 카테고리는 끄고 탭에서 뗀다. 지우지 않는다 — 글이 가리키고 있을 수 있다.
UPDATE structured.wedding_feed_categories
SET group_id = NULL, active = false, updated_at = now()
WHERE name NOT IN (
  '웨딩홀', '스튜디오', '드레스', '메이크업', '헤어변형', '본식스냅',
  '허니문', '예산', '체크리스트', '일정', '하객', '계약'
);

-- 6) 칩이 아닌 탭(옛 셋과 관리자가 만든 것)을 지운다. 딸린 카테고리는 4) · 5)에서 이미
--    다른 곳을 가리키고, 남은 것이 있어도 `ON DELETE SET NULL`이라 카테고리는 남는다.
DELETE FROM structured.wedding_feed_groups
WHERE name NOT IN ('웨딩홀', '스드메', '본식', '예물 · 신혼', '예산');

-- 7) 글을 이름이 같은 카테고리에 다시 잇는다. 이름이 정확히 같은 것만 — 「웨딩홀 」처럼
--    어긋난 값은 0421과 같은 이유로 일부러 두고, 관리자 화면이 «목록 밖»으로 보여준다.
UPDATE structured.wedding_feed_posts p
SET category_id = c.id
FROM structured.wedding_feed_categories c
WHERE p.category_label = c.name
  AND p.category_id IS DISTINCT FROM c.id;
