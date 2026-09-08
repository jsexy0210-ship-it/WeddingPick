-- 화면 이름을 실명이 아니라 닉네임으로 (2026-09-08 결정).
--
-- 로그인 때 display_name을 소셜 프로필로 채우면서 닉네임이 없으면 실명(name)을
-- 썼다 — 카카오 실명이 홈 히어로에 그대로 떴다. 이제 서버는 닉네임만 쓴다
-- (apps/api/src/auth/sessions.ts). 이미 실명으로 채워진 계정을 한 번에 바로잡는다:
--
--   · 사용자가 MY에서 직접 정한 이름(display_name_user_set)은 건드리지 않는다.
--   · 닉네임이 있는 계정은 닉네임으로 덮어쓴다(로그인 때와 같은 5자 규칙).
--   · 닉네임이 없는 계정은 비운다 — 화면이 «우리»로 부른다. 실명을 남겨두지
--     않는다.

UPDATE structured.users u
SET display_name = left(i.nickname, 5)
FROM identity.identities i
WHERE i.user_id = u.id
  AND u.display_name_user_set = false
  AND i.nickname IS NOT NULL
  AND btrim(i.nickname) <> '';

UPDATE structured.users u
SET display_name = NULL
WHERE u.display_name_user_set = false
  AND u.display_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM identity.identities i
    WHERE i.user_id = u.id AND i.nickname IS NOT NULL AND btrim(i.nickname) <> ''
  );
