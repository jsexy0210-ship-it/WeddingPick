-- 우리웨딩 — 일정. 핸드오프 WP-OUR-004~006.
--
-- 웨딩 스케줄(0031, wedding_tasks)과 다른 개념이다. 스케줄은 "준비할 일"이고
-- 완료 여부만 본다. 여기는 일시·장소가 있는 실제 캘린더 이벤트다 — 상견례
-- 몇 시, 스드메 촬영 몇 시 같은 것. 둘을 한 테이블에 합치면 날짜만 있고
-- 시각·장소가 없는 스케줄 행과, 시각이 필수인 일정 행이 서로 다른 규칙을
-- 우겨넣게 된다.
--
-- **예정/완료는 저장하지 않는다.** starts_at과 지금 시각을 비교하면 되는
-- 값이다 — 저장하면 언젠가 시각을 고치고 상태는 안 고치는 순간 거짓말이
-- 된다(task_state와 같은 이유로, 여기는 override조차 두지 않는다. 일정은
-- "지났다/안 지났다"를 사람이 다르게 판단할 여지가 없다).

CREATE TABLE IF NOT EXISTS structured.wedding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,

  title text NOT NULL CHECK (length(btrim(title)) > 0),
  starts_at timestamptz NOT NULL,
  location text,

  -- 어느 업체와 관련된 일정인지. 이름만 적어도 되고 업체를 고를 수도 있다 —
  -- wedding_tasks의 vendor_id/vendor_label과 같은 이유.
  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  vendor_label text,

  memo text,

  -- 지금은 데이터만 저장한다. 실제 푸시 발송은 이 세션 범위 밖이다.
  notify_enabled boolean NOT NULL DEFAULT true,

  -- 지금은 항상 'manual'이다. 결정한 업체(WP-OUR-003)에서 계약금/잔금일 같은
  -- 일정을 자동으로 깔아주는 기능은 이번 범위가 아니지만, 그게 생겼을 때
  -- 마이그레이션 없이 source='auto'로 꽂을 수 있게 열만 미리 둔다.
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),

  added_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.wedding_events IS
  '우리웨딩 일정. 일시·장소가 있는 캘린더 이벤트 — wedding_tasks(체크리스트)와 다르다.';
COMMENT ON COLUMN structured.wedding_events.source IS
  '지금은 항상 manual. auto는 훗날 업체 결정에서 자동 생성할 때 쓸 자리만 미리 둔다.';
COMMENT ON COLUMN structured.wedding_events.notify_enabled IS
  '알림 켬/끔 데이터만 저장한다. 실제 푸시 발송 로직은 이 마이그레이션 범위 밖이다.';

CREATE INDEX IF NOT EXISTS wedding_events_wedding_idx ON structured.wedding_events (wedding_id, starts_at);
