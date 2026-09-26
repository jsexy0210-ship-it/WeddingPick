-- 웨딩피드 자동 생성 그림의 기록 — 무엇을 어떻게 찍으라고 했고, 결과가 어떤 그림이었나.
--
-- 2026-09-26 대표 지시 — 「전체적으로 이미지도 대부분 다 비슷비슷하다. 다르게 생성되어야한다」.
--
-- **왜 표가 필요한가.** 그림을 다르게 만들려면 «최근에 무엇을 만들었는지»를 알아야 한다.
-- 관리자는 글 → 대표 썸네일 → 본문 이미지를 요청 셋으로 나눠 만들고(nginx 60초 한도),
-- 저장하지 않고 버린 그림도 다음 그림이 피해야 할 기준이다. 글 표(wedding_feed_posts)에는
-- 그 자리가 없다 — 저장된 글의 열쇠만 있고, 어떤 계획으로 만들었는지도 지문도 없다.
--
-- 글과는 `storage_key = wedding_feed_posts.image_key / body_image_key`로 이어진다.
-- 외래 키를 걸지 않는다: 그림은 글보다 먼저 생기고(글 저장 전 미리보기), 글이 지워져도
-- «이 카테고리에서 이런 그림을 이미 만들었다»는 기록은 계속 피할 기준으로 쓴다.
--
-- 사람이 올린 그림은 여기 없다 — 계획이 없고, 다르게 만들 대상도 아니다.

CREATE TABLE structured.wedding_feed_generated_images (
  -- 저장소 열쇠(`wedding-feed/{kind}/{uuid}.{ext}`). 서버가 만든 값만 들어온다.
  storage_key    text        PRIMARY KEY CHECK (storage_key ~ '^wedding-feed/(thumbnail|body)/'),

  -- 어느 카테고리의 그림인가. 카테고리 없이 만든 그림은 ''(전체에서만 비교)다.
  category_label text        NOT NULL DEFAULT '',

  kind           text        NOT NULL CHECK (kind IN ('thumbnail', 'body')),

  -- 촬영 계획 — 장소 · 구도 · 시간대 · 계절 · 색감 · 소품 · 인원의 키
  -- (`apps/api/src/analysis/wedding-feed-diversity.ts` `FEED_IMAGE_VARIETY`).
  plan           jsonb       NOT NULL,

  -- 같은 조합인지 가르는 열쇠. 같은 카테고리에서 같은 조합을 다시 고르지 않는다.
  plan_signature text        NOT NULL,

  -- 그림 지문(dHash 64비트 · 16진수 16자리). PNG가 아니거나 못 읽었으면 NULL —
  -- 지문 없이도 계획으로 다르게 만든다.
  dhash          text        CHECK (dhash IS NULL OR dhash ~ '^[0-9a-f]{16}$'),

  model          text,

  -- 최근 그림과 너무 닮아 다시 만든 횟수를 포함한 시도 수.
  attempts       integer     NOT NULL DEFAULT 1 CHECK (attempts >= 1),

  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 「이 카테고리의 최근 그림」을 부르는 질의.
CREATE INDEX wedding_feed_generated_images_recent_idx
  ON structured.wedding_feed_generated_images (category_label, created_at DESC);

-- 「전체의 최근 그림」(지문 비교).
CREATE INDEX wedding_feed_generated_images_created_idx
  ON structured.wedding_feed_generated_images (created_at DESC);
