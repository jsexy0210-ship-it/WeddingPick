-- 4개 미션 완료 추적 + 월간 웨딩지원금 추첨.
--
-- 정책 I-4 (통합정책 v3.13):
--   4개 미션(업체 탐색·준비 관리·배우자 연결·결제 비교)을 모두 완료한 사용자를
--   매월 말 자동 응모 처리하고, 2명을 추첨해 NPay 5만원씩 지급한다.
--   룰렛·게임형 연출 없음 — 조용한 자동 응모다.
--
-- 화면 상태: 응모 전 → 응모 완료 → 발표 대기 → 당첨 / 미당첨
--
-- 지급 추적:
--   0039 reward_grants의 reward_kind ENUM에 monthly_draw 추가.
--   npay_deliveries: 지급 시도 회수·상태·재발송 이력을 건별로 남긴다.

-- ---------------------------------------------------------------------------
-- 미션 완료 기록
-- ---------------------------------------------------------------------------
--
-- 미션 4개가 각각 언제 완료됐는지 남긴다.
-- 앱이 각 미션의 완료 조건(다른 테이블)을 확인한 뒤 여기에 쓴다.
-- 재완료는 없다 — PK가 (user_id, mission)이므로 한 번만 기록된다.

CREATE TYPE mission_key AS ENUM (
  'vendor_explore',   -- 업체 탐색
  'preparation',      -- 준비 관리
  'spouse_connect',   -- 배우자 연결
  'payment_compare'   -- 결제 비교
);

CREATE TABLE structured.mission_completions (
  user_id      uuid        NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  mission      mission_key NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission)
);

COMMENT ON TABLE structured.mission_completions IS
  '4개 미션 각각의 완료 기록. 한 사람의 한 미션은 한 번만 기록한다 — 재완료 없음.';

-- 4개 미션을 모두 끝낸 사용자. 자동 응모 대상자 조회에 쓴다.
-- all_done_at은 마지막 미션을 완료한 시각.
CREATE VIEW structured.missions_all_done AS
SELECT
  user_id,
  max(completed_at) AS all_done_at
FROM structured.mission_completions
GROUP BY user_id
HAVING count(*) = 4;

COMMENT ON VIEW structured.missions_all_done IS
  '4개 미션을 모두 완료한 사용자. all_done_at은 마지막 미션 완료 시각.';

-- ---------------------------------------------------------------------------
-- 월간 추첨 회차
-- ---------------------------------------------------------------------------
--
-- 매월 1회 추첨. draw_month는 해당 월의 1일로 저장한다.
-- 구조 확정값(I-4): winner_count=2, amount_per_winner_krw=50000, budget_krw=100000.
-- 정책 변경 없이 값을 임의로 바꾸지 않는다.

CREATE TABLE structured.monthly_draws (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_month            date        NOT NULL UNIQUE
                                      CHECK (extract(day FROM draw_month) = 1),
  winner_count          int         NOT NULL DEFAULT 2    CHECK (winner_count > 0),
  amount_per_winner_krw int         NOT NULL DEFAULT 50000 CHECK (amount_per_winner_krw > 0),
  budget_krw            int         NOT NULL DEFAULT 100000 CHECK (budget_krw > 0),
  -- 추첨 실행 시각. NULL이면 아직 추첨 전.
  drawn_at              timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- 예산이 당첨금 합계를 커버해야 한다.
  CONSTRAINT draw_budget_covers_winners
    CHECK (budget_krw >= winner_count * amount_per_winner_krw)
);

COMMENT ON TABLE structured.monthly_draws IS
  '월간 웨딩지원금 추첨 회차. draw_month는 해당 월 1일 저장. drawn_at이 NULL이면 추첨 전.';
COMMENT ON COLUMN structured.monthly_draws.draw_month IS
  '해당 월의 1일(예: 2026-09-01). 월별로 유일하다.';

-- ---------------------------------------------------------------------------
-- 응모 기록
-- ---------------------------------------------------------------------------
--
-- 4개 미션을 완료한 순간 앱이 해당 월 draw에 자동 등록한다.
-- 추첨 직전 어뷰징 최종 검증이 한 번 더 일어나고, flagged면 추첨에서 제외한다.

CREATE TYPE draw_abuse_status AS ENUM (
  'pending',   -- 추첨 전, 아직 검증 안 됨
  'passed',    -- 검증 통과 — 추첨 대상
  'flagged'    -- 어뷰징 의심 — 추첨 제외
);

CREATE TABLE structured.draw_entries (
  id             uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id        uuid              NOT NULL REFERENCES structured.monthly_draws (id) ON DELETE CASCADE,
  user_id        uuid              NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  entered_at     timestamptz       NOT NULL DEFAULT now(),
  abuse_status   draw_abuse_status NOT NULL DEFAULT 'pending',

  -- 같은 사람이 같은 월에 두 번 응모할 수 없다.
  UNIQUE (draw_id, user_id)
);

CREATE INDEX draw_entries_draw_idx ON structured.draw_entries (draw_id, abuse_status);

COMMENT ON TABLE structured.draw_entries IS
  '월간 추첨 응모 기록. 4개 미션 완료 시 자동 등록. abuse_status=flagged면 추첨 제외.';

