-- 이메일 로그인. 디자인 핸드오프 v3.12(WP-AUTH-002~007).
--
-- identities에 (provider='email', subject=소문자 이메일) 행이 하나 생기고, 비밀번호는
-- 그 행에 1:1로 붙는다. identities 자체에 컬럼을 두지 않는 이유: 소셜 계정 행에는
-- 비밀번호가 없어야 하고, NULL 컬럼으로 두면 "비밀번호 없는 이메일 계정"이라는
-- 있어서는 안 되는 상태가 스키마상 허용된다.

CREATE TABLE identity.email_credentials (
  identity_id uuid PRIMARY KEY REFERENCES identity.identities (id) ON DELETE CASCADE,
  -- scrypt$<salt>$<key>. 원문은 어디에도 없다.
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE identity.email_credentials IS
  '이메일 로그인 비밀번호. identities의 provider=email 행에만 붙는다.';

-- 비밀번호 재설정 링크. 토큰 원문은 메일로 한 번만 나가고 여기엔 SHA-256만 남는다.
CREATE TABLE identity.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES identity.identities (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 메일 문구가 30분이라고 말한다(WP-AUTH-006). 서버가 그 약속을 지킨다.
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT password_reset_expires_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX password_resets_identity_idx ON identity.password_resets (identity_id);
