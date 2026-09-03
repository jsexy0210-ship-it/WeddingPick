-- 웨딩 정보 게시물. 준비단계별·카테고리별 읽을거리 (WP-EXPO-003, WP-EXPO-004).
--
-- 외부에서 긁어오거나 에디터가 직접 쓴 콘텐츠를 담는다.
-- checklist, related_vendor_ids는 앱이 배열로 쓰도록 JSONB로 둔다.

CREATE TABLE IF NOT EXISTS structured.wedding_info (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text          NOT NULL,
  summary       text          NOT NULL DEFAULT '',
  body          text          NOT NULL DEFAULT '',
  category      text          NOT NULL
                  CHECK (category IN (
                    'planning','venue','dress','photo','beauty','catering','honeymoon'
                  )),
  stage         text          NOT NULL
                  CHECK (stage IN ('early','mid','late','all')),
  thumbnail_url text,
  -- 체크리스트: [{id, label, done}]
  checklist     jsonb         NOT NULL DEFAULT '[]',
  -- 관련 업체 id 목록: ["uuid", ...]
  related_vendor_ids jsonb    NOT NULL DEFAULT '[]',
  published_at  timestamptz   NOT NULL DEFAULT now(),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wedding_info_category_idx ON structured.wedding_info (category);
CREATE INDEX IF NOT EXISTS wedding_info_stage_idx    ON structured.wedding_info (stage);
CREATE INDEX IF NOT EXISTS wedding_info_published_at_idx ON structured.wedding_info (published_at DESC);

COMMENT ON TABLE structured.wedding_info IS
  '웨딩 정보 게시물. 준비단계별·카테고리별 알아두면 좋은 읽을거리.';
