-- 자동 의사결정 기록. 최종통합정책 v2.0 L장.
--
-- v2.0은 사람이 반복 처리하는 구조를 만들지 말라고 하면서(A-2·M장), 대신
-- **자동으로 내린 결정마다 근거를 남기라고** 한다. 둘은 한 쌍이다 — 기록 없는
-- 자동화는 감독할 수 없고, 감독할 수 없는 자동화는 사람이 없는 것이 아니라
-- 사람이 눈을 감은 것이다.
--
-- 이 표가 답해야 하는 질문: 누가·무엇으로·얼마나 확신하고·왜 그렇게 정했는가.

/*
 * 근거가 가리키기만 하는지. CHECK 안에서는 부속질의를 쓸 수 없어 함수로 뺀다.
 *
 * `[{"kind": "...", "id": "..."}]` 꼴만 통과한다. 키가 둘뿐이라 값을 적을 자리가
 * 없고, 그래서 카드번호도 이름도 이 로그에 복사될 수 없다.
 */
CREATE FUNCTION structured.refs_only_point(refs jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(refs) = 'array'
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(refs) AS ref
       WHERE jsonb_typeof(ref.value) <> 'object'
          OR NOT (ref.value ?& array['kind', 'id'])
          OR (SELECT count(*) FROM jsonb_object_keys(ref.value)) <> 2
     );
$$;

-- 누가 정했는가. 사람도 여기 들어온다 — 사람 결정과 자동 결정을 한 표에 두면
-- "이 건은 누가 봤나"를 한 번의 질의로 답할 수 있다.
CREATE TYPE decider_kind AS ENUM ('rule', 'model', 'human');

CREATE TYPE decision_execution AS ENUM ('succeeded', 'failed', 'rolled_back', 'pending');

CREATE TABLE structured.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /*
   * 같은 사건. 한 결제인증이 OCR → 마스킹 → 업체매칭 → 중복탐지를 거치면 네
   * 줄이 남는데, 그 넷이 한 사건이라는 것을 이 값이 말한다(B-3).
   */
  event_id uuid NOT NULL,
  workflow text NOT NULL CHECK (length(btrim(workflow)) > 0),
  step text NOT NULL CHECK (length(btrim(step)) > 0),

  -- 무엇에 대한 결정인가. 'rebuttal' / 'review_report' / 'payment_proof' …
  subject_kind text NOT NULL CHECK (length(btrim(subject_kind)) > 0),
  subject_id uuid,

  decider decider_kind NOT NULL,
  -- 사람이 정했으면 누구인지. 스키마가 이름 없는 사람 결정을 막는다.
  actor_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  -- 규칙이 정했으면 어느 판인지. 규칙이 바뀌면 과거 결정을 다시 읽을 수 있어야 한다.
  rule_version text,
  -- 모델이 정했으면 어느 모델인지.
  model text,
  /*
   * 얼마나 확신했는가. 0~1.
   *
   * B-2가 "모든 AI 판단에는 confidence와 판단근거를 기록한다"고 정했다. 낮은
   * confidence를 곧바로 사람에게 보내지는 않지만, 남기지 않으면 나중에 어느
   * 구간에서 틀리는지 알 수 없다.
   */
  confidence numeric(4, 3) CHECK (confidence >= 0 AND confidence <= 1),

  decision text NOT NULL CHECK (length(btrim(decision)) > 0),
  -- 왜. 사람이 읽는 문장이 아니라 세는 코드다 — 같은 이유가 몇 번 났는지 알려면.
  reason_code text NOT NULL CHECK (length(btrim(reason_code)) > 0),

  /*
   * 무엇을 보고 정했는가. **가리키기만 한다.**
   *
   * `[{"kind": "payment_proof", "id": "..."}]` 꼴만 허용한다. 값을 적을 자리가
   * 없으므로 카드번호도 이름도 이 로그에 복사될 수 없다 — L장 마지막 줄이
   * "개인정보는 이 로그에 불필요하게 복제하지 않는다"고 적었고, 그걸 관례가
   * 아니라 제약으로 지킨다.
   */
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 외부 자료를 봤으면 어디서 언제. C-6 Data Lineage.
  source text,
  source_checked_at timestamptz,

  -- 어느 정책으로 정했는가. 정책이 바뀌면 과거 결정의 근거가 달라진다(C-7).
  policy_version text NOT NULL CHECK (length(btrim(policy_version)) > 0),

  cost_usd numeric(12, 6) CHECK (cost_usd IS NULL OR cost_usd >= 0),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),

  execution_status decision_execution NOT NULL DEFAULT 'succeeded',
  -- 되돌린 결정. B-6 자동 롤백이 이걸 따라간다.
  rollback_target uuid REFERENCES structured.decisions (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  /*
   * 결정 주체가 자기를 밝힌다.
   *
   * 이름 없는 사람 결정, 판 없는 규칙 결정, 확신 없는 모델 결정을 모두 막는다.
   * 0032의 반론 제약과 같은 생각이다 — 각 가지가 한 가지만 지킨다.
   */
  CONSTRAINT human_decision_names_the_person
    CHECK (decider <> 'human' OR actor_user_id IS NOT NULL),
  CONSTRAINT rule_decision_names_its_version
    CHECK (decider <> 'rule' OR rule_version IS NOT NULL),
  CONSTRAINT model_decision_names_its_model
    CHECK (decider <> 'model' OR (model IS NOT NULL AND confidence IS NOT NULL)),

  -- 근거는 가리키기만 한다. 값이 들어올 자리가 없다.
  CONSTRAINT evidence_refs_only_point CHECK (structured.refs_only_point(evidence_refs))
);

CREATE INDEX decisions_event_idx ON structured.decisions (event_id, created_at);
CREATE INDEX decisions_subject_idx ON structured.decisions (subject_kind, subject_id, created_at DESC);
CREATE INDEX decisions_workflow_idx ON structured.decisions (workflow, created_at DESC);

-- 실패한 것만 빠르게 훑는다. B-4의 Dead-letter Queue가 이걸 본다.
CREATE INDEX decisions_failed_idx ON structured.decisions (workflow, created_at DESC)
  WHERE execution_status IN ('failed', 'pending');

COMMENT ON TABLE structured.decisions IS
  '자동·수동 의사결정 기록. v2.0 L장. 기록 없는 자동화는 감독할 수 없다.';
COMMENT ON COLUMN structured.decisions.evidence_refs IS
  '근거를 가리키기만 한다. {kind, id} 외의 키가 들어올 수 없어 개인정보 값이 복사될 자리가 없다.';

/*
 * 사람 손이 필요한 것만 모은다. H장의 "진짜 확인 필요".
 *
 * 관리자가 큐를 뒤지지 않게 하는 것이 목표이므로(A-2), **이 뷰가 비어 있는 것이
 * 정상이다.** 뷰로 두는 이유는 조건을 화면마다 다시 적지 않기 위해서다.
 */
CREATE VIEW structured.open_decisions AS
SELECT d.*
FROM structured.decisions d
WHERE d.execution_status IN ('failed', 'pending');

COMMENT ON VIEW structured.open_decisions IS
  '아직 끝나지 않았거나 실패한 결정. 이 뷰가 비어 있는 것이 정상이다.';
