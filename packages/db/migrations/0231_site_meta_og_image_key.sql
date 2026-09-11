-- 링크 미리보기 그림을 관리자가 올린다.
--
-- 2026-09-11 대표 지시 — 「링크 미리보기에는 이미지 등록 기능이 없다 추가하라」.
-- 지금까지 `og_image_url`은 「그림 주소」 글자 입력칸 하나였다. 주소를 어디선가
-- 먼저 만들어 와야 했으니 실제로는 개발자를 거치는 일이었다.
--
-- **주소를 담지 않고 저장소 열쇠를 담는다.** 올린 파일은 원본 저장소에 들어가고,
-- 공개 조회(`GET /v1/site-meta/og-image`)가 그것을 내보낸다. 서명 URL을 표에 적어
-- 두지 않는 이유는 **만료**다 — 서명은 길어도 며칠이고, 크롤러는 카드를 오래 캐시해
-- 두므로 만료된 주소가 남으면 어느 날부터 미리보기의 그림만 깨진다. 깨진 카드는
-- 아무도 신고하지 않는다.
--
-- 절대 주소는 조회할 때 그 요청이 들어온 origin으로 만든다. 환경변수로 두면 값이
-- 빠진 채 배포될 수 있고, 그때 나가는 것은 「그림 없는 카드」가 아니라 「없는 주소를
-- 가리키는 카드」다.

ALTER TABLE structured.site_meta
  ADD COLUMN og_image_key text CHECK (og_image_key IS NULL OR og_image_key <> '');

COMMENT ON COLUMN structured.site_meta.og_image_key IS
  '관리자가 올린 og:image의 저장소 열쇠. og_image_url과 동시에 차지 않는다 — 둘 중 하나만 그림의 출처가 된다.';

-- 출처는 하나뿐이다. 둘이 함께 차 있으면 화면과 빌드가 각자 다른 그림을 고른다.
ALTER TABLE structured.site_meta
  ADD CONSTRAINT site_meta_one_image_source
  CHECK (og_image_url IS NULL OR og_image_key IS NULL);
