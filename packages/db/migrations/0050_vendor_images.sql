-- 업체 이미지 파이프라인.
--
-- 규격 초안 6~10번: 저작권 확인 → 업체 매칭 → 품질 검증 → Crop → 디폴트 fallback.
--
-- 이미지 하나가 행 하나다. 같은 업체에 여러 이미지가 있을 수 있고,
-- 그 중 approved + is_representative = true인 것이 대표 이미지다.
-- 대표 이미지가 없으면 화면이 카테고리별 웨딩픽 디폴트를 보여준다 —
-- 디폴트 이미지는 이 테이블이 아니라 프론트 코드가 관리한다.
--
-- status 흐름:
--   pending → rights_rejected  (저작권 불명확·상업적 이용 불가)
--           → match_rejected   (업체 매칭 신뢰도 부족 — 실제로 그 업체 이미지인지 불명확)
--           → quality_rejected (해상도·비율·워터마크·광고 배너 등 품질 미달)
--           → crop_failed      (핵심 영역 잘림 — 핵심 피사체가 카드 밖으로 나감)
--           → approved         (검증 통과, 노출 가능)

CREATE TYPE image_copyright_basis AS ENUM (
  'public_domain',    -- 저작권 없음
  'cc_by',            -- CC BY (출처 표시)
  'cc_by_sa',         -- CC BY-SA (출처 표시 + 동일 조건)
  'kogl_type1',       -- 공공누리 제1유형 (출처 표시, 상업적 이용·변경 가능)
  'kogl_type4',       -- 공공누리 제4유형 (출처 표시 + 상업적 이용·변경 금지)
  'vendor_provided',  -- 업체가 직접 제공 (사용 허락 별도 확인)
  'unknown'           -- 확인 안 됨 — 이 상태는 노출하지 않는다
);

CREATE TYPE image_status AS ENUM (
  'pending',          -- 수집했으나 검증 전
  'rights_rejected',  -- 저작권 불명확 또는 상업적 이용 불가
  'match_rejected',   -- 업체 매칭 신뢰도 부족
  'quality_rejected', -- 해상도·비율·워터마크 등 품질 미달
  'crop_failed',      -- 핵심 영역이 카드 밖으로 잘림
  'approved'          -- 검증 통과, 노출 가능
);

CREATE TABLE structured.vendor_images (
  id                  uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           uuid                    NOT NULL
                        REFERENCES structured.vendors (id) ON DELETE CASCADE,

  -- 저장소
  storage_key         text,       -- 내부 객체 스토리지 키. NULL이면 외부 URL만 있다
  source_url          text,       -- 원본 이미지 URL (감사 추적·재수집용)

  -- 저작권
  copyright_basis     image_copyright_basis   NOT NULL DEFAULT 'unknown',
  copyright_note      text,       -- 확인 근거나 화면에 표시할 출처 문구

  -- 업체 매칭 신뢰도. 1.0이면 업체가 직접 제공한 것.
  -- 이름만 일치하는 검색 결과 이미지는 낮은 값을 받는다.
  match_confidence    numeric(4,3)            NOT NULL DEFAULT 0
                        CHECK (match_confidence BETWEEN 0 AND 1),

  -- 원본 크기
  width_px            int         CHECK (width_px > 0),
  height_px           int         CHECK (height_px > 0),

  -- 품질 점수 (0.0~1.0). 해상도·선명도·워터마크 없음·광고 배너 없음 복합 점수.
  quality_score       numeric(4,3)
                        CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 1),

  -- Crop focal point. 0.0 = 왼쪽/위, 1.0 = 오른쪽/아래.
  -- 핵심 피사체의 중심을 가리킨다. 카드 비율별 crop이 이 점을 기준으로 자른다.
  focal_x             numeric(5,4)
                        CHECK (focal_x IS NULL OR focal_x BETWEEN 0 AND 1),
  focal_y             numeric(5,4)
                        CHECK (focal_y IS NULL OR focal_y BETWEEN 0 AND 1),

  -- 로고·CI처럼 잘리면 안 되는 이미지는 contain 방식으로 표시한다.
  use_contain         boolean                 NOT NULL DEFAULT false,

  -- 상태
  status              image_status            NOT NULL DEFAULT 'pending',
  rejection_reason    text,       -- rejected·failed 상태일 때 이유
  is_representative   boolean                 NOT NULL DEFAULT false,

  created_at          timestamptz             NOT NULL DEFAULT now(),
  verified_at         timestamptz,  -- approved·rejected로 전환된 시각

  -- 거부 상태에는 이유가 따라온다.
  CONSTRAINT image_rejection_has_reason
    CHECK (status NOT IN ('rights_rejected', 'match_rejected', 'quality_rejected', 'crop_failed')
           OR rejection_reason IS NOT NULL),

  -- 대표 이미지는 approved 상태에서만 설정할 수 있다.
  CONSTRAINT representative_only_when_approved
    CHECK (NOT is_representative OR status = 'approved'),

  -- 저장소 키나 원본 URL 중 하나는 있어야 한다.
  CONSTRAINT image_has_location
    CHECK (storage_key IS NOT NULL OR source_url IS NOT NULL)
);

-- 업체별 approved 대표 이미지는 하나만.
CREATE UNIQUE INDEX vendor_images_representative_idx
  ON structured.vendor_images (vendor_id)
  WHERE is_representative AND status = 'approved';

-- 업체별 이미지 목록 조회. 상태별 필터와 함께 쓴다.
CREATE INDEX vendor_images_vendor_status_idx
  ON structured.vendor_images (vendor_id, status, created_at DESC);

COMMENT ON TABLE structured.vendor_images IS
  '업체 이미지. 수집→저작권→업체매칭→품질→Crop 순서로 검증한다. 대표 이미지가 없으면 프론트가 카테고리 디폴트를 보여준다.';

COMMENT ON COLUMN structured.vendor_images.match_confidence IS
  '이 이미지가 실제로 해당 업체의 이미지인지 신뢰도. 업체 직접 제공은 1.0, 이름 일치 검색 결과는 낮은 값.';

COMMENT ON COLUMN structured.vendor_images.use_contain IS
  'true이면 카드 크기에 맞게 crop하지 않고 contain 방식으로 표시한다. 로고·CI에 사용.';

COMMENT ON COLUMN structured.vendor_images.focal_x IS
  '핵심 피사체 중심의 가로 위치 (0~1). crop 기준점. 웨딩홀 내부·드레스 인물 등 주요 영역이 잘리지 않게 한다.';
