-- 회원 활동 원장(1층)과 집계층(2층).
--
-- 대표 지시(2026-09-14) — 「변경된 RN기준으로 회원들의 모든 활동을 내가 확인할 수
-- 있어야 하며, DB에 정리하도록한다. 추후 데이터를 판매할 것이다.」
--
-- ---------------------------------------------------------------------------
-- 왜 두 층인가
-- ---------------------------------------------------------------------------
--
--   1층 structured.activity_events    사용자 id가 붙는다. 대표님이 보시는 자리
--   2층 structured.activity_rollups   사람을 못 알아본다. 파는 자리
--
-- 한 층으로 지으면 팔 수가 없다. 개인정보를 제3자에게 주려면 그 항목에 대한 별도
-- 동의가 있어야 하고(개인정보보호법 제17조), 가입할 때 받은 동의에는 없다. 반면
-- 익명정보는 개인정보가 아니라서(제58조의2) 동의 없이 거래할 수 있다.
--
-- 그래서 1층에서 2층을 뽑는 길을 처음부터 만든다. 나중에 얹으면 1층이 그 모양이
-- 아니어서 다시 짓게 된다 — 2층이 요구하는 것은 「자유 입력이 아닌 목록값」과
-- 「사람을 셀 수 있는 키」이고, 둘 다 나중에 만들 수 없다.
--
-- ---------------------------------------------------------------------------
-- 이미 있는 기록표와 겹치지 않는다
-- ---------------------------------------------------------------------------
--
-- 저장소에는 이미 다섯 개의 기록표가 있다. 지우지도 합치지도 않는다.
--
--   inquiry_events          문의 한 건의 상태가 어떻게 바뀌었는지(0009)
--   verification_events     인증 심사의 상태 변화(0011)
--   vendor_change_log       업체 필드가 무엇에서 무엇으로 바뀌었는지(0048)
--   review_objection_log    후기 이의를 운영자가 왜 그렇게 처리했는지(0110)
--   withdrawal_audit_log    탈퇴에 운영자가 개입한 전부(0058)
--
-- 저 다섯은 **특정 흐름의 상태 변화**를 담는다 — 주어가 문의·심사·업체·후기·운영자다.
-- 이 원장은 **사용자의 행동**을 담는다. 주어가 회원 한 사람이다. 같은 사건이 양쪽에
-- 남는 자리가 있지만(제보 제출), 묻는 질문이 다르다: 저쪽은 「그 제보가 어떻게 됐나」,
-- 이쪽은 「이 회원이 그날 무엇을 했나」.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1층 — 활동 원장
-- ═══════════════════════════════════════════════════════════════════════════

/*
 * 어느 자리에서 일어났는가. 2026-09-14 대표님 확정 IA의 탭 다섯을 그대로 쓴다
 * (docs/sync/master-status.json rnMigration20260914.IA확정).
 *
 *   홈 · 웨딩노트 · Pick(가운데) · 라운지 · MY
 *
 * **검색이 탭 목록에 없고 여기에는 있다.** 검색은 탭에서 내려와 홈 상단 검색바로
 * 들어가지만, 화면 자체는 살아 있고 전체화면으로 열린다. 원장이 담는 것은 「탭이
 * 무엇인가」가 아니라 「어느 자리에서 일어났는가」라서, 탭이 아닌 자리도 이름이
 * 있어야 한다. 검색이 탭으로 돌아와도(대표님 — 「차후에 탭으로 이관한다」) 이
 * 목록은 바뀌지 않는다.
 */
CREATE TYPE activity_surface AS ENUM (
  'home',
  'wedding_note',
  'pick',
  'lounge',
  'my',
  -- 탭이 아닌 자리들. 뒤로가기로 돌아갈 직전 맥락이 따로 있다.
  'search',
  'vendor',
  'onboarding',
  'report',
  'account'
);

