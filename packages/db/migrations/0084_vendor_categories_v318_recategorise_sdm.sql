-- 0083이 더한 enum 값을 쓴다 — 같은 트랜잭션에서는 못 쓰기 때문에 파일을 나눴다.
--
-- 남아 있는 스드메(sdm) 업체를 스튜디오로 옮긴다. 스드메 한 칸에 스튜디오·드레스·
-- 메이크업이 섞여 있었으니 정확한 업종은 사람이 다시 봐야 하지만, 목록에 이름
-- 붙일 수 없는 업종이 섞여 나오는 것보다는 낫다. 샘플 업체는 어차피 시드가 다시
-- 만든다(apps/api seed-demo).

UPDATE structured.vendors SET category = 'studio' WHERE category = 'sdm';

COMMENT ON TYPE vendor_category IS
  '업종. 핸드오프 v3.18 §1.3의 10종 + etc. planner_agency(0081) · sdm(0083)은 폐기 — 값만 남아 있고 쓰지 않는다.';
