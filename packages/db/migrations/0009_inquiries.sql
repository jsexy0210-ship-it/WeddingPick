-- 문의 창구.
--
-- 지금까지 여러 화면이 "알려주세요", "확인해보세요"라고 말해왔다. 정작 받을 곳이
-- 없었다. 규칙만 있고 창구가 없으면 그 규칙은 지켜지지 않는다 —
-- 특히 플래너 노출 중단 요청이 그랬다.
--
-- 서비스정책서 6번(업체 반론권)이 요구하는 접수·재검토·이력 보관도 여기서 받는다.

CREATE TYPE inquiry_category AS ENUM (
  -- 서비스정책서 6번. 업체가 견적·계약가 등 특정 데이터에 이의를 제기한다.
  'vendor_objection',
  -- 검색에 나오는 것을 원하지 않는다.
  'planner_delisting',
  -- 업체·상품 정보가 틀렸다.
  'data_correction',
  -- 분석 결과가 원본 문서와 다르다.
  'analysis_error',
  -- 개인정보 관련 (삭제 요청 등).
  'privacy',
  'other'
);

CREATE TYPE inquiry_status AS ENUM ('received', 'in_review', 'answered', 'closed');

-- 무엇에 대한 문의인지. 없을 수도 있다(일반 문의).
CREATE TYPE inquiry_subject_kind AS ENUM ('planner', 'vendor', 'quote');

CREATE TABLE structured.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category inquiry_category NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  status inquiry_status NOT NULL DEFAULT 'received',

  -- 로그인한 사용자가 보냈으면 남는다. 계정을 지우면 문의도 따라 지워진다.
  requester_user_id uuid REFERENCES structured.users (id) ON DELETE CASCADE,
  /*
   * 답을 받을 곳. 로그인 사용자는 앱으로 받으므로 비워둘 수 있다.
   *
   * 필요 이상으로 받지 않는다 — 이름도 주소도 묻지 않고, 회신할 방법 하나만 받는다.
   */
  contact text,

  subject_kind inquiry_subject_kind,
  subject_id uuid,

  received_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  /** 어떻게 처리했는지. 보낸 사람이 읽는다. */
  resolution text,

  /*
   * 답을 보낼 방법이 없는 문의는 받지 않는다.
   *
   * 받아만 두고 답할 수 없으면 접수한 척한 것이다.
   */
  CONSTRAINT inquiry_has_reply_route
    CHECK (requester_user_id IS NOT NULL OR length(btrim(coalesce(contact, ''))) > 0),

  -- 무엇에 대한 것인지 가리킬 때는 종류와 대상이 함께 있어야 한다.
  CONSTRAINT subject_is_complete
    CHECK ((subject_kind IS NULL) = (subject_id IS NULL)),

  -- 노출 중단은 누구를 내릴지 없이는 처리할 수 없다.
  CONSTRAINT delisting_names_the_subject
    CHECK (category <> 'planner_delisting' OR subject_kind = 'planner'),

  -- 결론에는 사람과 시각이 남는다. 서비스정책서 6번의 "증빙 재검토"는 자동이 아니다.
  CONSTRAINT decision_has_reviewer
    CHECK ((status IN ('answered', 'closed')) = (decided_at IS NOT NULL AND decided_by IS NOT NULL)),

  CONSTRAINT answered_has_resolution
    CHECK (status <> 'answered' OR length(btrim(coalesce(resolution, ''))) > 0)
);

COMMENT ON TABLE structured.inquiries IS
  '문의·이의제기 접수. 서비스정책서 6번의 반론권 절차가 여기서 시작된다.';

CREATE INDEX inquiries_open_idx ON structured.inquiries (received_at)
  WHERE status IN ('received', 'in_review');

CREATE INDEX inquiries_requester_idx ON structured.inquiries (requester_user_id, received_at DESC)
  WHERE requester_user_id IS NOT NULL;

-- 같은 대상에 반복해서 들어오는 이의를 찾을 때 쓴다. 서비스정책서 6-5.
CREATE INDEX inquiries_subject_idx ON structured.inquiries (subject_kind, subject_id)
  WHERE subject_id IS NOT NULL;

/*
 * 처리 이력.
 *
 * 서비스정책서 6-5가 "반론 처리 이력은 내부 로그로 보관"이라고 한다. 상태만 덮어쓰면
 * 언제 누가 무엇을 했는지가 사라진다. 반복 이의제기 패턴을 보려면 이력이 있어야 한다.
 */
CREATE TABLE structured.inquiry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES structured.inquiries (id) ON DELETE CASCADE,
  from_status inquiry_status,
  to_status inquiry_status NOT NULL,
  actor_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inquiry_events_inquiry_idx
  ON structured.inquiry_events (inquiry_id, created_at);

-- 접수 자체도 이력의 첫 줄로 남긴다. 앱에서 넣는 쪽이 잊을 수 없게 트리거로 둔다.
CREATE FUNCTION structured.log_inquiry_received()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO structured.inquiry_events (inquiry_id, from_status, to_status, actor_user_id)
  VALUES (NEW.id, NULL, NEW.status, NEW.requester_user_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER inquiries_log_received
  AFTER INSERT ON structured.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION structured.log_inquiry_received();
