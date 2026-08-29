-- 광고 지면. 최종통합정책 v2.0 E장.
--
-- E-1: 자연 검색/추천과 광고 영역을 **분리한다.** 유료 노출은 광고임을 명확히
-- 표시하고, 광고비는 실제 결제 데이터·후기·검증·신고·검색 품질점수·비광고
-- 비교에 영향을 주지 않는다.
--
-- **그래서 광고를 다른 스키마에 둔다.**
--
-- 같은 스키마에 두고 "섞지 말자"고 정해두면, 언젠가 누군가 조인 한 줄을 더한다.
-- `ads.`를 앞에 적어야만 닿을 수 있게 해두면 그 한 줄이 눈에 보이고, 코드 리뷰가
-- 그것만 보면 된다. 관례가 아니라 이름이 지키는 경계다.

CREATE SCHEMA ads;

COMMENT ON SCHEMA ads IS
  '광고 지면. 자연 검색·추천 자료(structured)와 다른 스키마에 둔다 — 섞이려면 ads.를 적어야 하고, 그러면 눈에 보인다(v2.0 E-1).';

/** 어느 지면인가. 지면마다 자연 결과와 나뉘는 자리가 다르다. */
CREATE TYPE ad_surface AS ENUM ('search', 'home');

CREATE TABLE ads.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /*
   * 어느 업체의 광고인가.
   *
   * structured를 가리키기는 한다 — 광고는 업체를 가리켜야 하므로 어쩔 수 없다.
   * 중요한 것은 **반대 방향이 없다는 것**이다: structured의 어떤 표도 ads를
   * 가리키지 않는다. 그래서 자연 결과를 세는 질의는 ads를 볼 일이 없다.
   */
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,

  surface ad_surface NOT NULL,
  /** 이 조건일 때만 보인다. NULL이면 조건을 걸지 않는다. */
  category vendor_category,
  region text,

  starts_on date NOT NULL,
  ends_on date NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT placement_period_is_ordered CHECK (ends_on >= starts_on)
);

CREATE INDEX placements_surface_idx ON ads.placements (surface, starts_on, ends_on);

COMMENT ON TABLE ads.placements IS
  '유료 노출 자리. 광고비가 검색 순위에 섞이지 않도록 자연 결과와 다른 스키마에 둔다.';

/*
 * 오늘 유효한 광고.
 *
 * 기간을 화면마다 다시 적지 않기 위해 뷰로 둔다 — 한 화면이 하루 어긋나면 돈이
 * 오간 약속이 어긋나는 것이다.
 */
CREATE VIEW ads.active_placements AS
SELECT p.id, p.vendor_id, p.surface, p.category, p.region
FROM ads.placements p
WHERE current_date BETWEEN p.starts_on AND p.ends_on;

COMMENT ON VIEW ads.active_placements IS
  '오늘 보일 수 있는 광고. 기간 판정을 한곳에 둔다.';
