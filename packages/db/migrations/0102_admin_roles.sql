-- 관리자 계정과 권한 등급.
--
-- 2026-09-10 사용자 요청 — 운영자가 직접 관리자 계정을 만들 수 있게 하고, 새 계정에
-- 실질 운영 권한과 단순 뷰어 권한을 나눠 줄 수 있게 한다.
--
-- **권한이 불리언 하나였다.** 0013이 더한 `structured.users.is_operator`는 켜져
-- 있거나 꺼져 있거나 둘뿐이다. 「보기만 하는 사람」을 만들 자리가 없어서, 콘솔을
-- 열어 줄 수 있는 유일한 방법이 모든 것을 할 수 있게 열어 주는 것이었다.
--
-- ---------------------------------------------------------------------------
-- 왜 users에 열을 더하지 않는가
-- ---------------------------------------------------------------------------
--
-- `structured.users`에는 서비스 이용자가 전부 들어 있다. 거기에 `login_id`와
-- `password_hash`를 더하면 이용자 줄마다 비어 있는 자격증명 열이 생기고, **그 열에
-- 값이 잘못 들어가는 순간 일반 이용자 계정이 관리자 콘솔 로그인 경로가 된다.**
-- 관리자 계정은 한 줌이므로 제 표를 갖는 편이 싸다.
--
-- ---------------------------------------------------------------------------
-- is_operator는 그대로 둔다
-- ---------------------------------------------------------------------------
--
-- `is_operator`를 보는 자리가 서버 전체에 퍼져 있다 — 세션 기간(sessions.ts),
-- 탈퇴 거절(withdrawal.ts), 파기 알림 수신자(retention/alert.ts), 심사 도구
-- (decisions.ts), 그리고 `.github/workflows/admin-operator.yml`. 등급을 더하면서
-- 그것들을 함께 고치면 하나를 빠뜨렸을 때 **권한이 조용히 넓어진다.**
--
-- 그래서 `is_operator`는 「운영자 이상」으로 계속 참이다. 뷰어는 거짓이고, 그 덕에
-- decisions.ts의 `requireOperator`가 뷰어를 한 겹 더 막는다 — 관문이 뚫려도 결정
-- 함수가 다시 본다. 아래 트리거가 그 대응을 손이 아니라 표가 지키게 한다.

CREATE TYPE admin_role AS ENUM ('super', 'operator', 'viewer');

COMMENT ON TYPE admin_role IS
  '관리자 콘솔 등급(0102). super=계정 관리 포함 전부 · operator=운영 쓰기 · viewer=읽기만.';

CREATE TABLE structured.admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /*
   * 한 사람에 한 줄. `identity.identities`(provider='admin')가 아이디 → 계정을
   * 잇고, 이 표는 그 계정이 콘솔에서 무엇을 할 수 있는지를 잇는다.
   */
  user_id uuid NOT NULL UNIQUE REFERENCES structured.users (id) ON DELETE CASCADE,

  /*
   * 로그인 아이디. `identities.subject`와 같은 값이지만 여기에도 둔다 — 계정
   * 목록을 그리려고 신원 표를 조인하면, 신원이 없는(아직 한 번도 로그인하지 않은)
   * 새 계정이 목록에서 사라진다.
   */
  login_id text NOT NULL UNIQUE CHECK (length(btrim(login_id)) BETWEEN 3 AND 64),

  /*
   * `scrypt$<소금 base64>$<해시 base64>`. **원문이 들어올 자리가 없다** — 아래
   * 제약이 꼴을 강제하므로 실수로 평문을 넣으면 INSERT가 실패한다.
   */
  password_hash text NOT NULL CHECK (password_hash LIKE 'scrypt$%$%'),

  role admin_role NOT NULL,

  /* 지우지 않고 끈다. 지우면 이 사람이 남긴 감사기록의 행위자가 끊긴다. */
  disabled_at timestamptz,

  /* 누가 만들었는가. 만든 사람이 나중에 지워져도 계정은 남는다. */
  created_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_accounts_active_super_idx
  ON structured.admin_accounts (role)
  WHERE role = 'super' AND disabled_at IS NULL;

