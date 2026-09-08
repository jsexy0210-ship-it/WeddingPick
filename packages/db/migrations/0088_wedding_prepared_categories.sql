-- 준비 현황(온보딩 3/5) — 디자인 핸드오프 v3.19 «초기 설정 · 5개 질문으로 재정렬» ·
-- v3.22 «준비 현황 · 그룹 분류 · 12개 업종»(2026-09-08).
--
-- 이미 정한 업종을 고른다. 결정한 업종은 홈 준비현황에 «결정 완료»로 들어가고
-- 추천 · TOP3 · 취향 질문에서 건너뛴다. 빈 배열이 «아직 시작 전이에요»다.
--
-- category_decisions(0041)와 다른 표에 두는 이유: 그쪽은 «Pick한 곳 중 어디로
-- 정했는지»라 업체가 붙는다. 여기는 «우리 앱 밖에서 이미 정했다»는 사실만 있고
-- 업체가 없다. 두 표를 합치면 vendor_id가 NULL인 결정이 생기고, 그 행은 화면마다
-- 다르게 읽힌다.
--
-- 값은 도메인 PREPARATION_CATEGORIES(«기타» 제외)로 제한한다 — API가 지킨다.
-- 0085가 더한 hair · bouquet는 이 파일에서 직접 쓰지 않는다(컬럼 타입만 참조).

ALTER TABLE structured.weddings
  ADD COLUMN prepared_categories vendor_category[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN structured.weddings.prepared_categories IS
  '준비 현황(온보딩 3/5)에서 이미 정했다고 고른 업종. 빈 배열이 «아직 시작 전이에요». category_decisions와 달리 업체가 없다.';

-- 초기 설정을 마쳤는가.
--
-- v3.19부터 예식일 · 지역 · 준비 현황 · 예산이 전부 «미정»일 수 있어(취향만 필수)
-- 값의 유무로는 알 수 없다. 전에는 region IS NOT NULL이 그 판단이었다
-- (routes/weddings.ts · auth/sessions.ts · routes/rewards.ts) — 이제 이 컬럼 하나가
-- 판단이고, 세 곳이 전부 이 컬럼을 본다.
--
-- 이미 지역을 적어둔 웨딩은 설정을 마친 것이니 한 번만 채운다. 안 채우면 배포
-- 직후 모든 사용자가 온보딩으로 되돌아간다.

ALTER TABLE structured.weddings
  ADD COLUMN setup_completed_at timestamptz;

COMMENT ON COLUMN structured.weddings.setup_completed_at IS
  '초기 설정(5개 질문)을 처음 끝낸 때. NULL이면 아직 안 마쳤다. 예식일·지역이 미정이어도 설정은 끝날 수 있다(v3.19).';

UPDATE structured.weddings
SET setup_completed_at = created_at
WHERE region IS NOT NULL AND setup_completed_at IS NULL;
