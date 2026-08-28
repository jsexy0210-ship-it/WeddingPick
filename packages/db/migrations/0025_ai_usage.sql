-- AI 사용량과 비용. 화면데이터구조 스펙 7.3.
--
-- 스펙이 요구한 것: 기능별 request_count / input·output tokens / estimated_cost /
-- success_rate / escalation_rate / user_correction_rate, 그리고 기능별 월 예산.
--
-- **호출마다 한 줄씩 남긴다.** 합계만 갱신하면 성공률도 escalation률도 낼 수 없다 —
-- 그 셋은 호출 단위의 사실이라 합쳐 버리면 되돌릴 수 없다. 비율은 뷰가 센다.

CREATE TYPE ai_feature AS ENUM (
  'document_extraction',
  'payment_proof_vision',
  'visit_note',
  'free_query'
);

CREATE TABLE structured.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature ai_feature NOT NULL,
  -- 모델 이름은 자유 문자열이다. enum으로 두면 모델이 하나 나올 때마다 마이그레이션이 필요하다.
  model text NOT NULL CHECK (length(btrim(model)) > 0),

  input_tokens integer NOT NULL CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  -- 캐시에서 읽은 토큰. 같은 지시문을 반복해 보내는 자리라 이게 크면 잘 되고 있는 것이다.
  cached_input_tokens integer NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),

  /*
   * 추정 비용. **모르는 모델이면 NULL이다 — 0이 아니다.**
   *
   * 0으로 두면 "공짜였다"로 읽히고 합계에 조용히 섞인다. 그러면 예산이 실제보다
   * 넉넉해 보이고, 넘긴 뒤에야 알게 된다.
   */
  estimated_cost_usd numeric(12, 6),

  succeeded boolean NOT NULL,

  /*
   * 어느 모델에서 올라왔는지. 스펙 7.3의 "confidence 낮으면 상위 모델".
   *
   * NULL이면 처음부터 이 모델로 부른 것이다. 값이 있으면 한 번 더 부른 것이고,
   * 그 비율이 escalation_rate다 — 높으면 저비용 모델을 먼저 부르는 것이 손해다.
   */
  escalated_from text,

  /*
   * 사용자가 읽어준 값을 고쳤는지. 스펙 7.3의 user_correction_rate.
   *
   * 등록 시점에 채워지므로 처음에는 NULL이다. 세 값이 다르다 — 아직 모름(NULL),
   * 그대로 씀(false), 고침(true). false로 시작하면 등록하지 않고 떠난 사람이
   * "그대로 썼다"로 집계된다.
   */
  user_corrected boolean,

  requested_at timestamptz NOT NULL DEFAULT now(),
  latency_ms integer CHECK (latency_ms >= 0),

  -- 실패한 호출에는 올라갈 곳이 없다. 실패를 escalation으로 세면 비율이 부풀려진다.
  CONSTRAINT escalation_is_a_retry CHECK (escalated_from IS NULL OR escalated_from <> model)
);

COMMENT ON TABLE structured.ai_usage IS
  'AI 호출 한 건. 스펙 7.3의 지표를 내려면 호출 단위여야 한다 — 합계만 두면 성공률·escalation률을 되돌릴 수 없다.';
COMMENT ON COLUMN structured.ai_usage.estimated_cost_usd IS
  '추정 비용. 단가를 모르는 모델이면 NULL. 0으로 두면 합계에 섞여 예산이 넉넉해 보인다.';
COMMENT ON COLUMN structured.ai_usage.user_corrected IS
  'NULL은 아직 모름, false는 그대로 씀, true는 고침. 셋이 다른 상태다.';

CREATE INDEX ai_usage_feature_month_idx
  ON structured.ai_usage (feature, requested_at DESC);

-- ---------------------------------------------------------------------------
-- 기능별 월 예산
-- ---------------------------------------------------------------------------
--
-- 도메인의 MONTHLY_BUDGET_USD가 기본값이고(아직 전부 null), 이 표는 그것을 덮어쓴다.
-- 표를 따로 두는 이유는 예산이 운영 중에 바뀌는 값이기 때문이다 — 코드를 다시
-- 내보내지 않고 바꿀 수 있어야 한다.

