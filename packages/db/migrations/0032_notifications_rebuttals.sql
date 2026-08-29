-- 알림함과 업체 반론. 디자인 핸드오프 20번.
--
-- 둘을 한 마이그레이션에 두는 이유는 반론 심사 결과가 곧 알림이기 때문이다.
-- 반론을 넣고 결과를 알려주지 않으면, 낸 사람은 우리가 읽었는지조차 알 수 없다.

-- ---------------------------------------------------------------------------
-- 알림함
-- ---------------------------------------------------------------------------
--
-- 푸시와 다른 것이다. 푸시는 지나가고, 이건 남는다. 푸시를 못 받는 기기에서도
-- 결과를 볼 수 있어야 하므로 **알림함이 원본이고 푸시는 사본이다.**

CREATE TYPE notification_kind AS ENUM (
  -- 자료 확인 결과
  'verification',
  -- 문의 답변
  'inquiry',
  -- 반론 심사 결과
  'rebuttal',
  -- 배우자 연결
  'partner',
  -- 그 밖의 안내
  'notice'
);

CREATE TABLE structured.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  kind notification_kind NOT NULL,

  title text NOT NULL CHECK (length(btrim(title)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) > 0),

  /*
   * 무엇에 대한 알림인가. **화면 경로를 넣지 않는다** — 경로를 DB에 적으면
   * 화면 이름을 바꿀 때 이미 보낸 알림이 전부 막다른 길이 된다. 종류와 대상만
   * 두고, 어디로 보낼지는 앱이 정한다.
   */
  target_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX notifications_user_idx
  ON structured.notifications (user_id, created_at DESC);

-- 홈의 빨간 점이 이 인덱스를 쓴다. 안 읽은 것만 세면 되므로 부분 인덱스로 둔다.
CREATE INDEX notifications_unread_idx
  ON structured.notifications (user_id)
  WHERE read_at IS NULL;

COMMENT ON TABLE structured.notifications IS
  '알림함. 푸시는 사본이고 이게 원본이다 — 푸시를 못 받는 기기에서도 결과를 볼 수 있어야 한다.';

-- ---------------------------------------------------------------------------
-- 업체 반론
-- ---------------------------------------------------------------------------
--
-- 후기에 대한 업체의 답변. 정보통신망법 제44조의2가 정한 임시조치(0020의
-- under_objection)와는 **다른 길이다.** 임시조치는 글을 가리고, 반론은 글 옆에
-- 말을 더한다. 가리는 것보다 더하는 쪽이 낫다 — 읽는 사람이 양쪽을 다 본다.

CREATE TYPE rebuttal_status AS ENUM ('pending', 'published', 'rejected');

CREATE TABLE structured.review_rebuttals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES structured.reviews (id) ON DELETE CASCADE,
  /*
   * 반론을 낸 사람. **업체가 아니라 사람이다** — 우리는 이 사람이 그 업체라는
   * 것을 아직 모른다. 아는 것은 본인이 그렇게 말했다는 사실뿐이고, 그것을
   * 확인하는 것이 심사다.
   */
  submitted_by_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  /*
   * 본인이 밝힌 소속·직위. "가온예식홀 예약팀장" 같은 말.
   *
   * 비워둘 수 없다. 누가 하는 말인지 모르는 반론은 후기 옆에 붙을 자격이 없다 —
   * 그건 반론이 아니라 또 하나의 익명 글이다.
   */
  claimed_role text NOT NULL CHECK (length(btrim(claimed_role)) > 0),

  -- 한 줄짜리 반박은 읽는 사람에게 아무것도 주지 않는다. 후기 본문과 같은 생각이다.
  body text NOT NULL CHECK (length(btrim(body)) >= 20),

  status rebuttal_status NOT NULL DEFAULT 'pending',
  /*
   * 결론에는 사람이 남는다. 인증 심사·신고·문의와 같은 규칙이다.
   *
   * **자동 게시는 없다.** 반론이 사람 없이 붙으면, 업체라고 말하기만 하면 누구나
   * 남의 후기 아래에 글을 실을 수 있게 된다.
   */
  decided_at timestamptz,
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  decision_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  /*
   * 둘로 나눠 건다. 하나로 묶으면 뚫린다 —
   * `(status = 'pending') = (decided_at IS NULL AND decided_by IS NULL)`은
   * **결정 시각만 적고 사람을 비운 행을 통과시킨다**(양변이 나란히 false가 된다).
   * 이름 없는 결정을 막는 것이 이 표의 요점이라, 각 제약이 한 가지만 지키게 둔다.
   */
  CONSTRAINT rebuttal_decision_is_dated
    CHECK ((status = 'pending') = (decided_at IS NULL)),
  CONSTRAINT rebuttal_decision_has_reviewer
    CHECK ((decided_at IS NULL) = (decided_by IS NULL)),

  /*
   * 후기 하나에 반론 하나.
   *
   * 여러 개를 허용하면 후기 페이지가 말싸움이 된다. 업체에게 필요한 것은 마지막
   * 말이 아니라 한 번의 답변이다.
   */
  UNIQUE (review_id)
);

CREATE INDEX review_rebuttals_open_idx ON structured.review_rebuttals (created_at)
  WHERE status = 'pending';

CREATE INDEX review_rebuttals_submitter_idx
  ON structured.review_rebuttals (submitted_by_user_id, created_at DESC);

/*
 * 화면에 붙는 반론. **관문은 여기 하나다.**
 *
 * 후기를 읽어가는 모든 경로가 이 뷰를 거친다. 조건을 화면마다 적으면 언젠가 한
 * 곳이 빠지고, 그 한 곳에서 심사받지 않은 반론이 후기 옆에 실린다.
 */
CREATE VIEW structured.published_rebuttals AS
SELECT
  b.id,
  b.review_id,
  b.claimed_role,
  b.body,
  b.decided_at AS published_at
FROM structured.review_rebuttals b
WHERE b.status = 'published';

COMMENT ON VIEW structured.published_rebuttals IS
  '후기 옆에 붙는 반론. 사람이 게시를 결정한 것만. 조건을 화면마다 적지 않기 위한 단일 관문이다.';
