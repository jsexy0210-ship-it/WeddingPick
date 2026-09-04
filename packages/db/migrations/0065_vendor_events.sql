-- 업체 이벤트·프로모션. 업체 상세 혜택 탭 (WP-SRCH-004).
--
-- 박람회 할인·기간 한정 혜택처럼 업체가 직접 올리거나 관리자가 입력하는
-- 시간 범위가 있는 이벤트를 담는다. wedding_events(0061, 우리웨딩 일정)와
-- 다르다 — 그쪽은 커플의 캘린더 일정이고, 여기는 업체가 내거는 공개 혜택이다.
--
-- ends_at이 NULL이면 기한 없음 혜택이다. 화면에서 "기간 한정"과 "상시 혜택"을
-- 구분할 때 쓴다.

CREATE TABLE IF NOT EXISTS structured.vendor_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid        NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,

  title       text        NOT NULL CHECK (length(btrim(title)) > 0),
  description text        NOT NULL DEFAULT '',

  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,

  -- 아직 검증된 공개 게시물만 노출한다. 업체가 올린 뒤 관리자 승인 전까지
  -- visible = false로 둔다. 승인 없이 바로 올리면 허위·오해 유발 혜택을
  -- 막기 어렵다.
  visible     boolean     NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vendor_events_ends_after_starts CHECK (ends_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE structured.vendor_events IS
  '업체 이벤트·혜택. 시간 범위가 있는 업체 공개 프로모션 — wedding_events(커플 일정)와 다르다.';
COMMENT ON COLUMN structured.vendor_events.ends_at IS
  'NULL이면 기한 없음 혜택. 화면에서 기간 한정/상시를 구분하는 기준.';
COMMENT ON COLUMN structured.vendor_events.visible IS
  '관리자 승인 후 true. 승인 전에는 앱에 노출하지 않는다.';

-- 업체별 진행 중인 이벤트를 빠르게 조회한다.
CREATE INDEX IF NOT EXISTS vendor_events_vendor_active_idx
  ON structured.vendor_events (vendor_id, starts_at)
  WHERE visible = true;
