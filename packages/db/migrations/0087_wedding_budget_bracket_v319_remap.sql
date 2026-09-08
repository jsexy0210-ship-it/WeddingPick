-- 0086이 더한 enum 값을 쓴다 — 같은 트랜잭션에서는 못 쓰기 때문에 파일을 나눴다.
--
-- 옛 구간을 새 구간으로 옮긴다. 옛 구간은 전체 예산이고 새 구간은 앞으로 쓸
-- 예산이라 뜻이 정확히 같지는 않지만, 사용자가 고른 것과 가장 가까운 칸이다 —
-- 비워서 온보딩에 다시 붙잡는 것보다 낫다. 사용자는 MY에서 언제든 바꿀 수 있다.
--
--   under_20m → 10m_20m    (2,000만원 이하 → 1,000~2,000만원)
--   20m_30m   → 20m_30m    (그대로)
--   30m_40m   → over_30m   (3,000~4,000만원 → 3,000만원 이상)
--   over_40m  → over_30m
--
-- budget_amount는 구간의 상한값을 서버가 파생한 것(0077)이라 같이 옮긴다 —
-- over_30m은 상한이 없어 NULL.

UPDATE structured.weddings
SET budget_bracket = CASE budget_bracket
      WHEN 'under_20m' THEN '10m_20m'::wedding_budget_bracket
      WHEN '30m_40m' THEN 'over_30m'::wedding_budget_bracket
      WHEN 'over_40m' THEN 'over_30m'::wedding_budget_bracket
    END,
    budget_amount = CASE budget_bracket
      WHEN 'under_20m' THEN 20000000
      ELSE NULL
    END
WHERE budget_bracket IN ('under_20m', '30m_40m', 'over_40m');

COMMENT ON TYPE wedding_budget_bracket IS
  '준비 예산 구간. 핸드오프 v3.19의 6종(under_5m · 5m_10m · 10m_20m · 20m_30m · over_30m · unknown). under_20m · 30m_40m · over_40m(0077)은 폐기 — 값만 남아 있고 쓰지 않는다.';
