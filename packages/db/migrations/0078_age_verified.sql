-- 만 14세 확인을 생년월일 계산에서 자기 신고 체크박스로 바꾼다. 통합정책
-- v3.13 §3.5(디자인 핸드오프 v3.13 — 로그인 화면 «만 14세 이상이에요»).
--
-- 예전에는 생년월일을 받아 만 나이를 셌다(0046, age_gate 3단계 enum). 이제는
-- 생년월일 자체를 받지 않는다 — 로그인 화면의 체크박스 하나가 확인의 전부다.
-- 그래서 저장할 것도 단순해진다: 확인했는가(boolean) · 언제(timestamp) 둘뿐이다.
--
-- age_gate·age_checked_at 컬럼과 그 위의 CHECK 둘(age_check_has_time,
-- activated_only_when_old_enough)은 지우지 않는다. 서버는 계속 그 두 컬럼도
-- 함께 채운다(항상 age_gate='passed'로만 — 이제는 'blocked'로 갈 길이 없다.
-- 체크하지 않으면 계정 자체를 만들지 않기 때문이다) — 기존 제약을 건드리지
-- 않고 새 컬럼을 그 위에 얹는 편이 마이그레이션 위험이 적다.

ALTER TABLE structured.users
  ADD COLUMN age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN age_verified_at timestamptz;

COMMENT ON COLUMN structured.users.age_verified IS
  '로그인 화면의 «만 14세 이상이에요» 체크박스를 확인했는가. 생년월일은 받지도 저장하지도 않는다.';

COMMENT ON COLUMN structured.users.age_verified_at IS
  '확인한 시점. 확인 절차를 뒀다는 사실을 증명하는 용도라 시점만 남긴다.';

ALTER TABLE structured.users
  ADD CONSTRAINT age_verified_has_time
    CHECK (age_verified = (age_verified_at IS NOT NULL));

-- 기존 계정(age_gate='passed')은 그 확인을 새 컬럼으로도 이어받는다. 이 정책
-- 전에 가입한 사람에게 다시 체크하라고 할 이유가 없다 — 0046이 이미 같은
-- 논리로 activated_at을 이어받았다.
UPDATE structured.users
SET age_verified = true,
    age_verified_at = coalesce(age_checked_at, activated_at, created_at)
WHERE age_gate = 'passed';
