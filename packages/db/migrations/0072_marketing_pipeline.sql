-- 홍보 소재 (운영자가 등록·검토한 사실 묶음)
CREATE TABLE IF NOT EXISTS marketing_sources (
  id             TEXT        PRIMARY KEY,
  fact_ids       TEXT[]      NOT NULL,
  reviewed       BOOLEAN     NOT NULL DEFAULT FALSE,
  reviewed_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  next_verify_at TIMESTAMPTZ,
  active         BOOLEAN     NOT NULL DEFAULT TRUE,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 콘텐츠 작업 (생성·예약·모의)
CREATE TABLE IF NOT EXISTS marketing_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    TEXT        NOT NULL REFERENCES marketing_sources(id),
  channel      TEXT        NOT NULL CHECK (channel IN ('blog','instagram','shortform','community')),
  format       TEXT        NOT NULL CHECK (format IN ('product','feature','checklist','data')),
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  utm_url      TEXT,
  status       TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','simulated','failed')),
  scheduled_at TIMESTAMPTZ,
  simulated_at TIMESTAMPTZ,
  failed_at    TIMESTAMPTZ,
  fail_reason  TEXT,
  retry_count  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 이벤트 로그 (상태 변경 감사)
CREATE TABLE IF NOT EXISTS marketing_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID        NOT NULL REFERENCES marketing_jobs(id),
  event_type TEXT        NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_jobs_status ON marketing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_marketing_jobs_scheduled ON marketing_jobs(scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_marketing_events_job ON marketing_events(job_id);

-- 중복 생성 방지: 같은 소재·채널·포맷·날짜는 1건만
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_jobs_unique_daily
  ON marketing_jobs(source_id, channel, format, DATE(COALESCE(scheduled_at, created_at)));