COMMENT ON TYPE activity_surface IS
  '활동이 일어난 자리. 탭 다섯(2026-09-14 대표 확정)과 탭이 아닌 자리 다섯.';

/*
 * 무엇을 했는가. **한 줄은 한 사건이다** — 「세 곳을 봤다」는 세 줄이고,
 * 「비교하고 A를 골랐다」는 비교 한 줄과 Pick 한 줄이다.
 *
 * 비교 결과를 한 줄에 담지 않는 데는 이유가 있다. 「스튜디오 3곳 비교 후 A 선택」은
 * 그 자체로 사람이 좁혀지는 문장이고, 2층으로 접을 때 가장 위험한 축이 된다.
 * 비교는 `compare_started`로, 그 뒤의 선택은 `pick_added`로 각각 남는다 — 두 줄을
 * 시각으로 이으면 대표님은 같은 것을 보실 수 있고, 2층은 둘을 따로 센다.
 */
CREATE TYPE activity_event_name AS ENUM (
  -- 화면 진입.
  'screen_view',
  -- 검색바에 말을 넣고 실행했다.
  'search_submitted',
  -- 업종을 골랐다(검색 업종 격자 · 홈 준비 현황).
  'category_selected',
  'pick_added',
  'pick_removed',
  -- 비교를 시작했다. 몇 곳을 담았는지는 item_count.
  'compare_started',
  'vendor_viewed',
  -- 제보를 냈다.
  'report_submitted',
  -- 방문노트를 적었다. 적었다는 사실만이고 글은 담지 않는다.
  'visit_note_written',
  'onboarding_step',
  'withdrawal_requested'
);

COMMENT ON TYPE activity_event_name IS
  '원장이 받는 사건 열하나. 한 줄은 한 사건이고, 여러 사건을 묶어 세지 않는다.';

