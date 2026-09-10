-- 업체 병합 · 영업 정지를 담을 자리.
--
-- 관리자 화면 WP-ADM-014(데이터 · 업체 관리)는 업체 상태를 넷으로 그린다 —
-- 영업중 · 폐업 · 정지 · 병합됨. 그런데 표에는 `is_active`(0047)뿐이라 뒤의 둘을
-- 적을 곳이 없었다. 없는 칸을 화면이 그리고 있었던 셈이고, 그래서 「상태 변경」
-- 단추는 눌러도 남길 데가 없었다.
--
-- 상태를 새 컬럼 하나로 두지 않고 기존 `is_active`에 이유를 덧붙이는 쪽을 골랐다.
-- 검색 · 비교 · 상세가 전부 `WHERE is_active`로 걸러 읽고 있어서(0047의
-- vendors_is_active_idx), 상태를 딴 곳에 두면 두 값이 어긋나는 날이 온다.
-- 정지든 병합이든 「사용자에게 보이지 않는다」는 같으므로 `is_active = false`이고,
-- **왜** 안 보이는지를 아래 두 컬럼이 나눠 적는다.

ALTER TABLE structured.vendors
  -- 병합된 업체가 어디로 흡수됐는지. 병합은 되돌릴 수 없으므로 흡수한 쪽을
  -- 지우려 하면 막는다(RESTRICT) — SET NULL이면 「병합됐다」는 사실만 남고
  -- 어디로 갔는지가 사라져 재귀속 이력이 끊긴다.
  ADD COLUMN merged_into_vendor_id uuid REFERENCES structured.vendors (id) ON DELETE RESTRICT,
  -- 관리자가 노출을 멈춘 시각. 폐업(closed_at)과 구분한다 — 폐업은 업체가 없어진
  -- 것이고 정지는 우리가 잠시 내린 것이라, 되돌리는 조건도 판단하는 사람도 다르다.
  ADD COLUMN suspended_at timestamptz;

-- 0047은 「영업 중이 아니면 폐업일이 있어야 한다」였다. 이제 안 보이는 이유가
-- 셋이므로, 셋 중 하나는 반드시 적혀 있어야 한다로 넓힌다. 이유 없이 내려가 있는
-- 업체를 막는다는 원래 뜻은 그대로다.
ALTER TABLE structured.vendors
  DROP CONSTRAINT vendors_closed_requires_date;

ALTER TABLE structured.vendors
  ADD CONSTRAINT vendors_inactive_requires_reason
    CHECK (
      is_active
      OR closed_at IS NOT NULL
      OR suspended_at IS NOT NULL
      OR merged_into_vendor_id IS NOT NULL
    );

-- 영업 중인 업체는 정지 상태일 수 없다. 둘 다 참인 행이 생기면 화면이 어느 쪽을
-- 그려야 할지 알 수 없다.
ALTER TABLE structured.vendors
  ADD CONSTRAINT vendors_active_is_not_suspended
    CHECK (NOT (is_active AND suspended_at IS NOT NULL));

-- 병합된 업체는 노출되지 않는다. 흡수된 쪽이 계속 검색에 나오면 같은 업체가 둘로
-- 보인다 — 병합으로 없애려던 바로 그 상태다.
ALTER TABLE structured.vendors
  ADD CONSTRAINT vendors_merged_is_inactive
    CHECK (merged_into_vendor_id IS NULL OR NOT is_active);

-- 자기 자신으로는 병합할 수 없다. 그러면 상태가 「병합됨」인데 갈 곳이 자기라서
-- 이력을 따라가면 제자리를 돈다.
ALTER TABLE structured.vendors
  ADD CONSTRAINT vendors_merge_target_is_not_self
    CHECK (merged_into_vendor_id IS NULL OR merged_into_vendor_id <> id);

COMMENT ON COLUMN structured.vendors.merged_into_vendor_id IS
  '이 업체를 흡수한 업체. NULL이 아니면 상태는 «병합됨»이고 제보·후기·Pick·이미지는 이미 그쪽으로 옮겨졌다.';

COMMENT ON COLUMN structured.vendors.suspended_at IS
  '관리자가 노출을 멈춘 시각. 폐업(closed_at)과 다르다 — 업체는 영업 중이고 우리 판단으로 내린 것이다.';

-- 「병합됨」 업체를 찾는 질문은 거의 언제나 「어디로 갔나」와 같이 온다.
CREATE INDEX vendors_merged_into_idx
  ON structured.vendors (merged_into_vendor_id)
  WHERE merged_into_vendor_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 변경 이력에 사유를 적을 칸.
-- ---------------------------------------------------------------------------
--
-- 0048 vendor_change_log는 「무엇이 무엇에서 무엇으로」까지만 적는다. 되돌릴 수
-- 없는 조작(병합)은 그것으로 부족하다 — 나중에 따질 때 필요한 것은 바뀐 값이
-- 아니라 **왜 그렇게 판단했는가**이고, 그건 old_value/new_value 어디에도 안 들어간다.
-- v3.27 관리자 공통 규칙의 「위험한 조작은 한 번 더 확인」은 확인만 받고 끝나는
-- 것이 아니라 그때 받은 사유가 남아야 뜻이 있다.

ALTER TABLE structured.vendor_change_log
  ADD COLUMN note text;

COMMENT ON COLUMN structured.vendor_change_log.note IS
  '관리자가 적은 사유. 병합처럼 되돌릴 수 없는 조작에서 받는다. 값의 변화(old_value·new_value)와 달리 판단의 근거를 적는다.';
