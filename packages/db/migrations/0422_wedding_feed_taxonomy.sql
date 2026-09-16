-- 웨딩피드 탭과 카테고리 — 코드에서 표로.
--
-- 2026-09-16 대표 지시 — 「웨딩피드는 탭별 카테고리별로 다 설정 가능해야한다」.
--
-- **지금까지 카테고리는 자유 문자열이었다.** 0340의 `category_label`은 빈 값만
-- 막는 `text`다. 관리자 글 작성 칸도 자유 입력이라 「웨딩홀 」(뒤 공백)처럼 적으면
-- 그 글은 어느 묶음에도 안 걸리는데 **오류도 안 나고 목록에서는 멀쩡해 보인다**.
-- 알아챌 방법이 없는 것이 이 표를 만드는 이유다.
--
-- **탭은 코드에 있던 것을 옮겨 온 것이 아니다.** main(f59104ba)에는 그룹 상수가
-- 없고 피드 화면에도 탭이 없다 — 한 줄로 쭉 그린다. 여기 넣는 셋은 대표 지시의
-- 「탭별」을 처음 세우는 값이다. 카테고리 열셋은 옮겨 오는 것이 맞다 —
-- `WEDDING_FEED_TOPICS` 열여덟 항목의 `category_label`을 중복 제거한 그 값이고,
-- **글자 하나 바꾸지 않고** 넣는다. 그래야 이미 쌓인 글이 전부 그대로 붙는다.
--
-- **「전체」는 여기 없다.** 카테고리를 담지 않고 「거르지 않는다」는 뜻이라 껐다
-- 켜거나 순서를 바꾸는 대상이 아니다. 표에 넣으면 「모든 카테고리는 어느 탭에
-- 드는가」를 볼 때마다 그 한 줄만 빼고 세야 한다 — 규칙에 예외를 하나 두는 것보다
-- 화면 쪽 상수로 두는 편이 낫다. `WEDDING_FEED_ALL_TAB`(domain)에 있다.

-- 탭. 피드 화면 위쪽 가로줄 하나가 이 표의 한 줄이다.
CREATE TABLE structured.wedding_feed_groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 탭에 그대로 찍힌다. 같은 이름이 둘이면 사용자가 어느 쪽을 누른 것인지
  -- 화면만 보고 구별할 수 없다.
  name       text        NOT NULL UNIQUE CHECK (name <> ''),

  -- 작은 수가 왼쪽. 같은 수는 만든 순서로 이어진다.
  sort_order integer     NOT NULL DEFAULT 0,

  -- 끔으로 두면 앱에서 탭이 사라진다. **지우기와 다르다** — 그 탭에 딸린
  -- 카테고리와 글은 그대로 남고, 다시 켜면 돌아온다.
  active     boolean     NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wedding_feed_groups_order_idx
  ON structured.wedding_feed_groups (sort_order, created_at);

-- 카테고리. 글 한 편이 고르는 값이고, 어느 탭에 드는지를 여기서 정한다.
CREATE TABLE structured.wedding_feed_categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 카드 위 작은 줄에 그대로 들어간다. 0340의 `category_label`과 같은 문자열이고,
  -- 이름이 겹치면 고르는 화면에서 둘을 구별할 수 없다.
  name       text        NOT NULL UNIQUE CHECK (name <> ''),

  -- 어느 탭인가. **NULL을 허용한다** — 탭을 지우면 딸린 카테고리가 여기로 떨어진다.
  -- 이 상태를 막지 않고 **보이게 두는 것이** 요점이다. 금지하면 탭을 지우는 일
  -- 자체가 막히고, 조용히 어딘가로 옮겨 붙이면 운영자가 모르는 채로 분류가 바뀐다.
  -- 어느 탭에도 안 든 카테고리의 글은 「전체」에서만 보이므로 관리자가 알아야 한다
  -- (`findUngroupedCategories` · 관리자 화면 경고줄).
  group_id   uuid        REFERENCES structured.wedding_feed_groups(id) ON DELETE SET NULL,

  -- 탭 안에서의 차례. 작은 수가 앞.
  sort_order integer     NOT NULL DEFAULT 0,

  -- 끔이면 글 작성에서 고를 수 없고 앱에서도 거르는 값으로 안 나온다.
  -- 이미 그 값으로 쌓인 글은 그대로 있다.
  active     boolean     NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wedding_feed_categories_group_idx
  ON structured.wedding_feed_categories (group_id, sort_order, created_at);

-- 글이 어느 카테고리인가.
--
-- **이름으로 잇지 않고 id로 잇는다.** 이름으로 이으면 카테고리 이름을 고치는 순간
-- 그 이름으로 쌓인 글이 전부 떨어져 나간다 — 고치는 사람에게는 아무 일도 안 일어난
-- 것처럼 보인다. 이름 변경은 대표 지시에 들어 있는 기능이라 반드시 일어난다.
--
-- `category_label`은 남긴다. 화면·계약·자동 작성이 전부 그 문자열을 쓰고, 지우면
-- 이 작업의 범위를 한참 넘는 곳까지 고쳐야 한다. 이름을 고칠 때 두 곳을 함께
-- 맞춘다(`renameCategory`).
ALTER TABLE structured.wedding_feed_posts
  ADD COLUMN category_id uuid REFERENCES structured.wedding_feed_categories(id)
    ON DELETE RESTRICT;

CREATE INDEX wedding_feed_posts_category_idx
  ON structured.wedding_feed_posts (category_id)
  WHERE category_id IS NOT NULL;

-- ── 초기값 ────────────────────────────────────────────────────────────────
--
-- 탭 셋. 대표 지시에 적힌 이름 그대로다.
INSERT INTO structured.wedding_feed_groups (name, sort_order) VALUES
  ('준비·예산',   1),
  ('업체·서비스', 2),
  ('계약·여행',   3);

-- 카테고리 열셋. `WEDDING_FEED_TOPICS`의 `category_label`을 중복 제거한 값이고
-- 순서는 그 파일에 나온 차례를 따른다. 업종 이름은 정본이다 —
-- 본식스냅 · 헤어변형 · 결정사(CLAUDE.md 2026-09-11).
INSERT INTO structured.wedding_feed_categories (name, group_id, sort_order)
SELECT seed.name, g.id, seed.sort_order
FROM (VALUES
  ('예산',      '준비·예산',   1),
  ('체크리스트', '준비·예산',   2),
  ('준비 순서',  '준비·예산',   3),
  ('하객',      '준비·예산',   4),
  ('웨딩홀',    '업체·서비스', 1),
  ('스튜디오',   '업체·서비스', 2),
  ('드레스',    '업체·서비스', 3),
  ('메이크업',   '업체·서비스', 4),
  ('본식스냅',   '업체·서비스', 5),
  ('헤어변형',   '업체·서비스', 6),
  ('결정사',    '업체·서비스', 7),
  ('계약',      '계약·여행',   1),
  ('허니문',    '계약·여행',   2)
) AS seed(name, group_name, sort_order)
JOIN structured.wedding_feed_groups g ON g.name = seed.group_name;

-- 이미 쌓인 글을 붙인다. 이름이 정확히 같은 것만 붙고, 「웨딩홀 」처럼 어긋난 값은
-- **일부러 NULL로 남긴다** — 여기서 추측해서 붙이면 무엇이 잘못 적혀 있었는지가
-- 사라진다. 관리자 화면이 「카테고리가 목록에 없어요」로 보여주고 사람이 고른다.
UPDATE structured.wedding_feed_posts p
SET category_id = c.id
FROM structured.wedding_feed_categories c
WHERE p.category_label = c.name
  AND p.category_id IS NULL;
