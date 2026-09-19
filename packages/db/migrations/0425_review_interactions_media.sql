-- 후기 사진 · 도움돼요 · 댓글.
--
-- 07-lounge-my 정본에서 실제 계약이 없어서 비워 둔 상호작용을 추가한다.
-- 작성자 실명/커플명은 저장·공개 계약에 추가하지 않는다.

CREATE TABLE structured.review_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES structured.reviews (id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE CHECK (length(btrim(storage_key)) > 0),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  position smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 2),
  rights_confirmed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, position)
);

COMMENT ON TABLE structured.review_media IS
  '후기 작성자가 권리 확인 후 올린 사진. 공개 응답은 storage_key를 그대로 내보내지 않고 서명 URL로 바꾼다.';

CREATE TABLE structured.review_helpful (
  review_id uuid NOT NULL REFERENCES structured.reviews (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE TYPE review_comment_status AS ENUM ('published', 'hidden');

CREATE TABLE structured.review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES structured.reviews (id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
  status review_comment_status NOT NULL DEFAULT 'published',
  hidden_at timestamptz,
  hidden_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_comment_hidden_has_time
    CHECK ((status = 'hidden') = (hidden_at IS NOT NULL))
);

CREATE INDEX review_comments_public_idx
  ON structured.review_comments (review_id, created_at, id)
  WHERE status = 'published';

CREATE TABLE structured.review_comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES structured.review_comments (id) ON DELETE CASCADE,
  reporter_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  note text,
  received_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  resolution text,
  CONSTRAINT review_comment_report_decision_has_reviewer
    CHECK ((decided_at IS NULL) = (decided_by IS NULL))
);

CREATE INDEX review_comment_reports_open_idx
  ON structured.review_comment_reports (received_at)
  WHERE decided_at IS NULL;
