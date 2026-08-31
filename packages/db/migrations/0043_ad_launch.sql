-- 광고 실운영 전환 절차. 정책 원칙(2026-08-31).
--
--   테스트 전체 오픈 → 데이터 축적 → GPT 독립 분석 → Claude 독립 분석
--   → 각각 보고서 제출 → 사용자 최종 결정 → 실운영 오픈
--
-- 이 표들이 지켜야 하는 것 셋:
--   * **AI가 스위치를 올릴 수 없다.** 실운영 결정에는 사람 이름이 남아야 한다.
--   * 두 분석을 임의로 합치지 않는다. 서로 다른 결론이 그대로 남는다.
--   * 테스트 종료일을 미리 박지 않는다. 그래서 그런 열이 없다.

/*
 * 상품이 지금 어디에 있는가.
 *
 * `test`가 기본이다 — 지금은 테스트 전체 오픈 단계이고, 아무것도 안 정한 상품이
 * 실운영으로 시작하면 안 된다.
 */
CREATE TYPE ad_launch_state AS ENUM ('test', 'live', 'withheld', 'retired');

/*
 * 분석 보고서. GPT와 Claude가 각각 낸다.
 *
 * 기본키가 (등급, 분석자)라 **한 분석자는 상품마다 하나**를 내고, 남의 보고서를
 * 덮어쓸 수 없다. 둘의 결론이 달라도 합치지 않는다 — 합치는 순간 어느 쪽이
 * 무엇을 봤는지 사라지고, 사용자가 결정할 재료가 없어진다.
 */
CREATE TYPE ad_analyst AS ENUM ('gpt', 'claude');
CREATE TYPE ad_verdict AS ENUM ('open', 'hold', 'retire');

CREATE TABLE ads.launch_reports (
  tier ad_tier NOT NULL,
  analyst ad_analyst NOT NULL,

  verdict ad_verdict NOT NULL,
  /** 권장 오픈 시점. 지금은 아니라고 보면 NULL. */
  recommended_on date,

  /*
   * 무엇을 보고 그렇게 판정했는가. 정책이 항목을 정했다 — 노출·클릭·CTR·Pick
   * 전환·이탈 영향·광고주 수요·예상 매출과 운영비·추천 독립성 훼손 여부·UX 위험.
   *
   * 항목을 열로 박지 않는 이유는 분석자마다 재는 방식이 다르기 때문이다. 다만
   * **근거 없는 판정은 받지 않는다.**
   */
  findings jsonb NOT NULL,

  submitted_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tier, analyst),

  CONSTRAINT report_has_findings CHECK (jsonb_typeof(findings) = 'object' AND findings <> '{}'::jsonb),
  /** 열자고 하면서 언제인지 말하지 않을 수 없다. */
  CONSTRAINT open_verdict_names_a_date
    CHECK ((verdict = 'open') = (recommended_on IS NOT NULL))
);

COMMENT ON TABLE ads.launch_reports IS
  'GPT·Claude가 각각 낸 광고 상품 분석. 서로 다른 결론을 합치지 않는다 — 합치면 사용자가 결정할 재료가 사라진다.';

/*
 * 실운영 결정.
 *
 * **decided_by가 NOT NULL이다.** 이것이 "AI가 멋대로 광고 스위치를 올리는 일
 * 금지"를 표현하는 방법이다 — 사람 이름 없이 live가 될 수 없다. 관례로 두면
 * 언젠가 자동화가 한 줄 넣는다.
 *
 * 테스트 종료일 열이 없는 것도 정책이다. 날짜를 박아두면 자료가 모자라도 그날이
 * 되면 결정하게 되고, 그건 자료를 보고 정하는 것이 아니다.
 */
CREATE TABLE ads.launch_decisions (
  tier ad_tier PRIMARY KEY,
  state ad_launch_state NOT NULL,

  decided_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid NOT NULL REFERENCES structured.users (id) ON DELETE RESTRICT,
  note text,

  -- test는 결정이 아니라 시작 상태다. 결정 표에 test를 적을 일이 없다.
  CONSTRAINT decision_is_not_test CHECK (state <> 'test')
);

COMMENT ON TABLE ads.launch_decisions IS
  '광고 상품 실운영 결정. decided_by가 NOT NULL이라 사람 없이 실운영이 될 수 없다.';

/*
 * 상품별 현재 상태. 결정이 없으면 테스트다.
 *
 * 저장하지 않고 계산한다 — 결정이 바뀌면 따라 바뀌어야 하는 값이다.
 */
CREATE VIEW ads.tier_state AS
SELECT t.tier,
       coalesce(d.state, 'test'::ad_launch_state) AS state,
       d.decided_at,
       d.decided_by
FROM unnest(enum_range(NULL::ad_tier)) AS t (tier)
LEFT JOIN ads.launch_decisions d ON d.tier = t.tier;

COMMENT ON VIEW ads.tier_state IS
  '광고 상품의 현재 상태. 결정이 없으면 테스트다 — 아무것도 안 정한 상품이 실운영으로 시작하지 않는다.';
