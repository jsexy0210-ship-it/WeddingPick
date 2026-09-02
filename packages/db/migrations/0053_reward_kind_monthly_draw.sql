-- 0052가 만든 reward_kind ENUM 확장을, 실제로 쓸 수 있는 트랜잭션으로 미룬 것.
--
-- Postgres는 `ALTER TYPE ... ADD VALUE`로 더한 값을 **같은 트랜잭션 안에서** 쓰지
-- 못하게 막는다("unsafe use of new value of enum type"). 이 파일은 값을 더하기만
-- 한다 — 쓰는 쪽(제약)은 0054에서, 이 트랜잭션이 커밋된 뒤에 한다.

ALTER TYPE reward_kind ADD VALUE 'monthly_draw';