-- ---------------------------------------------------------------------------
-- 추첨 결과
-- ---------------------------------------------------------------------------
--
-- 응모자 전원에게 결과 행이 생긴다 — 당첨·미당첨 모두.
-- winner는 reward_grants(monthly_draw kind)를 통해 NPay 수령 절차로 연결된다.

CREATE TYPE draw_result AS ENUM ('winner', 'not_winner');

CREATE TABLE structured.draw_results (
  id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid        NOT NULL UNIQUE REFERENCES structured.draw_entries (id) ON DELETE CASCADE,
  result   draw_result NOT NULL,
  drawn_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.draw_results IS
  '추첨 결과. 응모자 전원에게 행이 생긴다. winner는 NPay 수령 절차로 연결된다.';

-- ---------------------------------------------------------------------------
-- reward_grants에 monthly_draw 추가 (0039 확장) — 1/2
-- ---------------------------------------------------------------------------
--
-- reward_grants에 mission_draw_entry_id 컬럼 추가. `reward_kind` ENUM에
-- 'monthly_draw'를 더하는 것과 그 값을 쓰는 CHECK 제약은 별도 마이그레이션
-- (0053)으로 미룬다 — Postgres는 `ALTER TYPE ... ADD VALUE`로 더한 값을
-- **같은 트랜잭션 안에서** 바로 쓰지 못하게 막는다("unsafe use of new
-- value"). 한 파일이 트랜잭션 하나이므로(`migrate.ts`), 여기서 더하고
-- 여기서 쓰면 이 마이그레이션 자체가 항상 실패한다.
--
-- **컬럼 이름이 `draw_entry_id`가 아니라 `mission_draw_entry_id`인 이유**:
-- main에 별도 세션이 먼저 병합한 `0047_monthly_draw.sql`이 같은 이름의
-- 컬럼(`reward_grants.draw_entry_id`, `structured.monthly_draw_entries`를
-- 가리킴)을 이미 추가했고 `grant_has_exactly_one_source`도 그 3-source
-- 버전으로 이미 바꿔놨다 — 두 세션이 같은 "월간 웨딩지원금" 기능을 각자
-- 독립적으로 구현하다 겹친 것이다. 실제 앱 코드(`routes/rewards.ts`)는
-- 0047의 `monthly_draw_entries`/`draw_entry_id`를 쓰고 있어 그쪽이 살아있는
-- 구현이고, 이 파일의 `draw_entries`/`monthly_draws`/`draw_results`/
-- `npay_deliveries`는 소비하는 앱 코드가 없다(0054 커밋 시점 기준). 그래도
-- 두 세션의 스키마 작업을 함부로 버리지 않고 컬럼명만 바꿔 공존시킨다 —
-- 어느 구현을 표준으로 삼을지는 코드 병합이 아니라 정책 결정이 필요하다.

ALTER TABLE structured.reward_grants
  ADD COLUMN mission_draw_entry_id uuid UNIQUE
    REFERENCES structured.draw_entries (id) ON DELETE CASCADE;

ALTER TABLE structured.reward_grants
  DROP CONSTRAINT grant_has_exactly_one_source;

ALTER TABLE structured.reward_grants
  ADD CONSTRAINT grant_has_exactly_one_source
    CHECK (
      (referral_id           IS NOT NULL)::int +
      (promotion_id          IS NOT NULL)::int +
      (draw_entry_id         IS NOT NULL)::int +
      (mission_draw_entry_id IS NOT NULL)::int = 1
    );

-- ---------------------------------------------------------------------------
-- NPay 지급 이력
-- ---------------------------------------------------------------------------
--
-- 지급 시도마다 행 하나. 실패하면 attempt_no를 올려 재발송을 기록한다.
-- 정책 I-4: 지급 상태·지급일·실패 여부·재발송 여부를 모두 남긴다.

CREATE TYPE npay_delivery_status AS ENUM (
  'attempted',  -- 시도했으나 응답 대기 / 미확인
  'delivered',  -- 지급 완료 확인
  'failed'      -- 실패 확인
);

CREATE TABLE structured.npay_deliveries (
  grant_id     uuid                  NOT NULL
                 REFERENCES structured.reward_grants (id) ON DELETE CASCADE,
  attempt_no   int                   NOT NULL CHECK (attempt_no >= 1),
  status       npay_delivery_status  NOT NULL DEFAULT 'attempted',
  attempted_at timestamptz           NOT NULL DEFAULT now(),
  -- delivered·failed 확정 시각. attempted 상태에서는 NULL.
  settled_at   timestamptz,
  -- 실패 시 NPay 오류 코드.
  error_code   text,

  PRIMARY KEY (grant_id, attempt_no),

  CONSTRAINT delivery_settled_has_at
    CHECK (status = 'attempted' OR settled_at IS NOT NULL)
);

CREATE INDEX npay_deliveries_grant_idx ON structured.npay_deliveries (grant_id, attempt_no DESC);

COMMENT ON TABLE structured.npay_deliveries IS
  'NPay 지급 시도 이력. 시도마다 행 하나. 재발송은 attempt_no를 올려 기록한다.';
COMMENT ON COLUMN structured.npay_deliveries.attempt_no IS
  '1부터 시작. 재발송이면 2, 3, ... 한 grant에 대한 최신 시도가 현재 상태다.';
