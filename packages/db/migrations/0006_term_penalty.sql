-- 위약금 조항을 공개 기준과 견주려면 조항이 숫자로 남아야 한다.
-- 본문만 있으면 "예식일 30일 이내 취소 시 50%"를 매번 다시 읽어야 한다.

ALTER TABLE structured.contract_terms
  -- 이 조항이 적용되기 시작하는 시점 (예식일까지 남은 날). "30일 이내"면 30.
  ADD COLUMN days_before_wedding integer CHECK (days_before_wedding >= 0),
  -- 총액 대비 배상 비율. "50%"면 0.5. 계약금만 몰수하는 조항은 비워둔다.
  ADD COLUMN penalty_rate numeric(4, 3) CHECK (penalty_rate >= 0 AND penalty_rate <= 1);

COMMENT ON COLUMN structured.contract_terms.days_before_wedding IS
  '조항이 적용되는 시점(예식일까지 남은 날). 공정거래위원회 소비자분쟁해결기준과 견주는 데 쓴다.';
COMMENT ON COLUMN structured.contract_terms.penalty_rate IS
  '총액 대비 배상 비율. 0.5는 50%.';
