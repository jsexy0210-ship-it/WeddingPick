-- 온보딩 3/4 예산 스텝을 자유 입력에서 구간 선택으로 바꾼다(디자인 핸드오프
-- 01-onboarding.dc.html #11e). 사용자는 숫자를 직접 입력하지 않는다 — 다섯 구간
-- 중 하나를 고른다.
--
-- budget_amount(0031)는 남긴다. TOP3 추천(packages/domain/top3.ts)이 그 컬럼을
-- 숫자로 비교한다 — 그 로직을 건드리지 않으려고 budget_amount는 구간의 상한값을
-- 서버가 파생해서 계속 채운다(packages/domain/budget-bracket.ts의
-- budgetBracketCeiling). "4,000만원 이상"은 상한이 없으니 NULL로 파생한다 —
-- budget_amount의 NULL이 원래 "아직 안 정함"이던 의미와 다르지만, top3.ts의
-- 필터 조건(`budgetAmount !== null`)에서 NULL은 "예산으로 거르지 않는다"는
-- 뜻이라 상한 없음과 자연히 맞아떨어진다.
--
-- 사용자가 실제로 고른 값은 budget_bracket에 그대로 남는다 — MY 화면
-- (apps/mobile/(tabs)/my)이 보여주는 값도, 나중에 예산 구간별 통계를 낼 때도
-- 이 컬럼을 쓴다. budget_amount에서 역으로 구간을 추측하지 않는다.

CREATE TYPE wedding_budget_bracket AS ENUM (
  'under_20m',
  '20m_30m',
  '30m_40m',
  'over_40m',
  'unknown'
);

ALTER TABLE structured.weddings
  ADD COLUMN budget_bracket wedding_budget_bracket;

COMMENT ON COLUMN structured.weddings.budget_bracket IS
  '온보딩에서 고른 예산 구간. NULL이면 아직 온보딩을 안 마친 것이다. budget_amount는 이 값에서 서버가 파생한다 — 역으로 쓰지 않는다.';