CREATE TABLE structured.ai_budgets (
  feature ai_feature NOT NULL,
  -- 그 달의 1일. 월 단위 예산이라 날짜를 월초로 못박는다.
  month date NOT NULL CHECK (date_trunc('month', month) = month),
  budget_usd numeric(12, 2) NOT NULL CHECK (budget_usd > 0),
  set_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feature, month)
);

COMMENT ON TABLE structured.ai_budgets IS
  '기능별 월 예산. 없으면 한도가 없는 것이다 — 지어낸 한도를 걸어두면 재보기도 전에 막힌다.';

-- ---------------------------------------------------------------------------
-- 스펙 7.3이 요구한 지표
-- ---------------------------------------------------------------------------
--
-- 비율을 저장하지 않고 센다. 저장하면 호출이 하나 들어올 때마다 갱신해야 하고,
-- 언젠가 한 곳에서 갱신을 잊는다.

CREATE VIEW structured.ai_usage_monthly AS
SELECT
  u.feature,
  date_trunc('month', u.requested_at)::date AS month,
  u.model,
  count(*) AS request_count,
  sum(u.input_tokens) AS input_tokens,
  sum(u.output_tokens) AS output_tokens,
  sum(u.cached_input_tokens) AS cached_input_tokens,
  -- 단가를 모르는 호출은 여기 안 들어온다. 몇 건이 빠졌는지 옆에 함께 센다.
  sum(u.estimated_cost_usd) AS estimated_cost_usd,
  count(*) FILTER (WHERE u.estimated_cost_usd IS NULL) AS uncosted_count,

  avg(CASE WHEN u.succeeded THEN 1.0 ELSE 0.0 END) AS success_rate,
  avg(CASE WHEN u.escalated_from IS NOT NULL THEN 1.0 ELSE 0.0 END) AS escalation_rate,
  /*
   * 아직 모르는 것은 분모에서 뺀다. 후기 이용점수의 "모름"과 같은 규칙이다
   * (스펙 5.5) — 모르는 것을 0으로 세면 비율이 늘 낮게 나온다.
   */
  avg(CASE WHEN u.user_corrected THEN 1.0 ELSE 0.0 END)
    FILTER (WHERE u.user_corrected IS NOT NULL) AS user_correction_rate,
  count(*) FILTER (WHERE u.user_corrected IS NULL) AS correction_unknown_count,

  percentile_cont(0.5) WITHIN GROUP (ORDER BY u.latency_ms) AS median_latency_ms
FROM structured.ai_usage u
GROUP BY 1, 2, 3;

COMMENT ON VIEW structured.ai_usage_monthly IS
  '스펙 7.3의 지표. 비율은 저장하지 않고 센다 — 저장하면 언젠가 한 곳에서 갱신을 잊는다.';

/*
 * 이번 달 쓴 돈과 예산.
 *
 * 예산이 없으면 budget_usd가 NULL이고, 그것이 "한도 없음"이다. 뷰가 그 상태를
 * 지우지 않는다 — 한도가 없다는 것도 운영자가 알아야 할 사실이다.
 */
CREATE VIEW structured.ai_budget_status AS
SELECT
  f.feature,
  date_trunc('month', now())::date AS month,
  coalesce(spent.total_usd, 0) AS spent_usd,
  b.budget_usd,
  CASE
    WHEN b.budget_usd IS NULL THEN 'unlimited'
    WHEN coalesce(spent.total_usd, 0) >= b.budget_usd THEN 'exceeded'
    ELSE 'within'
  END AS state,
  coalesce(spent.uncosted_count, 0) AS uncosted_count
FROM unnest(enum_range(NULL::ai_feature)) AS f(feature)
LEFT JOIN structured.ai_budgets b
  ON b.feature = f.feature AND b.month = date_trunc('month', now())::date
LEFT JOIN LATERAL (
  SELECT
    sum(u.estimated_cost_usd) AS total_usd,
    count(*) FILTER (WHERE u.estimated_cost_usd IS NULL) AS uncosted_count
  FROM structured.ai_usage u
  WHERE u.feature = f.feature
    AND u.requested_at >= date_trunc('month', now())
) spent ON true;

COMMENT ON VIEW structured.ai_budget_status IS
  '기능별 이번 달 지출과 예산 상태. 한도가 없으면 unlimited — 그것도 알아야 할 사실이라 감추지 않는다.';