CREATE TABLE structured.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /*
   * **탈퇴하면 이 줄은 사라진다.**
   *
   * 파기 워커가 `structured.users` 행을 실제로 지우고(`withdrawal.ts`
   * attemptDeleteAccount), 그때 이 줄도 함께 지워진다. 행동 기록은 계정과 이어져
   * 있을 때만 뜻이 있는 값이라 연결만 끊어 남기지 않는다 — 시각과 업종과 지역이
   * 남은 줄은 계정 연결이 없어도 한 사람의 그날을 그린다.
   *
   * 방침 제18조가 「후기와 실 제보는 연결정보를 분리하여 유지될 수 있다」고 적은
   * 것과 다르게 가는 자리다. 후기는 남이 읽는 글이고 실 제보는 금액 통계의 근거라
   * 지우면 다른 사람의 화면이 바뀌지만, 원장은 그렇지 않다.
   *
   * **그래도 2층은 남는다.** 2층은 사람을 못 알아보는 묶음 수치라 개인정보가 아니고,
   * 이미 뽑혀 따로 저장돼 있다. 탈퇴 한 사람 때문에 지난달 집계가 흔들리지 않는다 —
   * 이것이 처음부터 두 층으로 지은 이유이기도 하다.
   */
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,

  event_name activity_event_name NOT NULL,
  surface activity_surface NOT NULL,

  /** 실제로 일어난 시각. */
  occurred_at timestamptz NOT NULL DEFAULT now(),
  /** 원장에 담긴 시각. 둘이 벌어지면 늦게 올라온 줄이다. */
  recorded_at timestamptz NOT NULL DEFAULT now(),

  /*
   * 무엇에 대한 사건인가. 없을 수도 있다(화면 진입).
   *
   * 외래키를 걸지 않는다 — 업체가 통합되거나(0120) 내려가도 그때 이 회원이 그것을
   * 봤다는 사실은 그대로다. `withdrawal_audit_log.account_id`와 같은 자리다.
   */
  target_kind text CHECK (target_kind IS NULL OR target_kind IN ('vendor', 'comparison', 'report', 'visit_note')),
  target_id uuid,

  /*
   * 접을 수 있는 값들. **2층이 쓸 축은 여기서부터 목록값이다.**
   *
   * 자유 입력을 그대로 두면 2층에서 접을 수가 없다 — 「서울」과 「서울시」와
   * 「서울특별시」가 세 줄이 되고, 어느 것도 최소 인원에 닿지 못해 통째로 빠진다.
   * 지역은 짧은 꼴 아홉(WEDDING_REGIONS)으로만 들어온다.
   */
  category vendor_category,
  region text CHECK (region IS NULL OR region IN ('서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '그 외')),
  budget_bracket wedding_budget_bracket,

  /*
   * 검색어 원문. **1층에만 있다.** 대표님이 「무엇을 찾는가」를 보셔야 하는 자리라
   * 원장에는 그대로 담고, 2층으로는 목록값으로 접어서만 올린다.
   */
  search_text text,

  /**
   * 그 한 사건이 몇 곳을 담았는가(비교 3곳). **여러 사건을 센 값이 아니다.**
   * 모르면 NULL이다 — 0으로 적지 않는다(ai-router.ts의 `unlimited` 규칙과 같다).
   */
  item_count integer CHECK (item_count IS NULL OR item_count > 0),

  /** 온보딩 몇 번째 단계인가. 1부터. */
  step smallint CHECK (step IS NULL OR step > 0),

  /*
   * 같은 사건이 두 줄이 되지 않게. 앱이 못 보내고 다시 보내도 한 줄이다.
   * 서버가 스스로 적는 줄은 서버가 만든 값을 넣는다.
   */
  client_event_id uuid NOT NULL,

  /*
   * 정정 줄. **원장은 고치지 않는다** — 틀린 줄은 그대로 두고 뒤에 이 줄을 붙인다.
   * 아래 복합 외래키가 「같은 사람의 줄만 정정할 수 있다」를 강제한다.
   */
  corrects_event_id uuid,

  -- 검색어는 검색에만 붙는다. 다른 사건에 글이 실리면 그것은 메모다.
  CONSTRAINT activity_search_text_only_on_search
    CHECK (search_text IS NULL OR event_name = 'search_submitted'),
  CONSTRAINT activity_search_text_not_blank
    CHECK (search_text IS NULL OR length(btrim(search_text)) > 0),

  /*
   * **민감한 값을 원장에 넣지 않는다.** `reward_payouts`의 휴대폰 CHECK가 본보기다 —
   * 「넣지 말자」는 약속이 아니라 스키마가 막는다.
   *
   * 검색어는 사람이 직접 치는 자리라 무엇이든 들어올 수 있다. 전화번호꼴과
   * 카드번호꼴을 거절한다. 거절이 곧 손실이지만, 받아두고 나중에 지우는 것보다
   * 애초에 담기지 않는 편이 낫다.
   */
  CONSTRAINT activity_search_text_has_no_phone
    CHECK (search_text IS NULL OR search_text !~ '0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{4}'),
  CONSTRAINT activity_search_text_has_no_card
    CHECK (search_text IS NULL OR search_text !~ '[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}'),

  CONSTRAINT activity_target_is_complete
    CHECK ((target_kind IS NULL) = (target_id IS NULL)),

  CONSTRAINT activity_step_only_on_onboarding
    CHECK (step IS NULL OR event_name = 'onboarding_step'),

  CONSTRAINT activity_item_count_only_on_compare
    CHECK (item_count IS NULL OR event_name = 'compare_started'),

  -- 정정 줄이 자기를 가리키면 이력이 끊긴다.
  CONSTRAINT activity_correction_is_not_self
    CHECK (corrects_event_id IS NULL OR corrects_event_id <> id),

  UNIQUE (user_id, client_event_id),
  -- 아래 복합 외래키가 걸릴 자리. 같은 사람의 줄만 정정할 수 있게 한다.
  UNIQUE (id, user_id)
);

ALTER TABLE structured.activity_events
  ADD CONSTRAINT activity_correction_stays_with_one_person
  FOREIGN KEY (corrects_event_id, user_id)
  REFERENCES structured.activity_events (id, user_id);

COMMENT ON TABLE structured.activity_events IS
  '회원 활동 원장(1층). append-only — 고치지도 지우지도 않고, 틀린 줄은 뒤에 정정 줄을 붙인다. 탈퇴로 계정이 파기되면 CASCADE로 함께 사라지고 2층 집계만 남는다.';

COMMENT ON COLUMN structured.activity_events.search_text IS
  '검색어 원문. 1층에만 있다 — 2층은 목록값으로 접어서만 받는다. 전화번호꼴·카드번호꼴은 CHECK가 막는다.';

COMMENT ON COLUMN structured.activity_events.item_count IS
  '그 한 사건이 담은 곳의 수(비교 3곳). 여러 사건을 센 값이 아니다. 모르면 NULL — 0이 아니다.';

COMMENT ON COLUMN structured.activity_events.corrects_event_id IS
  '정정 대상. 원장은 고치지 않으므로 틀린 줄은 남고 이 줄이 뒤에 붙는다.';

-- ---------------------------------------------------------------------------
-- append-only — 약속이 아니라 스키마가 막는다
-- ---------------------------------------------------------------------------
--
-- 고칠 수 없는 기록이라고 적어두기만 하면 언젠가 누가 고친다. 특히 「한 줄만
-- 바로잡으면 되는데」 하는 순간에.
--
-- **지우기는 딱 한 자리만 연다: 그 회원의 계정이 이미 사라졌을 때.** 파기는 부모
-- 행을 먼저 지우고 CASCADE가 뒤따르므로, 이 트리거가 볼 때 `users`에 그 사람은
-- 없다. 반대로 살아 있는 회원의 줄을 누가 지우려 하면 부모가 그대로 있어 막힌다.

CREATE FUNCTION structured.activity_events_stay_put()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION '활동 원장은 고치지 않는다. 정정은 corrects_event_id를 단 새 줄로 남긴다.';
  END IF;

  IF EXISTS (SELECT 1 FROM structured.users WHERE id = OLD.user_id) THEN
    RAISE EXCEPTION '활동 원장은 지우지 않는다. 계정 파기로만 함께 사라진다.';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER activity_events_append_only
  BEFORE UPDATE OR DELETE ON structured.activity_events
  FOR EACH ROW
  EXECUTE FUNCTION structured.activity_events_stay_put();

-- ---------------------------------------------------------------------------
-- 색인 — 쓰는 비용이 화면을 느리게 하면 안 된다
-- ---------------------------------------------------------------------------
--
-- 색인 하나가 늘 때마다 INSERT가 느려진다. 세 개로 끝낸다.
--
--   한 사람의 하루      대표님이 회원 하나를 여실 때
--   최근 전체           관리자 첫 화면
--   사건별              2층을 뽑을 때
--
-- 고유 제약 `(user_id, client_event_id)`가 이미 색인이라 「한 사람의 하루」와 앞이
-- 겹치지만, 정렬 축이 달라 그 색인으로는 시각 순 조회를 못 받는다.

CREATE INDEX activity_events_user_idx
  ON structured.activity_events (user_id, occurred_at DESC);

CREATE INDEX activity_events_recent_idx
  ON structured.activity_events (occurred_at DESC);

CREATE INDEX activity_events_rollup_idx
  ON structured.activity_events (event_name, occurred_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2층 — 집계층
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **사람 단위 행이 없다.** 한 행은 한 묶음이고, 그 묶음에 몇 사람이 들었는지를
-- 함께 적는다.
--
-- 이 저장소에는 이미 같은 성격의 자리가 있다 — 실 제보의 구간과 기준금액이다
-- (packages/domain/src/disclosure.ts). 개별 제보를 내보내지 않고 구간만 내보내며,
-- 몇 건부터 무엇을 열지 사다리 하나로 정해 화면마다 다시 정하지 않는다. 2층도
-- 같은 결이다.

/*
 * ── 최소 인원 기준 ─────────────────────────────────────────────────────────
 *
 * **10명이다.** 한 묶음에 서로 다른 회원이 열 명 미만이면 행 자체를 내보내지 않는다.
 *
 * 근거 넷.
 *
 * 1. **저장소가 이미 정한 수다.** `DISCLOSURE_THRESHOLDS.detailed = 10` — 실 제보의
 *    기준금액을 밖으로 낼 수 있는 문턱이 10이다. 같은 성격의 판단(한 사람의 값이
 *    숫자로 드러나는가)에 문턱을 둘로 두지 않는다.
 *
 * 2. **축이 늘면 좁혀지는 정도가 다르다.** 3은 한 업체·한 축(금액)에 대한 구간
 *    문턱이다. 2층은 기간·자리·업종·지역·예산을 겹친다. 같은 인원이라도 겹친 축이
 *    많을수록 한 사람이 특정되기 쉽다. 그래서 문턱을 올리고, 겹치는 축의 수 자체도
 *    아래 CHECK로 둘까지만 허용한다.
 *
 * 3. **되돌릴 수 없는 쪽이다.** 3과 5는 앱 안에서 보이는 값이라 잘못 잡으면 내리면
 *    된다. 2층은 계약으로 밖에 나가고, 나간 뒤에는 지울 수 없다.
 *
 * 4. **가명정보의 예시값을 그대로 쓰지 않는다.** 개인정보보호위원회 가이드라인이
 *    k-익명성 예시로 드는 3 이상은 가명정보(안에서 결합·분석)의 이야기다. 익명정보로
 *    밖에 내보내는 자리는 그보다 높게 잡는 것이 실무다.
 *
 * **이 수는 CHECK로 박아 둔다.** 뽑는 코드가 언젠가 잘못 세도 작은 묶음은 들어오지
 * 못한다. 도메인 쪽 `ACTIVITY_MIN_SUBJECTS`와 같은 값이어야 하고, 그것이 어긋나면
 * 시험이 잡는다(apps/api/src/test/activity-ledger.test.ts).
 */
CREATE TABLE structured.activity_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /** 묶는 기간의 시작. 주 단위는 월요일이다. */
  period_start date NOT NULL,
  /** 7(주) 또는 28(4주). 달은 28·30·31이 섞여 묶음 크기가 달라진다. */
  period_days smallint NOT NULL CHECK (period_days IN (7, 28)),

  event_name activity_event_name NOT NULL,
  surface activity_surface NOT NULL,

  /*
   * 접은 축. **NULL은 「모른다」가 아니라 「이 칸으로 가르지 않았다」는 뜻이다.**
   * 셋 다 NULL이면 그 사건의 전체 묶음이다.
   */
  region text CHECK (region IS NULL OR region IN ('서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '그 외')),
  category vendor_category,
  budget_bracket wedding_budget_bracket,

  /** 그 묶음에 든 서로 다른 회원의 수. 사람 수지 사건 수가 아니다. */
  subject_count integer NOT NULL,
  /** 그 묶음의 사건 수. 사람 수보다 작을 수 없다. */
  event_count integer NOT NULL,

  /** 어느 기준으로 접었는가. 「이게 정말 익명인가」를 다시 따질 때의 근거다. */
  fold_rule text NOT NULL CHECK (length(btrim(fold_rule)) > 0),
  /** 이 행을 넣을 때 적용한 최소 인원. 기준이 바뀌면 옛 행과 구분된다. */
  k_threshold smallint NOT NULL,

  built_at timestamptz NOT NULL DEFAULT now(),

  /*
   * **최소 인원 미만은 들어오지 못한다.** 뽑는 쪽이 잘못 세도 여기서 막힌다.
   * 숫자 10은 packages/domain의 `ACTIVITY_MIN_SUBJECTS`와 같은 값이다.
   */
  CONSTRAINT rollup_meets_minimum_subjects CHECK (subject_count >= 10),
  CONSTRAINT rollup_threshold_meets_minimum CHECK (k_threshold >= 10),
  CONSTRAINT rollup_events_cover_subjects CHECK (event_count >= subject_count),

  /*
   * **겹치는 축은 둘까지다.** 지역·업종·예산을 셋 다 채우면 열 명이 들어도
   * 「서울 · 스튜디오 · 3천만원대」가 되고, 그 셋에 기간과 자리까지 붙으면 한 줄로
   * 사람이 그려진다. 지시서가 재식별의 예로 든 문장이 정확히 그 모양이다.
   */
  CONSTRAINT rollup_axis_width_is_bounded CHECK (
    (CASE WHEN region IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN category IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN budget_bracket IS NULL THEN 0 ELSE 1 END) <= 2
  ),

  /*
   * **`NULLS NOT DISTINCT`다.** 기본값(`NULLS DISTINCT`)이면 NULL이 든 열쇠는 서로
   * 다른 것으로 쳐서 같은 묶음이 뽑을 때마다 한 줄씩 늘어난다 — 축을 안 쓴 묶음은
   * 셋 다 NULL이라 거의 모든 행이 그 꼴이다.
   */
  UNIQUE NULLS NOT DISTINCT (period_start, period_days, event_name, surface, region, category, budget_bracket)
);

COMMENT ON TABLE structured.activity_rollups IS
  '활동 집계층(2층). 사람 단위 행이 없다 — 한 행은 한 묶음이고 최소 인원(10) 미만인 묶음은 행 자체가 들어오지 않는다. 밖으로 내보내는 것은 이 표뿐이다.';

COMMENT ON COLUMN structured.activity_rollups.subject_count IS
  '그 묶음에 든 서로 다른 회원 수. 10 미만은 CHECK가 막는다.';

COMMENT ON COLUMN structured.activity_rollups.fold_rule IS
  '자유 입력을 어느 목록값으로 접었는지. 나중에 익명성을 다시 따질 때의 근거다.';

COMMENT ON COLUMN structured.activity_rollups.region IS
  'NULL은 모른다가 아니라 이 칸으로 가르지 않았다는 뜻이다.';

/*
 * 뽑은 이력. 같은 주를 다시 뽑으면 행은 덮이지만(UNIQUE), 언제 어느 범위를 훑었고
 * 최소 인원에 못 미쳐 **몇 묶음이 빠졌는지**는 남아야 한다.
 *
 * 빠진 수를 세는 이유는 그것이 곧 「기준이 적당한가」의 답이기 때문이다. 열에
 * 아홉이 빠지면 기준이 너무 높거나 축을 너무 잘게 갈랐다는 뜻이고, 하나도 안
 * 빠지면 기준이 놀고 있다는 뜻이다.
 */
CREATE TABLE structured.activity_rollup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_days smallint NOT NULL CHECK (period_days IN (7, 28)),
  k_threshold smallint NOT NULL,
  fold_rule text NOT NULL,
  /** 이 실행이 써 넣은 묶음 수. */
  rows_written integer NOT NULL CHECK (rows_written >= 0),
  /** 최소 인원에 못 미쳐 내보내지 않은 묶음 수. */
  rows_suppressed integer NOT NULL CHECK (rows_suppressed >= 0),
  built_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_rollup_runs_period_idx
  ON structured.activity_rollup_runs (period_start DESC, built_at DESC);

COMMENT ON TABLE structured.activity_rollup_runs IS
  '2층을 뽑은 이력. 내보낸 묶음 수와 최소 인원에 못 미쳐 뺀 묶음 수를 함께 남긴다 — 뺀 수가 기준이 적당한지를 말해준다.';
