-- 공공데이터 킬 스위치 — sbiz 두 출처 행 추가
-- ---------------------------------------------------------------------------
--
-- 토요일 크론(`public-data.yml`)이 `sbiz-seoul` · `sbiz-gyeonggi`를 매주 적용하는데
-- `import_switches`에 그 두 행이 없었다. `public-data/sync.ts`는 **행이 없으면
-- 막는다**(`enabled.rows[0]?.enabled !== true` → `SOURCE_DISABLED`). 그래서 수집이
-- 매주 전량 실패하고 공공데이터가 한 건도 들어오지 않았다(Release Audit 1차 P1-11).
--
-- 켠 상태로 넣는다. 끄고 싶으면 관리자 화면에서 끈다 — 없어서 막히는 것과
-- 사람이 껐기 때문에 막히는 것은 다른 상태여야 한다.

INSERT INTO structured.import_switches (source_key, enabled, reason)
VALUES
  ('sbiz-seoul', true, '주간 수집 대상 — 행이 없어 매주 SOURCE_DISABLED로 막히던 것을 연다'),
  ('sbiz-gyeonggi', true, '주간 수집 대상 — 행이 없어 매주 SOURCE_DISABLED로 막히던 것을 연다')
ON CONFLICT (source_key) DO NOTHING;
