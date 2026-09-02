-- 소셜 로그인 제공자가 확인한 프로필. 로그인 신원과 같은 개인정보 영역에 둔다.
ALTER TABLE identity.identities
  ADD COLUMN name text,
  ADD COLUMN nickname text,
  ADD COLUMN profile_image_url text,
  ADD COLUMN gender text,
  ADD COLUMN birthday text,
  ADD COLUMN age_range text,
  ADD COLUMN birth_year text,
  ADD COLUMN mobile text;

ALTER TABLE structured.users
  ADD COLUMN display_name_user_set boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN structured.users.display_name_user_set IS
  'true면 사용자가 MY에서 직접 정한 값(직접 비우기도 포함)이므로 소셜 값으로 덮지 않는다.';

COMMENT ON COLUMN identity.identities.name IS '소셜 제공자 회원 이름';
COMMENT ON COLUMN identity.identities.nickname IS '소셜 제공자 별명';
COMMENT ON COLUMN identity.identities.profile_image_url IS '소셜 제공자 프로필 사진 URL';
COMMENT ON COLUMN identity.identities.gender IS '소셜 제공자 성별 코드';
COMMENT ON COLUMN identity.identities.birthday IS '소셜 제공자 생일(MM-DD)';
COMMENT ON COLUMN identity.identities.age_range IS '소셜 제공자 연령대';
COMMENT ON COLUMN identity.identities.birth_year IS '소셜 제공자 출생연도';
COMMENT ON COLUMN identity.identities.mobile IS '소셜 제공자 휴대전화번호';
