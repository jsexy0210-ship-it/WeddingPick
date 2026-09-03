-- 친구초대 코드 사용 로그. redeemReferral() 감사 추적용.
--
-- referrals 테이블(0039)은 성공·검증된 초대 관계를 담는다 — 인바이터와
-- 인바이티가 누구인지만 알면 되고, 코드 문자열 자체는 필요 없다.
-- 이 테이블은 그 반대 목적이다 — 어떤 코드가 언제 누가 입력했는지를
-- 원본 그대로 남겨, 중복 시도·오입력·어뷰징 패턴을 분석할 수 있게 한다.
--
-- **성공 여부와 무관하게 모든 입력 시도를 기록한다.** 성공 시에는
-- referrals 행이 함께 생기고, invite_code_uses.referral_id로 연결된다.
--
-- 이미 referral_codes · referrals 테이블이 있어
-- invite_code_uses를 만들지 않아도 서비스는 돌아간다.
-- 이 테이블의 목적은 순수 감사 로그다 — 지워도 기능에는 영향이 없다.

CREATE TABLE IF NOT EXISTS structured.invite_code_uses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 입력된 코드 원문. referral_codes.code에 있는 유효 코드일 수도 있고
  -- 오입력·존재하지 않는 코드일 수도 있다.
  referral_code text        NOT NULL CHECK (length(btrim(referral_code)) > 0),

  -- 입력한 사람. NULL이 되면 안 된다 — 비로그인 상태에서는 이 API를 부르지 않는다.
  used_by       uuid        NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,

  used_at       timestamptz NOT NULL DEFAULT now(),

  -- 성공 시 생성된 referrals 행. 실패(코드 없음·중복·자기 코드)면 NULL.
  referral_id   uuid        REFERENCES structured.referrals (id) ON DELETE SET NULL,

  -- 실패 사유. 성공이면 NULL.
  -- 'not_found' | 'already_used' | 'self_referral' | 'already_qualified'
  failure_reason text        CHECK (
    failure_reason IS NULL
    OR failure_reason IN ('not_found', 'already_used', 'self_referral', 'already_qualified')
  ),

  CONSTRAINT invite_code_uses_success_xor_failure
    CHECK ((referral_id IS NULL) <> (failure_reason IS NULL))
);

COMMENT ON TABLE structured.invite_code_uses IS
  '친구초대 코드 입력 감사 로그. 성공·실패 모두 기록한다. 기능은 referrals 테이블이 담당한다.';
COMMENT ON COLUMN structured.invite_code_uses.referral_code IS
  '입력된 코드 원문. 유효하지 않은 코드도 그대로 남긴다 — 어뷰징 분석에 필요하다.';
COMMENT ON COLUMN structured.invite_code_uses.failure_reason IS
  '성공이면 NULL. 실패 시 not_found | already_used | self_referral | already_qualified 중 하나.';

-- 어뷰저 탐지: 한 사람이 짧은 시간 안에 여러 번 시도했는지.
CREATE INDEX IF NOT EXISTS invite_code_uses_user_idx
  ON structured.invite_code_uses (used_by, used_at DESC);

-- 특정 코드가 얼마나 많이 쓰였는지 집계.
CREATE INDEX IF NOT EXISTS invite_code_uses_code_idx
  ON structured.invite_code_uses (referral_code, used_at DESC);