COMMENT ON TABLE structured.admin_accounts IS
  '관리자 콘솔 계정과 등급(0102). 비밀번호는 scrypt 해시만 담는다 — 원문은 어디에도 남지 않는다.';
COMMENT ON COLUMN structured.admin_accounts.disabled_at IS
  '끈 시각. 계정을 지우지 않는 이유는 감사기록의 행위자가 끊기지 않게 하기 위해서다.';

-- ---------------------------------------------------------------------------
-- 등급과 is_operator가 어긋나지 않게
-- ---------------------------------------------------------------------------
--
-- 두 값이 다른 표에 있으면 언젠가 어긋난다. 어긋나는 쪽이 「뷰어인데 is_operator가
-- 참」이면 뷰어가 심사 도구를 쓸 수 있게 되고, 그건 등급이 없는 것과 같다.
--
-- **손으로 맞추지 않고 표가 맞춘다.** 등급이 정해지거나 바뀌거나 계정이 꺼질 때마다
-- 이 트리거가 `users.is_operator`를 다시 쓴다. 끈 계정은 등급과 무관하게 거짓이다.

CREATE FUNCTION structured.sync_admin_operator_flag() RETURNS trigger AS $$
BEGIN
  UPDATE structured.users
  SET is_operator = (NEW.disabled_at IS NULL AND NEW.role IN ('super', 'operator'))
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_accounts_sync_operator
  AFTER INSERT OR UPDATE OF role, disabled_at, user_id
  ON structured.admin_accounts
  FOR EACH ROW EXECUTE FUNCTION structured.sync_admin_operator_flag();

COMMENT ON FUNCTION structured.sync_admin_operator_flag() IS
  '등급 → users.is_operator. 「운영자 이상」에서만 참. 두 값이 어긋날 자리를 없앤다.';

-- ---------------------------------------------------------------------------
-- 마지막 슈퍼 관리자는 사라질 수 없다
-- ---------------------------------------------------------------------------
--
-- 마지막 한 명이 자기를 뷰어로 내리거나 꺼 버리면 **아무도 계정 관리에 들어갈 수
-- 없다.** 라우트에서도 막지만 여기에도 둔다 — 라우트는 하나 더 생길 수 있고, CLI나
-- psql로 직접 고치는 날도 온다. 마지막 방어선은 표에 있어야 한다.
--
-- 세는 것과 바꾸는 것 사이에 다른 트랜잭션이 끼면 둘 다 「나 말고 하나 더 있다」를
-- 보고 둘 다 내려갈 수 있다. AFTER 트리거가 같은 트랜잭션 끝에서 다시 세므로 그
-- 경우 뒤에 커밋하는 쪽이 실패한다.

CREATE FUNCTION structured.keep_one_super_admin() RETURNS trigger AS $$
DECLARE remaining integer;
BEGIN
  SELECT count(*) INTO remaining
  FROM structured.admin_accounts
  WHERE role = 'super' AND disabled_at IS NULL;

  IF remaining = 0 THEN
    RAISE EXCEPTION '마지막 슈퍼 관리자는 내리거나 끌 수 없다'
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

/*
 * 표가 비어 있는 동안(부트스트랩 전)에는 세지 않는다 — 첫 계정을 만들 수 없게 된다.
 * 그래서 UPDATE·DELETE에만 단다. INSERT는 super를 줄이지 않는다.
 */
CREATE CONSTRAINT TRIGGER admin_accounts_keep_one_super
  AFTER UPDATE OR DELETE ON structured.admin_accounts
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION structured.keep_one_super_admin();

COMMENT ON FUNCTION structured.keep_one_super_admin() IS
  '활성 슈퍼 관리자가 0명이 되는 변경을 막는다. 라우트가 아니라 표가 막는 마지막 방어선.';
