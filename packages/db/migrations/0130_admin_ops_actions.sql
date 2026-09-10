-- 관리자 콘솔 «운영 · 시스템» 계열이 실제로 바꿀 상태.
--
-- 화면 여덟 개(자동화 상태 · 롤백 · 정책 규칙 · 약관 · 캠페인 · 광고 집행 ·
-- 광고 실운영 게이트 · 감사 기록)가 부르던 주소는 서버에 없었고, 단추는
-- `BACKEND_PENDING`으로 잠겨 있었다. 잠근 채로 만들지 않으면 「메뉴는 많은데
-- 되는 게 없다」가 된다(2026-09-10 대표).
--
-- **여기서 만드는 것은 상태뿐이다.** 화면이 이미 정한 계약(무엇을 보내고 무엇을
-- 받는지)을 서버가 따라가고, 서버 사정에 맞춰 화면을 고치지 않는다.
--
-- 지키는 것 셋:
--   * **되돌릴 수 없는 조작은 사유를 받는다.** 사유 없는 승인·실행이 스키마에서 막힌다.
--   * **롤백은 두 단계다.** 승인 없이 실행된 줄은 CHECK가 거부한다 — 관례가 아니라 제약이다.
--   * **광고 실운영은 승인과 전환이 다른 값이다.** 승인해도 켜지지 않는다(대표 오더 대기).

-- ---------------------------------------------------------------------------
-- 정책 규칙 (WP-ADM-051)
-- ---------------------------------------------------------------------------

/*
 * 값의 종류. 화면이 편집기를 고르는 데 쓴다.
 */
CREATE TYPE policy_value_kind AS ENUM ('number', 'percentage', 'boolean', 'string');

/*
 * 운영자가 고칠 수 있는 기준값.
 *
 * `structured.kill_switches`(0095)와 같은 생각으로 만든다 — **행이 자료가 아니라
 * 코드마다 붙는 고정 목록**이다. 그래서 id가 uuid가 아니라 사람이 읽는 text다.
 *
 * **여기 있는 여섯 줄은 전부 읽는 코드가 있다.** 0095가 `wired` 열을 만들어야 했던
 * 이유(껐다고 표시돼도 아무 일도 안 일어나는 스위치)를 이 표에서는 애초에 만들지
 * 않는다 — 읽는 코드가 생길 때 그 줄을 같이 넣는다.
 */
CREATE TABLE structured.policy_rules (
  id text PRIMARY KEY,
  /** 코드가 부르는 이름. id와 같지만 화면이 따로 보여준다. */
  key text NOT NULL UNIQUE,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  category text NOT NULL CHECK (length(btrim(category)) > 0),
  kind policy_value_kind NOT NULL,

  value text NOT NULL,
  /** 처음 값. 되돌릴 자리를 화면이 보여준다. */
  default_value text NOT NULL,

  last_changed_at timestamptz,
  last_changed_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,

  /** 이름 없는 변경을 막는다. 0033 `human_decision_names_the_person`과 같은 규칙이다. */
  CONSTRAINT policy_change_names_the_person
    CHECK ((last_changed_at IS NULL) = (last_changed_by IS NULL))
);

COMMENT ON TABLE structured.policy_rules IS
  '운영자가 고치는 기준값. 읽는 코드가 있는 줄만 넣는다 — 고쳐도 아무 일도 안 일어나는 값을 두지 않는다.';

INSERT INTO structured.policy_rules (id, key, label, description, category, kind, value, default_value) VALUES
  ('automation.success_rate_degraded', 'automation.success_rate_degraded',
   '자동화 저하 기준', '워크플로 성공률이 이 값 아래로 내려가면 «저하»로 표시합니다',
   '자동화', 'percentage', '0.95', '0.95'),
  ('automation.success_rate_down', 'automation.success_rate_down',
   '자동화 중단 기준', '워크플로 성공률이 이 값 아래로 내려가면 «중단»으로 표시합니다',
   '자동화', 'percentage', '0.80', '0.80'),
  ('automation.dlq_alert_size', 'automation.dlq_alert_size',
   'DLQ 경보 건수', '처리 실패가 이 건수를 넘으면 성공률과 무관하게 «저하»로 표시합니다',
   '자동화', 'number', '10', '10'),
  ('public_stage.stage1_min', 'public_stage.stage1_min',
   '1단계 공개 최소 건수', '업체 금액을 1단계로 공개하는 데 필요한 실 제보 건수',
   '공개 기준', 'number', '3', '3'),
  ('public_stage.stage2_min', 'public_stage.stage2_min',
   '2단계 공개 최소 건수', '업체 금액을 2단계로 공개하는 데 필요한 실 제보 건수',
   '공개 기준', 'number', '5', '5'),
  ('public_stage.stage3_min', 'public_stage.stage3_min',
   '3단계 공개 최소 건수', '업체 금액을 3단계로 공개하는 데 필요한 실 제보 건수',
   '공개 기준', 'number', '10', '10');

