-- 웨딩피드 본문 이미지.
-- 기존 image_key는 홈/목록 카드의 대표 썸네일로 유지하고, 상세 본문 이미지는 별도 키로 둔다.
-- 둘을 한 칸에 겹치면 썸네일 교체가 본문 이미지까지 바꾸는 운영 사고가 생긴다.
ALTER TABLE structured.wedding_feed_posts
  ADD COLUMN body_image_key text;
