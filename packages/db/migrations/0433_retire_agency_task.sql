-- 웨딩일정 기본 할 일 「결정사 가입」(preset_key = 'agency_join')을 걷는다.
--
-- 2026-09-24 대표 지시 — 「웨딩픽은 플래너 없이 누구나 예약 가능한 웨딩 플랫폼이다.
-- 고로 결정사 따윈 필요없다」. 도메인 TASK_PRESETS에서 뺐으므로 새 웨딩에는 깔리지
-- 않는다. 이미 깔린 행만 남는다.
--
-- **사용자가 손대지 않은 행만 지운다.** 날짜 · 업체 · 직접 지정 상태 가운데 하나라도
-- 있으면 사용자가 쓴 기록이라 남긴다 — 기본값을 걷는 것이지 사용자의 기록을 지우는
-- 것이 아니다. 0432는 열린 PR #520이 예약했다.

DELETE FROM structured.wedding_tasks
WHERE preset_key = 'agency_join'
  AND due_date IS NULL
  AND vendor_id IS NULL
  AND vendor_label IS NULL
  AND state_override IS NULL;

-- 웨딩피드 카테고리 「결정사」도 걷는다(0421이 넣었다). 도메인 WEDDING_FEED_TOPICS에서
-- 결정사 주제를 뺐으므로 새 글이 이 카테고리를 달 일이 없다. **이미 그 카테고리를 단
-- 글이 있으면 남긴다** — 카테고리를 지우면 그 글이 「전체」에만 뜨게 되는데, 글을
-- 내릴지는 관리자가 정할 일이다.
DELETE FROM structured.wedding_feed_categories c
WHERE c.name = '결정사'
  AND NOT EXISTS (
    SELECT 1 FROM structured.wedding_feed_posts p
    WHERE p.category_id = c.id OR p.category_label = c.name
  );
