-- 로그인 방법에 이메일을 더한다. 디자인 핸드오프 v3.12 — 카카오 + 이메일·비밀번호.
--
-- Postgres는 ALTER TYPE ... ADD VALUE로 더한 값을 같은 트랜잭션 안에서 쓰지
-- 못한다(0074_vendor_category_honeymoon.sql 참고) — 이 파일은 값만 더하고 끝낸다.
-- 테이블은 0076_email_login.sql에 있다.

ALTER TYPE identity_provider ADD VALUE IF NOT EXISTS 'email';
