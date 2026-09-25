-- 0436: 링크 미리보기를 세 벌로 나눈다(2026-09-25 대표 지시 — 「관리자 링크 미리보기는
-- RN용 미리보기 · 초대용 미리보기 · 웹사이트 미리보기 각각 관리가 가능해야한다」).
--
--   app      앱웹 주소(로그인 · 앱 화면 링크)가 싣는 카드 — `apps/mobile` web export
--   invite   배우자 초대 안내 주소(`/invite`)가 싣는 카드 — 초대 코드는 담지 않는다
--   website  웹사이트(랜딩 · 하위 페이지)가 싣는 카드 — `apps/web`
--
-- 0099의 「한 줄짜리 표」가 「벌마다 한 줄」이 된다. 참으로 고정하던 `id` 대신 `kind`가
-- 열쇠다. 기존 한 벌의 값은 웹사이트용과 앱용의 시작값으로 옮긴다. 초대용은 새로 생기는
-- 벌이라 비워 두고 spec의 기본값을 쓴다.

ALTER TABLE structured.site_meta
  ADD COLUMN kind text NOT NULL DEFAULT 'website'
    CHECK (kind IN ('app', 'invite', 'website'));

ALTER TABLE structured.site_meta DROP CONSTRAINT site_meta_pkey;
ALTER TABLE structured.site_meta DROP COLUMN id;
ALTER TABLE structured.site_meta ADD PRIMARY KEY (kind);
ALTER TABLE structured.site_meta ALTER COLUMN kind DROP DEFAULT;

INSERT INTO structured.site_meta
  (kind, og_title, og_description, og_image_url, og_image_key, og_image_alt,
   updated_at, updated_by, published_at)
SELECT 'app', og_title, og_description, og_image_url, og_image_key, og_image_alt,
       updated_at, updated_by, published_at
FROM structured.site_meta
WHERE kind = 'website';

COMMENT ON TABLE structured.site_meta IS
  '링크 미리보기(OG 카드) 문구. 벌(app · invite · website)마다 한 줄. NULL인 열은 spec/strings.ko.json의 값을 쓴다.';
COMMENT ON COLUMN structured.site_meta.kind IS
  'app = 앱웹 · invite = 배우자 초대 안내 주소 · website = 웹사이트. 서로의 값을 대신 쓰지 않는다.';
