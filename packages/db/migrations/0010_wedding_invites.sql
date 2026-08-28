-- 배우자 초대 (A-18).
--
-- 사업계획서 2번이 꼽은 문제 중 하나가 "부부 공동 의사결정"이다 — 견적·후보·일정·의견이
-- 메신저와 캡처 이미지에 흩어져 함께 결정하기 어렵다.
--
-- 연결은 **양쪽이 각각 동의해야** 이뤄진다. 한쪽이 초대하고(1), 다른 쪽이 무엇이
-- 공유되는지 보고 받아들여야(2) 연결된다. 링크를 아는 것만으로 남의 계약 정보가
-- 열리지 않게 하는 것이 이 파일의 요점이다.

-- 배우자가 언제 연결됐는지. 지금까지는 웨딩 생성 시각으로 대신 보여주고 있었다.
ALTER TABLE structured.weddings ADD COLUMN partner_joined_at timestamptz;

/*
 * 배우자가 있으면 연결 시각도 있다.
 *
 * partner_user_id는 계정 삭제 시 ON DELETE SET NULL로 비워진다. 그때 시각만 남으면
 * "없는 사람이 언젠가 연결돼 있었다"는 상태가 된다. 아래 트리거가 둘을 함께 움직인다.
 */
ALTER TABLE structured.weddings
  ADD CONSTRAINT partner_join_is_recorded
    CHECK ((partner_user_id IS NULL) = (partner_joined_at IS NULL));

CREATE FUNCTION structured.sync_partner_joined_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.partner_user_id IS NULL THEN
    NEW.partner_joined_at := NULL;
  ELSIF NEW.partner_joined_at IS NULL THEN
    NEW.partner_joined_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER weddings_sync_partner_joined_at
  BEFORE INSERT OR UPDATE ON structured.weddings
  FOR EACH ROW
  EXECUTE FUNCTION structured.sync_partner_joined_at();

CREATE TYPE wedding_invite_status AS ENUM ('pending', 'accepted', 'revoked');

CREATE TABLE structured.wedding_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  /*
   * 초대 코드의 해시. 원문은 만들 때 한 번만 내려간다.
   *
   * 세션 토큰과 같은 이유다 — DB가 유출돼도 그것만으로 남의 웨딩에 들어갈 수 없다.
   */
  code_hash text NOT NULL UNIQUE,
  status wedding_invite_status NOT NULL DEFAULT 'pending',
  -- 링크가 영원히 살아 있으면 언젠가 흘러나온 링크로 낯선 사람이 들어온다.
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  revoked_at timestamptz,

  CONSTRAINT accepted_has_who_and_when
    CHECK ((status = 'accepted') = (accepted_at IS NOT NULL AND accepted_by IS NOT NULL)),
  CONSTRAINT revoked_has_timestamp
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

COMMENT ON TABLE structured.wedding_invites IS
  '배우자 초대. 코드는 해시로만 남고, 한 웨딩에 살아 있는 초대는 하나뿐이다.';

/*
 * 한 웨딩에 살아 있는 초대는 하나.
 *
 * 여러 장을 뿌려두면 어느 것이 유효한지 본인도 모르게 되고, 취소한 줄 알았던 링크가
 * 살아 있게 된다.
 */
CREATE UNIQUE INDEX wedding_invites_one_pending_idx
  ON structured.wedding_invites (wedding_id)
  WHERE status = 'pending';

CREATE INDEX wedding_invites_wedding_idx ON structured.wedding_invites (wedding_id, created_at DESC);

/*
 * 쓸 수 있는 초대만 보는 곳.
 *
 * 만료 조건이 뷰 안에 있어, 받아들이는 경로가 그것을 빠뜨릴 수 없다.
 * structured.comparable_quotes가 집계에 대해 하는 일과 같다.
 */
CREATE VIEW structured.usable_wedding_invites AS
SELECT i.id, i.wedding_id, i.invited_by, i.code_hash, i.expires_at, i.created_at
FROM structured.wedding_invites i
JOIN structured.weddings w ON w.id = i.wedding_id
WHERE i.status = 'pending'
  AND i.expires_at > now()
  -- 이미 배우자가 있으면 초대는 의미가 없다. 세 사람이 되는 길을 막는다.
  AND w.partner_user_id IS NULL;

COMMENT ON VIEW structured.usable_wedding_invites IS
  '아직 쓸 수 있는 초대. 만료·취소·이미 연결됨 조건이 이 뷰 안에만 있다.';
