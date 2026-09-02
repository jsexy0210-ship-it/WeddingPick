-- 0052가 만든 reward_kind ENUM 확장을, 실제로 쓸 수 있는 트랜잭션으로 미룬 것.
--
-- Postgres는 `ALTER TYPE ... ADD VALUE`로 더한 값을 **같은 트랜잭션 안에서** 쓰지
-- 못하게 막는다("unsafe use of new value of enum type"). 이 파일은 값을 더하기만
-- 한다 — 쓰는 쪽(제약)은 0054에서, 이 트랜잭션이 커밋된 뒤에 한다.
--
-- `IF NOT EXISTS`인 이유: main에 먼저 병합된 `0047_monthly_draw.sql`이 같은 값을
-- 이미 더해놨다(두 세션이 같은 기능을 독립적으로 만들다 겹쳤다 — 0052 주석 참고).
-- 없이 쓰면 "enum label already exists"로 매번 실패한다.

ALTER TYPE reward_kind ADD VALUE IF NOT EXISTS 'monthly_draw';
