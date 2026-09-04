-- 박람회 정보. 웨딩 박람회 목록·상세 (WP-EXPO-001, WP-EXPO-002).
--
-- 주최사·일정·장소·혜택을 저장한다. 알림 구독은 expo_notify 테이블에 따로 둔다.
-- status는 DB에 직접 두되, startsAt/endsAt 기준으로 자동 계산하는 뷰도 만든다.

CREATE TABLE IF NOT EXISTS structured.expos (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  text          NOT NULL,
  organizer              text          NOT NULL,
  starts_at              date          NOT NULL,
  ends_at                date          NOT NULL,
  venue                  text          NOT NULL,
  address                text          NOT NULL DEFAULT '',
  region                 text          NOT NULL,
  registration_deadline  date,
  -- benefits: ["혜택1", "혜택2"]
  benefits               jsonb         NOT NULL DEFAULT '[]',
  description            text          NOT NULL DEFAULT '',
  source_note            text          NOT NULL DEFAULT '',
  last_verified_at       date          NOT NULL DEFAULT CURRENT_DATE,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now()
);

-- 알림 구독 테이블
CREATE TABLE IF NOT EXISTS structured.expo_notify (
  expo_id    uuid   NOT NULL REFERENCES structured.expos (id) ON DELETE CASCADE,
  user_id    uuid   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expo_id, user_id)
);

CREATE INDEX IF NOT EXISTS expos_starts_at_idx ON structured.expos (starts_at);
CREATE INDEX IF NOT EXISTS expos_region_idx    ON structured.expos (region);

COMMENT ON TABLE structured.expos IS
  '웨딩 박람회 목록. 일정·장소·혜택 정보를 담는다.';
COMMENT ON TABLE structured.expo_notify IS
  '박람회 알림 구독. 사용자가 박람회별 알림을 켰을 때 한 행이 생긴다.';