-- ---------------------------------------------------------------------------
-- 자동화 상태 (WP-ADM-040)
-- ---------------------------------------------------------------------------

/*
 * 워크플로 목록.
 *
 * 실행 횟수 · 성공률 · 재시도 · DLQ 크기는 여기 두지 않는다 — `structured.decisions`가
 * 이미 workflow · execution_status · retry_count를 줄마다 적고 있고, 그것을 세면
 * 나온다. 따로 세어 저장하면 두 숫자가 갈라지고, 갈라진 뒤에는 어느 쪽이 사실인지
 * 알 수 없다.
 */
CREATE TABLE structured.automation_workflows (
  /** `structured.decisions.workflow`와 같은 값. */
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) > 0),

  /** 실패한 줄을 사람이 누르지 않아도 되돌리는가. 아직 그런 코드는 없다. */
  self_heal_enabled boolean NOT NULL DEFAULT false,

  last_recovered_at timestamptz,
  last_recovered_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  last_drained_at timestamptz,
  last_drained_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,

  CONSTRAINT recovery_names_the_person
    CHECK ((last_recovered_at IS NULL) = (last_recovered_by IS NULL)),
  CONSTRAINT drain_names_the_person
    CHECK ((last_drained_at IS NULL) = (last_drained_by IS NULL))
);

COMMENT ON TABLE structured.automation_workflows IS
  '자동화 워크플로 목록. 실행 통계는 여기 없다 — structured.decisions를 세면 나온다.';

INSERT INTO structured.automation_workflows (id, name) VALUES
  ('rebuttal_review', '반론 심사'),
  ('review_objection', '후기 이의 처리'),
  ('review_report', '후기 신고 처리'),
  ('reward', '보상 지급'),
  ('vendor_claim', '업체 소유권 확인');

/*
 * Dead-letter queue를 비운 표시.
 *
 * 실패한 결정 줄을 지우지 않는다 — 감사 기록이다. 대신 「사람이 보고 넘어갔다」를
 * 적어 다음 DLQ 집계에서 빠지게 한다. 지우면 무엇이 실패했었는지가 같이 사라진다.
 */
ALTER TABLE structured.decisions
  ADD COLUMN dlq_drained_at timestamptz,
  ADD COLUMN dlq_drained_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT dlq_drain_names_the_person
    CHECK ((dlq_drained_at IS NULL) = (dlq_drained_by IS NULL));

COMMENT ON COLUMN structured.decisions.dlq_drained_at IS
  '실패한 줄을 사람이 확인하고 넘어간 시각. 줄을 지우는 대신 표시한다 — 지우면 감사 기록이 사라진다.';

CREATE INDEX decisions_dlq_idx ON structured.decisions (workflow)
  WHERE execution_status = 'failed' AND dlq_drained_at IS NULL;

/*
 * 시각만으로 자르는 질의가 새로 생겼다 — 롤백 화면이 「배포 시각 이후의 실패율」을
 * 줄마다 센다. 기존 색인은 전부 (workflow, …) · (event_id, …)로 앞이 막혀 있어
 * 그 구간에 쓰이지 않는다.
 */
CREATE INDEX decisions_created_idx ON structured.decisions (created_at DESC);

-- ---------------------------------------------------------------------------
-- 롤백 (WP-ADM-042)
-- ---------------------------------------------------------------------------

CREATE TYPE rollback_change_kind AS ENUM ('deploy', 'policy');

/*
 * 되돌릴 수 있는 변경 하나.
 *
 * **줄에 상태 기계를 저장하지 않는다.** 「이상 감지」는 저장된 값이 아니라
 * `structured.decisions`의 실패율을 배포 시각 이후로 세어 그때그때 판정한다 —
 * 저장하면 감지기와 표가 갈라지고, 갈라진 표는 아무도 믿지 않게 된다.
 *
 * 저장하는 것은 사람이 한 일뿐이다: 언제 무엇이 바뀌었고, 누가 승인했고, 누가 실행했는가.
 */
