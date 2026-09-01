-- 가입 연령과 약관 동의. 통합정책 v3.13 §N.
--
-- 정책의 요점 하나가 구현에서 자주 어긋난다 — **소셜 로그인 성공만으로 가입이
-- 끝나지 않는다.** 제공자가 토큰을 확인해주면 계정이 생기고, 동의 화면은 그 뒤에
-- 붙는 안내가 되기 쉽다. 그러면 동의를 건너뛴 계정이 이미 서비스를 쓰고 있다.
--
-- 그래서 **계정을 만드는 것과 살리는 것을 나눈다.** 로그인은 대기 상태의 계정을
-- 만들고, 필수 동의가 그것을 활성화한다. 읽는 쪽은 뷰 하나만 본다.

-- ---------------------------------------------------------------------------
-- 1. 연령 확인
-- ---------------------------------------------------------------------------

CREATE TYPE age_gate_result AS ENUM ('pending', 'passed', 'blocked');

ALTER TABLE structured.users
  ADD COLUMN age_gate age_gate_result NOT NULL DEFAULT 'pending',
  ADD COLUMN age_checked_at timestamptz,
  ADD COLUMN activated_at timestamptz;

COMMENT ON COLUMN structured.users.age_gate IS
  '만 14세 이상 확인 결과. 판정만 남긴다 — 생년월일은 서버가 세어보고 버린다.';

COMMENT ON COLUMN structured.users.age_checked_at IS
  '연령을 확인한 때. 언제 확인한 판정인지 모르면 판정이 없는 것과 같다.';

COMMENT ON COLUMN structured.users.activated_at IS
  '가입이 끝난 때. NULL이면 로그인만 된 대기 계정이다.';

/*
 * 확인하지 않았는데 확인한 때가 있거나, 확인했는데 때가 없는 상태를 막는다.
 * 이런 어긋남은 조용히 생기고, 나중에 "이 계정은 연령을 확인한 것인가"에
 * 답할 수 없게 만든다.
 */
ALTER TABLE structured.users
  ADD CONSTRAINT age_check_has_time
    CHECK ((age_gate = 'pending') = (age_checked_at IS NULL));

/*
 * 연령 확인을 통과하지 않은 계정은 살아날 수 없다. v3.13 §N-1.
 *
 * 코드에서도 막지만(domain/signup.ts) 여기서 한 번 더 막는다 — 새로 만드는
 * 관리 도구나 스크립트가 도메인을 거치지 않고 활성화하는 일이 실제로 생긴다.
 */
ALTER TABLE structured.users
  ADD CONSTRAINT activated_only_when_old_enough
    CHECK (activated_at IS NULL OR age_gate = 'passed');

-- ---------------------------------------------------------------------------
-- 2. 무엇에 동의했는가
-- ---------------------------------------------------------------------------

/*
 * 이력으로 쌓는다. 지우지 않는다.
 *
 * `payment_consents`(0036)와 같은 모양이다. 철회한 뒤 다시 동의할 수 있고,
 * 언제 동의했고 언제 철회했는지는 나중에 물어볼 수 있어야 한다.
 *
 * `is_required`를 행에 함께 적어둔다. 지금 무엇이 필수인지는 코드가 알지만,
 * **동의를 받던 그때 그것이 필수였는지**는 그때 적어두지 않으면 알 수 없다.
 * 나중에 선택이던 항목을 필수로 바꾸면 과거 동의의 성격이 소급해 바뀐다.
 */
CREATE TABLE structured.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  item text NOT NULL CHECK (length(btrim(item)) > 0),
  -- 약관 판. 판이 바뀌면 이전 동의는 다른 글에 대한 동의다.
  terms_version text NOT NULL CHECK (length(btrim(terms_version)) > 0),
  is_required boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  CONSTRAINT withdrawn_after_granted
    CHECK (withdrawn_at IS NULL OR withdrawn_at >= granted_at)
);

COMMENT ON TABLE structured.user_consents IS
  '약관 동의 이력. 항목·판·필수 여부·동의 일시를 남긴다(v3.13 §N-3).';

/* 살아 있는 동의는 항목·판마다 하나. 철회한 뒤 다시 동의할 수 있어 부분 색인이다. */
CREATE UNIQUE INDEX user_consents_active_idx
  ON structured.user_consents (user_id, item, terms_version)
  WHERE withdrawn_at IS NULL;

CREATE INDEX user_consents_user_idx ON structured.user_consents (user_id);

/*
 * 지금 살아 있는 동의. **읽는 쪽은 여기만 본다.**
 *
 * 철회한 동의가 표에 남아 있어서, 표를 직접 읽으면 철회한 사람도 동의한 것으로
 * 보인다. 관문을 하나로 둔다.
 */
CREATE VIEW structured.active_consents AS
SELECT c.user_id, c.item, c.terms_version, c.is_required, c.granted_at
FROM structured.user_consents c
WHERE c.withdrawn_at IS NULL;

COMMENT ON VIEW structured.active_consents IS
  '지금 살아 있는 동의. 철회하면 여기서 빠진다.';

-- ---------------------------------------------------------------------------
-- 3. 가입이 끝난 사람
-- ---------------------------------------------------------------------------

/*
 * **서비스를 쓸 수 있는 사람은 여기 있는 사람뿐이다.**
 *
 * `structured.users`를 직접 읽으면 대기 계정과 탈퇴한 계정이 함께 나온다.
 * 뷰를 하나 두고 그 이름을 적게 하면, 대기 계정을 통과시키려면 `users`라고
 * 적어야 한다 — 실수로는 하기 어렵고 리뷰에서 보인다.
 */
CREATE VIEW structured.active_users AS
SELECT u.id, u.display_name, u.is_operator, u.created_at, u.activated_at
FROM structured.users u
WHERE u.activated_at IS NOT NULL AND u.deleted_at IS NULL;

COMMENT ON VIEW structured.active_users IS
  '가입이 끝나고 탈퇴하지 않은 사람. 소셜 로그인만 한 대기 계정은 여기 없다(v3.13 §N-2).';

/*
 * 이미 있는 계정은 활성으로 본다.
 *
 * 이 정책 전에 가입한 사람에게 앱을 다시 켰더니 가입이 안 끝났다고 말할 수는 없다.
 * 연령은 그때 묻지 않았으므로 `passed`로 두되, 확인한 때를 마이그레이션 시각으로
 * 남겨 **언제 어떤 근거로 통과된 것인지**가 보이게 한다.
 *
 * 약관 재동의는 판으로 관리한다(§N-3) — 확정본이 나오면 그 판으로 다시 받는다.
 */
UPDATE structured.users
SET age_gate = 'passed',
    age_checked_at = now(),
    activated_at = created_at
WHERE deleted_at IS NULL;
