-- 준비 예산 구간 — 디자인 핸드오프 v3.19 «예산 질문을 앞으로 쓸 예산으로 통일»(2026-09-08).
--
--   500만원 이하 · 500~1,000만원 · 1,000~2,000만원 · 2,000~3,000만원 · 3,000만원 이상 · 아직 모르겠어요
--   under_5m       5m_10m         10m_20m           20m_30m           over_30m         unknown
--
-- 전체 예산이 아니라 «앞으로 준비에 쓸 예산»이라 500만원 단위로 잘게 나눴다.
-- 0077의 네 구간(under_20m · 20m_30m · 30m_40m · over_40m) 중 20m_30m과 unknown은
-- 그대로 쓰고, 나머지는 0087이 새 값으로 옮긴다. Postgres는 enum 값을 지우지 못해
-- under_20m · 30m_40m · over_40m은 값만 남는다 — 화면·API·시드 어디에서도 쓰지 않는다.
--
-- ALTER TYPE ... ADD VALUE로 더한 값은 같은 트랜잭션 안에서 쓰지 못한다 — 옮기는
-- UPDATE는 0087에 둔다.

ALTER TYPE wedding_budget_bracket ADD VALUE IF NOT EXISTS 'under_5m';
ALTER TYPE wedding_budget_bracket ADD VALUE IF NOT EXISTS '5m_10m';
ALTER TYPE wedding_budget_bracket ADD VALUE IF NOT EXISTS '10m_20m';
ALTER TYPE wedding_budget_bracket ADD VALUE IF NOT EXISTS 'over_30m';
