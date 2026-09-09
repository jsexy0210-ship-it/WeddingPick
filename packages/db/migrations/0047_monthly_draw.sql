-- allow-destructive: 쓰지 않게 된 월간 추첨 표와 컬럼을 정리한다
-- ---------------------------------------------------------------------------
-- 월간 웨딩지원금. 최종통합정책 §31.
--
-- 응모 조건 3개(예식일과 지역 · Pick 인증 1건 · 배우자 연결)를 채운 회차에 자동 응모된다. 회차당 1커플, Npay 5만원(v3.22).
-- 응모와 당첨 기록을 분리한다 — 응모 행이 쌓이고, 당첨자만 reward_grant가 생긴다.
-- 추첨은 사람이 실행한다 (어뷰징 최종 검증 → 추첨 → 지급).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 0. 예전 구현 정리
-- ---------------------------------------------------------------------------
--
-- 같은 정책(§31)을 두 세션이 각자 스키마로 구현했다. 먼저 만들어진 쪽
-- (구 0052_mission_draw 등, 커밋 4be7da7에서 파일은 지웠다)이 production에
-- 이미 적용돼 있다 — 하지만 어느 코드도 그 표를 참조한 적이 없는 죽은
-- 스키마였다(reward_grants.draw_entry_id 컬럼 포함). 이 마이그레이션은
-- production에는 처음 적용되므로, 그 죽은 표가 남아 있으면 먼저 지운다.
-- 새 DB에는 애초에 없으니 이 블록은 그런 곳에서 전부 조용히 넘어간다.
--
-- draw_entry_id를 먼저 지운다 — grant_has_exactly_one_source·
-- grant_source_matches_kind 제약이 그 컬럼을 참조하므로, CASCADE로 함께
-- 지워진다. 아래에서 같은 이름으로 다시 만든다.
ALTER TABLE structured.reward_grants DROP COLUMN IF EXISTS draw_entry_id CASCADE;

DROP TABLE IF EXISTS structured.npay_deliveries CASCADE;
DROP TABLE IF EXISTS structured.draw_results CASCADE;
DROP TABLE IF EXISTS structured.draw_entries CASCADE;
DROP TABLE IF EXISTS structured.monthly_draws CASCADE;
DROP VIEW IF EXISTS structured.missions_all_done CASCADE;
DROP TABLE IF EXISTS structured.mission_completions CASCADE;

DROP TYPE IF EXISTS npay_delivery_status;
DROP TYPE IF EXISTS draw_result;
DROP TYPE IF EXISTS draw_abuse_status;
DROP TYPE IF EXISTS mission_key;

-- 1. reward_kind 열거형 확장
--    트랜잭션 밖에서 실행해야 한다 (PostgreSQL enum ADD VALUE 제약).

ALTER TYPE reward_kind ADD VALUE IF NOT EXISTS 'monthly_draw';

-- ---------------------------------------------------------------------------
-- 2. 응모 내역 테이블
-- ---------------------------------------------------------------------------

CREATE TABLE structured.monthly_draw_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  draw_month   text        NOT NULL CHECK (draw_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  entered_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, draw_month)
);

COMMENT ON TABLE structured.monthly_draw_entries IS
  '월간 웨딩지원금 응모 내역. 4개 미션 완료 달에 자동 생성된다.';

COMMENT ON COLUMN structured.monthly_draw_entries.draw_month IS
  '''YYYY-MM'' 형식. 응모가 어느 달인지를 나타낸다.';

CREATE INDEX monthly_draw_entries_month_idx
  ON structured.monthly_draw_entries (draw_month, user_id);

-- ---------------------------------------------------------------------------
-- 3. reward_grants — monthly_draw 출처 컬럼 추가 및 체크 제약 갱신
-- ---------------------------------------------------------------------------

ALTER TABLE structured.reward_grants
  ADD COLUMN draw_entry_id uuid REFERENCES structured.monthly_draw_entries (id) ON DELETE SET NULL;

-- 기존 제약: referral_id와 promotion_id 중 정확히 하나가 non-null
-- 새 제약:   referral_id, promotion_id, draw_entry_id 중 정확히 하나가 non-null
ALTER TABLE structured.reward_grants
  DROP CONSTRAINT IF EXISTS grant_has_exactly_one_source;

ALTER TABLE structured.reward_grants
  ADD CONSTRAINT grant_has_exactly_one_source CHECK (
    (referral_id   IS NOT NULL)::int
    + (promotion_id IS NOT NULL)::int
    + (draw_entry_id IS NOT NULL)::int
    = 1
  );
