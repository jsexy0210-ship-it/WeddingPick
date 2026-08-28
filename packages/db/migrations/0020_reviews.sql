-- 이용 후기.
--
-- 사업계획서 17·19번이 형태를 정해뒀다. 작성자를 계약자·신랑신부·하객으로 나누고,
-- 업종마다 평가 항목이 다르며, 스드메 세 업체를 한 평점으로 합치지 않는다.
--
-- 후기는 가격 다음으로 조작 압력이 센 자리다. 광고비로 노출은 살 수 있어도 평가는
-- 살 수 없다(서비스정책서 5번). 그래서 규칙을 코드 관례가 아니라 여기에 둔다.

CREATE TYPE reviewer_role AS ENUM ('contractor', 'couple', 'guest');

-- 후기가 어디까지 확인됐는지. 견적 문서의 L0~L4와 같은 생각이다.
CREATE TYPE review_verification AS ENUM ('unverified', 'receipt', 'contract');

CREATE TYPE review_status AS ENUM ('published', 'under_objection', 'removed');

CREATE TABLE structured.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  role reviewer_role NOT NULL,

  overall integer NOT NULL CHECK (overall BETWEEN 1 AND 5),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  -- 한 줄짜리는 다음 사람에게 아무것도 주지 않는다.
  body text NOT NULL CHECK (length(btrim(body)) >= 50),
  pros text,
  cons text,

  verification review_verification NOT NULL DEFAULT 'unverified',
  /*
   * 무엇으로 확인했는지. 계약 확인은 이미 인증 심사를 통과한 문서를 가리킨다 —
   * 같은 것을 두 번 확인하게 하면 사람들은 두 번째에서 그만둔다.
   */
  verified_quote_id uuid REFERENCES structured.quotes (id) ON DELETE SET NULL,
  verified_at timestamptz,
  verified_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,

  status review_status NOT NULL DEFAULT 'published',
  /*
   * 임시조치 만료 시각. 정보통신망법 제44조의2가 30일 이내로 정한다.
   *
   * 이 값을 우리가 늘릴 수 없게 상한을 건다. 길게 잡으면 업체가 이의만 제기해도
   * 불리한 후기를 오래 지울 수 있고, 그건 반론권이 아니라 검열이다.
   */
  objection_hold_until timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 확인됐다면 무엇으로·언제·누가 확인했는지가 남는다. 자동 인증은 없다.
  CONSTRAINT verification_has_evidence
    CHECK (
      (verification = 'unverified') = (verified_at IS NULL AND verified_by IS NULL)
    ),

  -- 이의 확인 중일 때만 임시조치 기간이 있다.
  CONSTRAINT hold_only_while_under_objection
    CHECK ((status = 'under_objection') = (objection_hold_until IS NOT NULL)),

  -- 한 사람이 한 업체에 후기 하나. 여러 개면 점수를 밀어 올릴 수 있다.
  UNIQUE (vendor_id, author_user_id)
);

COMMENT ON COLUMN structured.reviews.objection_hold_until IS
  '임시조치 만료 시각. 정보통신망법 제44조의2가 정한 30일 상한을 트리거가 지킨다.';

CREATE INDEX reviews_vendor_idx ON structured.reviews (vendor_id, created_at DESC);
CREATE INDEX reviews_objection_idx ON structured.reviews (objection_hold_until)
  WHERE status = 'under_objection';

/*
 * 30일 상한을 지킨다.
 *
 * CHECK로는 안 된다 — now()가 IMMUTABLE이 아니라 CHECK에 쓸 수 없다. 트리거로
 * 넣는 시점에 본다.
 */
CREATE FUNCTION structured.enforce_objection_hold_limit() RETURNS trigger AS $$
BEGIN
  IF NEW.objection_hold_until IS NOT NULL
     AND NEW.objection_hold_until > now() + interval '30 days' THEN
    RAISE EXCEPTION '임시조치는 30일을 넘길 수 없다 (정보통신망법 제44조의2)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_objection_hold_limit
  BEFORE INSERT OR UPDATE ON structured.reviews
  FOR EACH ROW EXECUTE FUNCTION structured.enforce_objection_hold_limit();

