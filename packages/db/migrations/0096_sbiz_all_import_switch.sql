-- 전국 수집 출처 `sbiz-all`의 임포트 스위치를 켠다.
--
-- `sync.ts`의 syncOne은 `import_switches`에 enabled=true 행이 없으면
-- SOURCE_DISABLED로 던진다 — 행이 없으면 수집은 성공하고 DB 반영만 전량
-- 실패해서 조용히 지나간다(0092a · 0094가 같은 이유로 있었다).
--
-- 이용허락은 시도 출처와 같은 데이터셋이라 같다:
-- 소상공인시장진흥공단_상가(상권)정보, 이용허락범위 제한 없음.
INSERT INTO structured.import_switches(source_key, enabled, reason)
VALUES ('sbiz-all', true, '전국 웨딩업종 전수 수집 — 시도별로 나누면 같은 전국 응답을 17번 내려받는다')
ON CONFLICT(source_key) DO NOTHING;
