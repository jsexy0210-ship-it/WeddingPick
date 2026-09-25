-- 0435: 배우자 초대 코드를 6자리 숫자로 바꾼다(2026-09-25 대표 지시 — 「초대 코드는 6자리
-- 난수로만 생성한다」).
--
-- **코드 해시의 전역 유일을 푼다.** 6자리는 100만 가지뿐이라, 한 번 쓰였거나 만료된
-- 코드와 같은 숫자가 언젠가 다시 뽑힌다. 옛 줄(accepted · revoked · 만료)과 겹치는 것은
-- 문제가 아니고, **아직 대기 중인 줄끼리만 겹치지 않으면 된다.** 서버가 뽑을 때 대기 중인
-- 줄과 겹치면 다시 뽑고, 동시에 같은 숫자를 뽑은 드문 경우는 아래 색인이 막는다.
--
-- 기존에 발급된 긴 코드 줄은 지우지 않는다. 72시간 기한이 지나면 스스로 쓸 수 없게 된다.

ALTER TABLE structured.wedding_invites DROP CONSTRAINT wedding_invites_code_hash_key;

CREATE UNIQUE INDEX wedding_invites_pending_code_idx
  ON structured.wedding_invites (code_hash)
  WHERE status = 'pending';

CREATE INDEX wedding_invites_code_idx ON structured.wedding_invites (code_hash);

-- 코드 입력 실패 제한. 100만 가지는 맞혀 보기 쉽다.
--
-- 0423 `admin_login_attempts`와 같은 모양이다 — 계정 ID나 IP 원문은 남기지 않고
-- 애플리케이션이 SHA-256으로 만든 키만 둔다. 계정 기준 키와 IP 기준 키를 따로 센다.
CREATE TABLE structured.invite_code_attempts (
  attempt_key text PRIMARY KEY,
  failure_count integer NOT NULL CHECK (failure_count > 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_code_attempt_key_is_sha256_hex
    CHECK (attempt_key ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE structured.invite_code_attempts IS
  '배우자 초대 코드 입력 실패 제한용 단기 상태. 계정 ID/IP 원문은 저장하지 않고 SHA-256 키만 둔다.';

CREATE INDEX invite_code_attempts_updated_idx
  ON structured.invite_code_attempts (updated_at);
