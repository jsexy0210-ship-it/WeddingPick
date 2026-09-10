-- 만 14세 확인이 **무엇에 근거했는지**를 남긴다. 2026-09-10 사용자 지시.
--
-- 0078은 확인 여부(age_verified)와 시점(age_verified_at) 둘만 남겼다. 그때는
-- 경로가 하나(로그인 화면의 체크박스)뿐이라 구분할 것이 없었다. 지금은 둘이다 —
-- 카카오가 준 연령대로 서버가 판정한 것과, 화면에서 사람이 확인한 것.
--
-- 둘을 같은 값으로 두면 나중에 「이 계정의 확인은 무엇이었나」를 답할 수 없다.
-- 실제로 그 자리에서 막혔다: 2026-09-10에 만 14세 미만 계정이 들어온 것을
-- 발견했지만, 이미 들어온 계정 중 어느 것이 연령대 판정으로 켜졌고 어느 것이
-- 그냥 켜졌는지 DB만 봐서는 가릴 수 없다.
--
-- **연령대 문자열은 여전히 저장하지 않는다.** 남기는 것은 경로 이름 하나다.

CREATE TYPE age_verified_via AS ENUM ('provider', 'self_declared');

ALTER TABLE structured.users
  ADD COLUMN age_verified_via age_verified_via;

COMMENT ON COLUMN structured.users.age_verified_via IS
  '만 14세 확인의 근거. provider = 로그인 제공자가 준 연령대로 서버가 판정. self_declared = 제공자가 연령대를 주지 않아 화면에서 사람이 확인. NULL = 0104 이전에 확인된 계정이라 경로를 가릴 수 없다.';

-- 확인하지 않은 계정에 근거만 남는 일을 막는다. 반대 방향(확인했는데 근거가
-- NULL)은 허용한다 — 이 마이그레이션 이전 계정이 정확히 그 상태이고, 그것을
-- 「모른다」로 남겨두는 것이 아무 값이나 채워 넣는 것보다 정확하다.
ALTER TABLE structured.users
  ADD CONSTRAINT age_verified_via_only_when_verified
    CHECK (age_verified_via IS NULL OR age_verified = true);

-- 기존 계정은 채우지 않는다. 지금 DB에 그 근거가 남아 있지 않아서, 무엇으로
-- 채우든 사실이 아니라 추측이 된다. NULL이 「가릴 수 없음」을 그대로 말한다.
