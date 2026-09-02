-- ---------------------------------------------------------------------------
-- 월간 웨딩지원금. 최종통합정책 §31.
--
-- 4개 미션을 모두 마친 달에 자동 응모된다. 매월 2명 추첨, 1인 NPay 5만원.
-- 응모와 당첨 기록을 분리한다 — 응모 행이 쌓이고, 당첨자만 reward_grant가 생긴다.
-- 추첨은 사람이 실행한다 (어뷰징 최종 검증 → 추첨 → 지급).
-- ---------------------------------------------------------------------------

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
