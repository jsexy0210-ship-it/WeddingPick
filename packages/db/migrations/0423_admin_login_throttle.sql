-- 0423: 관리자 로그인 실패 제한을 프로세스 메모리 밖으로 옮긴다.
--
-- 한 VM에서만 돌 때도 프로세스 재시작은 일어난다. 메모리 Map에 실패 횟수를 두면
-- 재시작 순간 제한이 사라지고, 인스턴스가 둘 이상이면 각자 다른 횟수를 센다.
--
-- 원문 로그인 ID나 IP 주소는 저장하지 않는다. 애플리케이션이 둘을 SHA-256으로
-- 묶은 attempt_key만 보낸다. 이 표는 인증 감사 로그가 아니라 짧게 사는 throttle
-- 상태라서, 15분 동안 새 요청이 없던 키는 로그인 요청 시 정리한다.

CREATE TABLE structured.admin_login_attempts (
  attempt_key text PRIMARY KEY,
  failure_count integer NOT NULL CHECK (failure_count > 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_login_attempt_key_is_sha256_hex
    CHECK (attempt_key ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE structured.admin_login_attempts IS
  '관리자 로그인 brute-force 완화용 단기 상태. 로그인 ID/IP 원문은 저장하지 않고 SHA-256 결합 키만 둔다.';

COMMENT ON COLUMN structured.admin_login_attempts.failure_count IS
  '현재 15분 창에서 인증 실패가 확정된 횟수. 진행 중인 인증 요청은 포함하지 않으며 완전한 로그인 성공 시 키 전체를 삭제한다.';

COMMENT ON COLUMN structured.admin_login_attempts.window_started_at IS
  '현재 확정 실패 제한 창이 시작된 시각. 15분이 지나면 다음 확정 실패부터 count를 1로 다시 시작한다.';

COMMENT ON COLUMN structured.admin_login_attempts.updated_at IS
  '마지막 확정 실패 시각. 오래 사용되지 않은 키를 정리하는 기준.';

CREATE INDEX admin_login_attempts_updated_idx
  ON structured.admin_login_attempts (updated_at);