-- ---------------------------------------------------------------------------
-- 항목별 평가
-- ---------------------------------------------------------------------------
--
-- "별점 다섯 개"만 받으면 무엇이 좋았고 나빴는지가 사라진다. 웨딩홀에서 중요한
-- 것(음식·주차·혼잡)과 스튜디오에서 중요한 것(결과물·보정)은 겹치지 않는다.

CREATE TABLE structured.review_aspects (
  review_id uuid NOT NULL REFERENCES structured.reviews (id) ON DELETE CASCADE,
  -- 'food_taste' | 'parking' | 'result' | … 업종별 목록은 도메인이 든다.
  aspect text NOT NULL CHECK (length(btrim(aspect)) > 0),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  PRIMARY KEY (review_id, aspect)
);

-- ---------------------------------------------------------------------------
-- 신고
-- ---------------------------------------------------------------------------

CREATE TYPE report_reason AS ENUM (
  'false_content',
  'abusive',
  'spam',
  'personal_info',
  'other'
);

CREATE TABLE structured.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES structured.reviews (id) ON DELETE CASCADE,
  reporter_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  note text,
  received_at timestamptz NOT NULL DEFAULT now(),
  -- 결론에는 사람이 남는다. 인증 심사·문의와 같은 규칙이다.
  decided_at timestamptz,
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  resolution text,

  CONSTRAINT report_decision_has_reviewer
    CHECK ((decided_at IS NULL) = (decided_by IS NULL))
);

CREATE INDEX review_reports_open_idx ON structured.review_reports (received_at)
  WHERE decided_at IS NULL;

-- ---------------------------------------------------------------------------
-- 이용점수에 들어가는 후기
-- ---------------------------------------------------------------------------
--
-- 관문을 하나로 둔다. 가격의 comparable_quotes와 같은 자리다.
--
-- **미인증 후기는 보이되 점수를 움직이지 않는다.** 누구나 쓸 수 있는 글이 업체
-- 점수를 움직이면 그 점수는 사고팔 수 있는 것이 된다(서비스정책서 5번).

CREATE VIEW structured.scored_reviews AS
SELECT r.id, r.vendor_id, r.role, r.overall, r.verification, r.created_at
FROM structured.reviews r
WHERE r.status = 'published'
  AND r.verification <> 'unverified';

COMMENT ON VIEW structured.scored_reviews IS
  '이용점수에 들어가는 후기. 게시 중이고 확인된 것만. 서비스정책서 5번.';

-- 화면에 보이는 후기. 미인증도 보이지만 이의 확인 중인 글은 보이지 않는다.
CREATE VIEW structured.visible_reviews AS
SELECT r.*
FROM structured.reviews r
WHERE r.status = 'published';

-- ---------------------------------------------------------------------------
-- 후기에 적힌 사람 이름
-- ---------------------------------------------------------------------------
--
-- 0008이 플래너 공개를 잠갔다. 문서에서 읽은 이름은 근거 없이 검색에 오르지
-- 않는다. 그런데 후기는 사용자가 자유롭게 쓰는 글이라, "김○○ 플래너가
-- 친절했어요"라고 적으면 그 잠금을 **우회한다.**
--
-- 자유 글에서 이름을 기계로 걸러낼 수는 없다(성이 형태로 잡히지 않는다).
-- 대신 신고(personal_info)로 받고, 사람이 확인한다. 그 경로가 있다는 것을
-- 여기 적어두는 이유는, 이 우회로가 존재한다는 사실 자체를 잊지 않기 위해서다.

COMMENT ON TABLE structured.reviews IS
  '이용 후기. 자유 글이라 사람 이름이 들어갈 수 있고, 그러면 0008의 플래너 공개 잠금을 우회한다. 신고(personal_info)와 사람 확인이 그 경로다.';
