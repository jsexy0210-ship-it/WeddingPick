-- 링크 미리보기(OG 카드) 문구를 관리자가 직접 고친다.
--
-- 2026-09-10 사용자 요청. 지금 카드의 제목·설명은 `spec/strings.ko.json`에 있고,
-- 한 글자를 바꾸려면 코드를 고쳐 배포해야 한다. 카드는 카카오톡에 주소를 붙일 때마다
-- 보이는 것이라 마케팅 문구처럼 자주 손대는데, 그때마다 개발자를 거치게 된다.
--
-- **한 줄짜리 표다.** 사이트는 하나뿐이라 여러 줄이 될 이유가 없다. `id`를 참으로
-- 고정해 두 줄째가 들어오지 못하게 막는다 — 두 줄이 생기면 「어느 것이 진짜인가」를
-- 화면과 빌드가 각자 판단하게 되고, 서로 다른 답을 내놓는다.
--
-- **빈 값과 «안 정했다»를 구분한다.** 열이 NULL이면 spec의 값을 쓴다는 뜻이고, 빈
-- 문자열이면 「비워 두기로 정했다」는 뜻이 된다. 후자는 카드에서 제목이 사라지는
-- 일이라 실수일 가능성이 높으므로 CHECK로 막는다.

CREATE TABLE structured.site_meta (
  -- 언제나 참. 두 줄째를 넣으려 하면 유일 제약에 걸린다.
  id              boolean     PRIMARY KEY DEFAULT true CHECK (id),

  -- og:title · og:description. NULL이면 spec/strings.ko.json의 값을 쓴다.
  og_title        text        CHECK (og_title IS NULL OR og_title <> ''),
  og_description  text        CHECK (og_description IS NULL OR og_description <> ''),

  -- og:image 주소. NULL이면 저장소에 든 기본 그림(weddingpick-og.png)을 쓴다.
  -- 절대 주소여야 한다 — 크롤러는 상대 경로를 따라오지 않는다.
  og_image_url    text        CHECK (og_image_url IS NULL OR og_image_url ~ '^https://'),

  -- 그림을 못 읽는 사람에게 읽히는 글. 그림에 적힌 글과 같아야 한다.
  og_image_alt    text        CHECK (og_image_alt IS NULL OR og_image_alt <> ''),

  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid        REFERENCES structured.users(id) ON DELETE SET NULL,

  -- **저장과 반영은 다른 일이다.** 웹은 정적 HTML이라 저장만으로는 바뀌지 않고
  -- 다시 빌드해야 한다. 마지막으로 빌드에 실려 나간 때를 적어 두어야 화면이
  -- 「저장했지만 아직 안 나갔다」를 말할 수 있다.
  published_at    timestamptz
);

COMMENT ON TABLE structured.site_meta IS
  '링크 미리보기(OG 카드) 문구. 한 줄만 존재한다. NULL인 열은 spec/strings.ko.json의 값을 쓴다.';
COMMENT ON COLUMN structured.site_meta.published_at IS
  '마지막으로 웹 빌드에 실려 나간 때. updated_at보다 이르면 저장했지만 아직 반영 전이다.';
