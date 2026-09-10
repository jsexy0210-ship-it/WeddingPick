-- 인프라 비용을 하루 한 번 적어 둔다.
--
-- 2026-09-10 사용자 결정 — 「A. 하루 한 번 수집」. 지금은 AI 호출 비용만 보이고
-- (WP-ADM-050) Render · Neon · Object Storage 요금은 각 콘솔에 들어가야 알 수 있다.
-- 세 곳을 따로 열어보는 동안에는 「이번 달에 얼마 나가고 있나」에 아무도 답하지 못한다.
--
-- **분 단위로 볼 값이 아니다.** 인프라 요금은 하루 단위로도 충분히 빠르고, 화면을 열
-- 때마다 외부 API를 부르면 그쪽이 죽었을 때 관리자 화면이 함께 멈춘다. 하루 한 번
-- 받아서 여기 쌓고, 화면은 이 표만 읽는다.
--
-- **AI 비용은 여기 넣지 않는다.** 그쪽은 호출을 세어 단가를 곱하는 계산값이고
-- (`ai_usage`), 이 표는 공급자가 청구한 금액이다. 성격이 달라 한 표에 두면
-- 「이 숫자는 실제 청구인가 추정인가」를 매번 다시 물어야 한다.

CREATE TABLE structured.infra_costs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 공급자. 값을 열거형으로 묶지 않는다 — 서비스를 하나 더 쓰기 시작할 때마다
  -- 마이그레이션을 새로 쓰는 것보다, 수집기가 아는 이름을 그대로 적는 편이 낫다.
  provider      text        NOT NULL CHECK (provider <> ''),

  -- 무엇에 대한 요금인가. 서비스 이름이나 자원 이름(예: 'weddingpick-api').
  -- 공급자가 총액만 주면 NULL이다.
  resource      text,

  -- 어느 기간의 금액인가. 공급자마다 주는 단위가 달라 시작·끝을 그대로 적는다.
  period_start  date        NOT NULL,
  period_end    date        NOT NULL,

  -- 금액과 통화. Render는 USD, 네이버 클라우드는 KRW다. 환산하지 않는다 —
  -- 환산은 보는 쪽에서 그날 환율로 한다. 여기서 바꾸면 원본을 잃는다.
  amount        numeric(14, 4) NOT NULL CHECK (amount >= 0),
  currency      text        NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),

  -- 금액이 아닌 값(저장 용량 · 요청 수 등). 공급자마다 달라 열로 만들지 않는다.
  metrics       jsonb,

  collected_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT infra_cost_period_in_order CHECK (period_end >= period_start)
);

-- 같은 공급자 · 같은 자원 · 같은 기간은 한 번만. 하루 한 번 돌리는데 두 번 돌아도
-- 줄이 늘지 않아야 한다 — 수집기는 이 제약을 믿고 upsert한다.
CREATE UNIQUE INDEX infra_costs_period_idx
  ON structured.infra_costs (provider, coalesce(resource, ''), period_start, period_end);

-- 화면은 「최근 것부터」로 읽는다.
CREATE INDEX infra_costs_recent_idx
  ON structured.infra_costs (period_end DESC, provider);

COMMENT ON TABLE structured.infra_costs IS
  '공급자가 청구한 인프라 요금. 하루 한 번 수집한다. AI 호출 비용(계산값)은 ai_usage에 따로 있다.';
COMMENT ON COLUMN structured.infra_costs.amount IS
  '공급자가 준 금액 그대로. 통화를 환산하지 않는다 — 환산은 보는 쪽에서 한다.';
COMMENT ON COLUMN structured.infra_costs.metrics IS
  '금액이 아닌 값(저장 용량 · 요청 수 등). 공급자마다 달라 열로 만들지 않는다.';
