-- 전국 웨딩박람회 수집·검증 사양(docs/expo-agent-spec.md). 기존 structured.expos 테이블
-- 위에 얹는다 — 칼럼 이름은 하나도 바꾸지 않는다(화면·라우트가 이미 그 이름을 읽는다).
--
-- 추가하는 칼럼은 사양 5절 "반드시 추출할 값" 중 기존 테이블에 없던 것들이다.
-- benefits(기존)·last_verified_at(기존)은 그대로 재사용하고 새로 만들지 않는다.

ALTER TABLE structured.expos
  ADD COLUMN IF NOT EXISTS canonical_event_name   text,
  ADD COLUMN IF NOT EXISTS aliases                jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS host                   text,
  ADD COLUMN IF NOT EXISTS opening_hours          text,
  ADD COLUMN IF NOT EXISTS city                   text,
  ADD COLUMN IF NOT EXISTS district               text,
  -- event_categories: 사양 6절 카테고리 중 하나 이상.
  ADD COLUMN IF NOT EXISTS event_categories       jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS admission_fee          text,
  ADD COLUMN IF NOT EXISTS reservation_required   boolean,
  ADD COLUMN IF NOT EXISTS reservation_url        text,
  ADD COLUMN IF NOT EXISTS official_website_url   text,
  ADD COLUMN IF NOT EXISTS official_sns_urls      jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS discovery_urls         jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS verification_urls      jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS first_discovered_at    timestamptz NOT NULL DEFAULT now(),
  -- upcoming/ongoing/closed는 starts_at·ends_at으로 매번 계산한다(routes/expos.ts
  -- expoStatus). 날짜로 못 도출하는 두 상태(취소·연기)만 여기 저장해 둔다.
  ADD COLUMN IF NOT EXISTS manual_status          text
    CHECK (manual_status IS NULL OR manual_status IN ('CANCELLED', 'POSTPONED')),
  ADD COLUMN IF NOT EXISTS confidence             text
    CHECK (confidence IS NULL OR confidence IN
      ('OFFICIAL_CONFIRMED', 'CROSS_CONFIRMED', 'SOCIAL_ONLY', 'CONFLICT')),
  ADD COLUMN IF NOT EXISTS confidence_score       integer
    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS duplicate_candidate_ids jsonb      NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS admin_review_required  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason          jsonb       NOT NULL DEFAULT '[]';

-- 종료 자동 삭제 스윕이 매일 훑는 조건이 ends_at이다(사양 15절).
CREATE INDEX IF NOT EXISTS expos_ends_at_idx ON structured.expos (ends_at);
-- 관리자 검수 큐가 맨 위에서 보여줄 목록.
CREATE INDEX IF NOT EXISTS expos_admin_review_required_idx
  ON structured.expos (admin_review_required) WHERE admin_review_required;

COMMENT ON COLUMN structured.expos.manual_status IS
  '취소·연기만 담는다. 진행 예정/중/종료는 starts_at·ends_at으로 계산한다.';

-- 종료돼 지워진 박람회의 최소 로그(사양 15절 "최소 삭제 로그"). 홍보문구·이미지·
-- 상세 콘텐츠는 담지 않는다 — 담는 목적은 운영 이력 확인과 재수집 방지뿐이다.
-- start_date·venue는 사양 예시 JSON에는 없지만 "재수집 방지: 행사명 + 날짜 +
-- 장소가 같으면 다시 등록하지 않는다"(사양 15절)를 판별하려면 필요한 최소값이라
-- 함께 둔다.
CREATE TABLE IF NOT EXISTS structured.expo_deletion_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL,
  event_name    text        NOT NULL,
  start_date    date        NOT NULL,
  end_date      date        NOT NULL,
  venue         text        NOT NULL,
  deleted_at    timestamptz NOT NULL DEFAULT now(),
  delete_reason text        NOT NULL DEFAULT 'EVENT_ENDED'
);

-- 재수집 방지 판별(행사명 + 시작일 + 장소)이 훑는 색인.
CREATE INDEX IF NOT EXISTS expo_deletion_log_dedup_idx
  ON structured.expo_deletion_log (event_name, start_date, venue);

COMMENT ON TABLE structured.expo_deletion_log IS
  '종료돼 자동 삭제된 박람회의 최소 로그. 재수집 방지 · 운영 이력 확인용 — 본문은 담지 않는다.';
