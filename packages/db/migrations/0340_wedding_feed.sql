-- 웨딩피드 — 홈 아래쪽에 깔리는 읽을거리.
--
-- 2026-09-15 대표 지시 — 「관리자에 웨딩피드 콘텐츠 메뉴 만들어. 목록 등록 삭제 수정
-- 다 가능해야 하고 지속 콘텐츠 작성한다」.
--
-- **화면은 이미 있었고 담을 곳이 없었다.** `apps/mobile/src/features/home/content.ts`의
-- `listWeddingContent()`는 빈 목록을 돌려주고 홈은 목록이 비면 그 섹션을 통째로 접는다.
-- 컴포넌트(`WeddingContent`)는 시안대로 다 그려져 있다. 담을 표가 이것이다.
--
-- **초안이 기본이다.** 자동 작성이 붙어 있어서, 새로 써진 글이 사람 손을 거치지 않고
-- 바로 홈에 뜨면 안 된다. `status`가 `draft`로 들어오고 운영자가 `published`로 올린다.

CREATE TABLE structured.wedding_feed_posts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 카드 위 작은 줄. 업종 이름이거나 「예산」 · 「체크리스트」 같은 묶음이다.
  -- 업종 키로 못 묶는 글이 있어서 자유 문자열이고, 빈 값만 막는다.
  category_label text       NOT NULL CHECK (category_label <> ''),

  title         text        NOT NULL CHECK (title <> ''),

  -- 카드 아래 한 줄. 목록에만 쓰고 본문에는 안 쓴다.
  summary       text        NOT NULL DEFAULT '',

  -- 본문. 지금은 앱에 읽는 화면이 없어서 비어 있을 수 있다 —
  -- **없는 화면을 미리 열어두지 않는다**(CLAUDE.md). 글은 쌓아 두고 화면은 나중에 붙인다.
  body          text        NOT NULL DEFAULT '',

  -- 카드 그림. 이미지 관리(`admin/images`)가 올린 키를 가리킨다. 없으면 회색 판이다.
  image_key     text,

  -- draft(초안) · published(공개) · archived(내림). 값은 domain의 WEDDING_FEED_STATUSES와 같다.
  status        text        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),

  -- manual(사람이 씀) · generated(자동 작성). 어느 쪽이 쓴 글인지 섞이면
  -- 「자동이 이상한 글을 쓴다」를 확인할 길이 없어진다.
  source        text        NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'generated')),

  -- 자동 작성일 때 어느 모델이 썼는지. 모델을 바꾼 날 앞뒤를 가른다.
  model         text,

  -- 자동 작성이 고른 주제 키. 같은 주제를 또 쓰지 않게 하는 근거다.
  topic         text,

  -- 작은 수가 위로. 같은 수는 만든 순서로 이어진다.
  sort_order    integer     NOT NULL DEFAULT 0,

  published_at  timestamptz,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- 공개된 글에는 공개 시각이 있고, 공개 아닌 글에는 없다.
  -- 둘이 어긋나면 「언제부터 보였나」를 아무도 답할 수 없다.
  CONSTRAINT wedding_feed_published_at_matches_status
    CHECK ((status = 'published') = (published_at IS NOT NULL)),

  -- 자동 작성이면 모델과 주제가 남는다. 사람이 쓴 글에는 없다.
  CONSTRAINT wedding_feed_generated_has_model
    CHECK (source <> 'generated' OR model IS NOT NULL)
);

-- 홈이 부르는 질의: 공개된 것만, 정렬 순서대로.
CREATE INDEX wedding_feed_published_idx
  ON structured.wedding_feed_posts (sort_order, published_at DESC)
  WHERE status = 'published';

-- 자동 작성이 「이 주제는 이미 썼나」를 볼 때 쓴다. 내린 글도 세어야 해서 status를 안 건다.
CREATE INDEX wedding_feed_topic_idx
  ON structured.wedding_feed_posts (topic)
  WHERE topic IS NOT NULL;

-- 자동 작성이 돈 기록. **글이 안 나온 바퀴도 남긴다** —
-- 아무것도 안 나오는 것과 안 도는 것은 화면에서 구별되지 않는다.
CREATE TABLE structured.wedding_feed_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,

  -- 몇 편이 새로 들어갔나. 0도 정상이다(쌓일 만큼 쌓였으면 안 쓴다).
  created_count integer     NOT NULL DEFAULT 0,

  model         text,
  input_tokens  integer,
  output_tokens integer,

  -- 실패했으면 왜인지. 성공이면 NULL.
  error         text,

  -- 사람이 눌러서 돌렸나, 스스로 돌았나.
  trigger       text        NOT NULL DEFAULT 'schedule'
                CHECK (trigger IN ('schedule', 'manual'))
);

CREATE INDEX wedding_feed_runs_recent_idx
  ON structured.wedding_feed_runs (started_at DESC);
