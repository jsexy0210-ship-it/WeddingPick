-- 분석을 몇 번 다시 돌렸는지.
--
-- 관리자 화면 WP-ADM-010(데이터 · 제보 처리 현황)에 「재처리」와 「전체 재처리」가 있다.
-- 재처리는 실패한 분석을 `pending`으로 되돌려 워커가 다시 집어가게 하는 것인데
-- (worker.ts `claim()`은 `pending`만 집는다), 되돌리고 나면 **그 행이 한 번 실패했다는
-- 사실이 지워진다** — status는 pending이고 failure_reason은 NULL이어야 하므로
-- (0002 `failed_has_reason`), 실패의 흔적이 아무 데도 남지 않는다.
--
-- 그러면 읽을 수 없는 문서 하나가 실패 → 재처리 → 실패를 영원히 돈다. 화면에는
-- 매번 「실패 1건」으로만 보이고, 그게 어제 그 건인지 새로 들어온 건인지 알 수 없다.
-- 「전체 재처리」를 누르는 사람은 그 사실을 모른 채 같은 문서에 계속 돈을 쓴다.
--
-- 세어 두면 셋이 가능해진다 — 화면이 「3번째 실패」라고 적을 수 있고, 전체 재처리가
-- 가망 없는 건을 건너뛸 수 있고, 어떤 문서가 계속 걸리는지 나중에 찾을 수 있다.

ALTER TABLE structured.analyses
  ADD COLUMN retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0);

COMMENT ON COLUMN structured.analyses.retry_count IS
  '관리자가 이 분석을 다시 돌린 횟수. 실패를 pending으로 되돌리면 실패 기록이 지워지므로, 몇 번째 시도인지는 여기에만 남는다.';
