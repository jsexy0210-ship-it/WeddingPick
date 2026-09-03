-- 업체 좌표. 지도 보기(WP-SRCH-007).
--
-- vendors에는 지금 "서울 마포구" 같은 구 단위 region만 있고(0001, 0007) 정확한
-- 주소가 없다. 정확한 지오코딩은 주소가 있어야 하는데, 주소를 모으는 일 자체는
-- 이 마이그레이션 범위가 아니다 — 나중에 주소를 넣을 자리(address)만 미리 두고,
-- 좌표는 지금 있는 이름·지역으로 채울 수 있는 만큼만 채운다. 방법은
-- `scripts/geocode-vendors.mts`, 결정 근거는 `PROJECT_STATUS.md`에 적는다.
--
-- **기본값을 두지 않는다.** 지오코딩 전 업체를 임의 좌표(0,0 등)로 채우면 지도에
-- 엉뚱한 핀이 뜬다. 좌표가 없으면 그 업체는 지도에 안 뜨는 것이 맞다 — 목록에는
-- 그대로 뜬다.

ALTER TABLE structured.vendors
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

DO $$ BEGIN
  ALTER TABLE structured.vendors
    ADD CONSTRAINT vendors_lat_check CHECK (lat IS NULL OR lat BETWEEN -90 AND 90);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE structured.vendors
    ADD CONSTRAINT vendors_lng_check CHECK (lng IS NULL OR lng BETWEEN -180 AND 180);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- 위도만 있고 경도가 없는 반쪽 좌표를 막는다.
  ALTER TABLE structured.vendors
    ADD CONSTRAINT vendors_geo_both_or_neither CHECK ((lat IS NULL) = (lng IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN structured.vendors.address IS
  '정확한 지오코딩을 위한 상세 주소. 지금은 대부분 NULL — 수집 파이프라인은 이후 과제.';
COMMENT ON COLUMN structured.vendors.lat IS
  '위도. NULL이면 아직 지오코딩하지 않은 업체다 — 지도에는 안 뜨고 목록에는 그대로 뜬다.';
COMMENT ON COLUMN structured.vendors.lng IS
  '경도. lat과 항상 짝으로 있거나 둘 다 없다.';

-- 지도가 "이 영역 안의 업체"를 찾을 때 쓴다. 좌표 있는 업체만 대상이라 부분 색인으로 충분하다.
CREATE INDEX IF NOT EXISTS vendors_geo_idx ON structured.vendors (lat, lng) WHERE lat IS NOT NULL;