CREATE TABLE structured.rollback_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  kind rollback_change_kind NOT NULL,

  deployed_at timestamptz NOT NULL DEFAULT now(),
  deployed_by uuid NOT NULL REFERENCES structured.users (id) ON DELETE RESTRICT,

  /*
   * 정책 변경이면 무엇을 어디로 되돌리는가.
   *
   * 이 두 값이 있어야 실행이 실제로 무언가를 한다. 없으면 「롤백했다」고 적고
   * 아무것도 바뀌지 않는 줄이 된다.
   */
  policy_rule_id text REFERENCES structured.policy_rules (id) ON DELETE CASCADE,
  previous_value text,

  approved_at timestamptz,
  approved_by uuid REFERENCES structured.users (id) ON DELETE RESTRICT,
  approval_reason text,

  triggered_at timestamptz,
  triggered_by uuid REFERENCES structured.users (id) ON DELETE RESTRICT,
  trigger_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT approval_names_the_person
    CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  CONSTRAINT trigger_names_the_person
    CHECK ((triggered_at IS NULL) = (triggered_by IS NULL)),

  /*
   * 되돌릴 수 없는 조작은 사유를 받는다. `structured.decisions`가 reason_code를
   * NOT NULL로 둔 것과 같은 자리다.
   */
  CONSTRAINT approval_states_its_reason
    CHECK ((approved_at IS NULL) = (approval_reason IS NULL)),
  CONSTRAINT trigger_states_its_reason
    CHECK ((triggered_at IS NULL) = (trigger_reason IS NULL)),

  /*
   * **두 단계. 승인 없이 실행되는 길이 없다.**
   *
   * 라우트가 먼저 막지만 여기서도 막는다 — 라우트는 한 사람이 한 줄 고치면
   * 뚫리고, 그 한 줄은 리뷰에서 눈에 띄지 않는다. 롤백 실행은 사용자 화면이
   * 바로 바뀌는 조작이라 관례로 두지 않는다.
   */
  CONSTRAINT trigger_follows_approval
    CHECK (triggered_at IS NULL OR approved_at IS NOT NULL),
  CONSTRAINT trigger_is_not_before_approval
    CHECK (triggered_at IS NULL OR triggered_at >= approved_at),

  /** 정책 롤백은 무엇을 어디로 되돌리는지 알아야 한다. */
  CONSTRAINT policy_rollback_knows_what_to_restore
    CHECK (kind <> 'policy' OR (policy_rule_id IS NOT NULL AND previous_value IS NOT NULL))
);

COMMENT ON TABLE structured.rollback_targets IS
  '되돌릴 수 있는 변경. 승인과 실행이 두 단계이며 CHECK가 그것을 지킨다 — 한 번에 도는 길이 없다.';

CREATE INDEX rollback_targets_deployed_idx ON structured.rollback_targets (deployed_at DESC);

-- ---------------------------------------------------------------------------
-- 약관 · 방침 (WP-ADM-036)
-- ---------------------------------------------------------------------------

CREATE TYPE terms_doc_kind AS ENUM ('terms', 'privacy', 'marketing');

/*
 * 문서 한 판.
 *
 * 공개된 판은 고쳐 쓰지 않는다 — 사용자가 동의한 글이 나중에 바뀌면 무엇에
 * 동의했는지가 사라진다. 고치려면 새 초안을 만들고, 공개할 때 판이 하나 올라간다.
 */
CREATE TABLE structured.terms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc terms_doc_kind NOT NULL,
  version text NOT NULL CHECK (length(btrim(version)) > 0),

  published_at timestamptz,
  published_by uuid REFERENCES structured.users (id) ON DELETE RESTRICT,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (doc, version),
  CONSTRAINT publication_names_the_person
    CHECK ((published_at IS NULL) = (published_by IS NULL))
);

/*
 * 한 문서에 초안은 하나뿐.
 *
 * 둘이면 «초안 공개»가 어느 것을 공개하는지 알 수 없다. 화면이 초안을 하나만
 * 보여주므로 표에서도 하나만 있게 한다.
 */
CREATE UNIQUE INDEX terms_one_draft_per_doc
  ON structured.terms_versions (doc) WHERE published_at IS NULL;

COMMENT ON TABLE structured.terms_versions IS
  '약관·방침의 한 판. 공개된 판은 고쳐 쓰지 않는다 — 동의한 글이 나중에 바뀌면 무엇에 동의했는지가 사라진다.';

CREATE TABLE structured.terms_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES structured.terms_versions (id) ON DELETE CASCADE,
  article_number text NOT NULL CHECK (length(btrim(article_number)) > 0),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  position integer NOT NULL CHECK (position >= 0),

  UNIQUE (version_id, position)
);

