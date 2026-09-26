-- 웨딩일정 기본 할 일을 «한 번만» 깐다 — 다 지워도 다시 깔지 않는다.
--
-- 2026-09-26 대표 지시 — 웨딩일정 타임라인의 할 일(예식일 기준 임시 날짜 줄 포함)을 고치고
-- 지운다. 지금까지 `seedPresets`는 «할 일이 하나도 없으면» 기본 열셋을 깔았다. 하나씩 지우는
-- 것은 괜찮았지만 **마지막 하나를 지우면 다음에 목록을 열 때 열셋이 전부 되살아났다** —
-- 지우는 일이 아무 뜻이 없어진다(`seedPresets` 주석이 막으려던 바로 그것).
--
-- 그래서 «깔았다»는 사실을 웨딩에 적는다. 이미 할 일이 있는 웨딩은 깐 적이 있는 것이므로
-- 지금 시각으로 채운다. 할 일이 하나도 없는 옛 웨딩은 비워 둔다 — 다음에 열 때 한 번 깔리고
-- (지금까지와 같다) 그 뒤로는 다시 깔지 않는다.

ALTER TABLE structured.weddings
  ADD COLUMN tasks_seeded_at timestamptz;

UPDATE structured.weddings w
SET tasks_seeded_at = now()
WHERE tasks_seeded_at IS NULL
  AND EXISTS (SELECT 1 FROM structured.wedding_tasks t WHERE t.wedding_id = w.id);
