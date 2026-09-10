-- 업체 공식 홈페이지의 대표 이미지를 받을 자리.
--
-- 2026-09-10 사용자 오더 — 「우선 업체 공식 홈페이지의 대표 이미지를 사용한다 ·
-- 업체 정보는 지우지 말고 홈페이지 이미지를 활용해 최대한 매칭 시킨다」.
--
-- 두 가지가 필요하다.
--
-- 1) 저작권 근거에 「업체가 자기 홈페이지에 대표 이미지로 올려 둔 것」이 없었다.
--    `vendor_provided`는 업체가 우리에게 직접 준 것이라 다르고, `unknown`은
--    화면에 내보내지 않는 값이다(0050). 그 자리를 있는 그대로 적을 값을 만든다.
--
-- 2) 홈페이지 주소를 적을 자리가 없었다. `official_domain`(0038)은 업체 관계자
--    확인에 쓰는 값이라 사람이 승인한 것만 들어가야 한다 — 자동으로 찾은 주소를
--    거기 넣으면 「도메인이 맞으면 관계자」라는 확인 절차가 약해진다. 그래서
--    따로 둔다.
ALTER TYPE image_copyright_basis ADD VALUE IF NOT EXISTS 'vendor_homepage';

ALTER TABLE structured.vendors
  ADD COLUMN IF NOT EXISTS homepage_url        text,
  ADD COLUMN IF NOT EXISTS homepage_checked_at timestamptz;

COMMENT ON COLUMN structured.vendors.homepage_url IS
  '자동으로 찾은 업체 공식 홈페이지. 사람이 승인한 official_domain과 다르다 — 관계자 확인에 쓰지 않는다.';

COMMENT ON COLUMN structured.vendors.homepage_checked_at IS
  '홈페이지를 마지막으로 찾아본 시각. 못 찾았어도 적는다 — 같은 업체를 매번 다시 찾지 않기 위해서다.';