CREATE INDEX terms_clauses_version_idx ON structured.terms_clauses (version_id, position);

/*
 * 공개된 판의 조문은 바뀌지 않는다.
 *
 * 라우트가 초안만 고치도록 돼 있지만 여기서도 막는다 — 스크립트 한 줄이나
 * 나중에 붙는 다른 라우트가 같은 실수를 반복할 수 있고, 그때는 이미 사용자가
 * 동의한 뒤다.
 */
CREATE FUNCTION structured.reject_published_clause_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target uuid := coalesce(NEW.version_id, OLD.version_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM structured.terms_versions
    WHERE id = target AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION '공개된 판의 조문은 고칠 수 없다. 새 초안을 만들어라.';
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER terms_clauses_are_frozen_once_published
  BEFORE INSERT OR UPDATE OR DELETE ON structured.terms_clauses
  FOR EACH ROW EXECUTE FUNCTION structured.reject_published_clause_write();

-- ---------------------------------------------------------------------------
-- 광고 집행 (WP-ADM-033)
-- ---------------------------------------------------------------------------

/*
 * 광고를 잠시 멈춘 표시.
 *
 * 기간(starts_on · ends_on)을 손대서 멈추지 않는다 — 그러면 돈이 오간 약속이
 * 바뀌어 버리고, 다시 켤 때 원래 기간이 무엇이었는지 알 수 없다.
 */
ALTER TABLE ads.placements
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN paused_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  ADD COLUMN pause_reason text,
  ADD CONSTRAINT pause_names_the_person
    CHECK ((paused_at IS NULL) = (paused_by IS NULL)),
  ADD CONSTRAINT pause_states_its_reason
    CHECK ((paused_at IS NULL) = (pause_reason IS NULL));

COMMENT ON COLUMN ads.placements.paused_at IS
  '잠시 멈춘 시각. 기간을 손대지 않는다 — 기간은 돈이 오간 약속이다.';

/*
 * 멈춘 광고는 오늘 유효한 광고가 아니다.
 *
 * 뷰를 고치지 않으면 화면에는 «일시정지»로 보이는데 사용자에게는 계속 보인다.
 */
CREATE OR REPLACE VIEW ads.active_placements AS
SELECT p.id, p.vendor_id, p.surface, p.tier, p.category, p.region
FROM ads.placements p
WHERE current_date BETWEEN p.starts_on AND p.ends_on
  AND p.paused_at IS NULL;

-- ---------------------------------------------------------------------------
-- 광고 실운영 전환 게이트 (WP-ADM-034)
-- ---------------------------------------------------------------------------

/*
 * 실운영 전환 게이트. 한 줄뿐이다.
 *
 * **승인과 전환이 다른 값이다.** 운영자가 «실운영 전환 확정»을 눌러도 `activated`는
 * 그대로 false다 — 이 PR에 그 값을 켜는 길이 없다. 광고 실운영 전환은 대표 오더
 * 대기 상태이고(`CLAUDE.md` 「진행 상태」), 승인 단추 하나가 그 오더를 대신하지
 * 않는다.
 *
 * 0043 `ads.launch_decisions`가 상품(tier)별 결정을 적는 표라면, 이쪽은 그 앞에
 * 있는 관문이다 — 관문이 열리기 전에는 어느 상품도 실운영으로 갈 수 없다.
 */
CREATE TABLE ads.production_gate (
  /** 한 줄만 있게 한다. */
  id boolean PRIMARY KEY DEFAULT true CHECK (id),

  approved_at timestamptz,
  approved_by uuid REFERENCES structured.users (id) ON DELETE RESTRICT,
  approval_reason text,

  /** 실제 전환. 기본값이 꺼짐이고 이 판에는 켜는 길이 없다. */
  activated boolean NOT NULL DEFAULT false,
  activated_at timestamptz,

  CONSTRAINT gate_approval_names_the_person
    CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  CONSTRAINT gate_approval_states_its_reason
    CHECK ((approved_at IS NULL) = (approval_reason IS NULL)),
  /** 승인 없이 켜지지 않는다. */
  CONSTRAINT activation_follows_approval
    CHECK (NOT activated OR approved_at IS NOT NULL),
  CONSTRAINT activation_records_when
    CHECK (activated = (activated_at IS NOT NULL))
);

COMMENT ON TABLE ads.production_gate IS
  '광고 실운영 전환 관문. 승인(approved_at)과 전환(activated)이 다른 값이다 — 승인해도 켜지지 않는다.';

INSERT INTO ads.production_gate (id) VALUES (true);
