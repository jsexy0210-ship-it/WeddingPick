-- 웨딩피드 스크랩.
-- 사용자별로 공개 글을 저장한다. 글이 삭제되면 스크랩도 같이 사라지고,
-- 회원 탈퇴 시에도 user_id CASCADE로 남지 않는다.
CREATE TABLE structured.wedding_feed_scraps (
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES structured.wedding_feed_posts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX wedding_feed_scraps_user_recent_idx
  ON structured.wedding_feed_scraps (user_id, created_at DESC);
