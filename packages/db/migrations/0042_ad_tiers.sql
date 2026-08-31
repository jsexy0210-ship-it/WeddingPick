-- 광고 상품과 지면. 통합정책 v3.10 §2.
--
-- 0040은 지면을 `search`와 `home` 둘로 뒀다. v3.10이 상품을 정하면서 지면이
-- 달라졌다 — 업체 상세·검색·지역/카테고리 셋이고, `home`은 상품에 없다.
--
-- 값을 더하고 `home`을 남겨두지 않는다. 쓰지 않는 값이 목록에 남아 있으면
-- 언젠가 누가 그걸 고르고, 그 광고는 팔린 적 없는 지면에 실린다.

-- 뷰가 열을 잡고 있어 타입을 못 바꾼다. 내렸다가 아래에서 다시 세운다.
DROP VIEW ads.active_placements;

ALTER TYPE ad_surface RENAME TO ad_surface_v1;

CREATE TYPE ad_surface AS ENUM ('vendor_detail', 'search', 'region_category');

ALTER TABLE ads.placements
  ALTER COLUMN surface TYPE ad_surface
  USING (CASE surface::text WHEN 'home' THEN 'vendor_detail' ELSE surface::text END)::ad_surface;

DROP TYPE ad_surface_v1;

/*
 * 0040과 같되 tier를 함께 낸다. 어느 상품으로 산 자리인지 알아야 그 상품이
 * 실운영으로 열렸는지 볼 수 있다(0043).
 *
 * tier 열은 아래에서 더하므로 뷰는 그 뒤에 세운다.
 */

/*
 * 어느 상품으로 산 자리인가.
 *
 * 지면만 두면 "이 자리를 살 수 있는 등급인가"를 나중에 되짚을 수 없다. 등급이
 * 값을 정하고 값이 지면을 정하므로, 판 것을 그대로 적어둔다.
 */
CREATE TYPE ad_tier AS ENUM ('light', 'standard', 'premium');

ALTER TABLE ads.placements
  ADD COLUMN tier ad_tier NOT NULL DEFAULT 'light';

ALTER TABLE ads.placements ALTER COLUMN tier DROP DEFAULT;

COMMENT ON COLUMN ads.placements.tier IS
  '판매한 상품 등급. LIGHT 3만/STANDARD 7만/PREMIUM 15만(v3.10 §2).';

CREATE VIEW ads.active_placements AS
SELECT p.id, p.vendor_id, p.surface, p.tier, p.category, p.region
FROM ads.placements p
WHERE current_date BETWEEN p.starts_on AND p.ends_on;

COMMENT ON VIEW ads.active_placements IS
  '오늘 보일 수 있는 광고. 기간 판정을 한곳에 둔다. tier는 실운영 여부를 보려고 함께 낸다.';

/*
 * 등급이 살 수 없는 지면에 자리를 잡을 수 없다.
 *
 * 포함 관계가 배열 순서로 정해져 있으므로(도메인 surfacesFor) 여기서도 같은
 * 순서를 적는다. 화면이나 도구에서 거르는 것만으로는 직접 넣는 길이 남는다.
 */
ALTER TABLE ads.placements
  ADD CONSTRAINT placement_surface_fits_tier CHECK (
    CASE tier
      WHEN 'light' THEN surface = 'vendor_detail'
      WHEN 'standard' THEN surface IN ('vendor_detail', 'search')
      ELSE true
    END
  );
