-- 핸드오프 v3.22(2026-09-08) «이벤트 예산 · 월 50만원» — reward_kind에 `mission`
-- (미션 4개 완주 5,000원 × 40커플)을 더한다.
--
-- Postgres는 `ALTER TYPE ... ADD VALUE`로 더한 값을 **같은 트랜잭션 안에서** 쓰지
-- 못하게 막는다("unsafe use of new value of enum type"). 0053/0054와 같은 방식으로
-- 이 파일은 값을 더하기만 한다 — 쓰는 쪽(제약·부분 인덱스)은 0091a에서, 이
-- 트랜잭션이 커밋된 뒤에 한다.

ALTER TYPE reward_kind ADD VALUE IF NOT EXISTS 'mission';
