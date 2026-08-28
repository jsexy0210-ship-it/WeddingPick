-- 실제 결제 분포를 볼 자격. 사업계획서 v3 7번 Level 3.
--
-- "유효 제보 1건 이상"이 조건이다. 자료를 내놓은 사람이 자료를 본다 — 이 서비스가
-- 가진 유일한 자산이 실제 결제 데이터이고, 그건 낸 사람들이 만든 것이다.
--
-- **수기 제보로는 열리지 않는다.** price_reports는 문서 없이 숫자만 적는 것이라,
-- 그것으로 문이 열리면 아무 숫자나 넣고 남의 결제 분포를 볼 수 있다. 잠겨 있지
-- 않은 문을 잠갔다고 부르는 것보다 안 잠그는 편이 낫다.
--
-- 뷰로 두는 이유는 컬럼으로 두면 낡기 때문이다. 제보가 지워지면 자격도 사라져야
-- 하는데, 컬럼이면 그 순간 누군가 갱신을 잊는다.

CREATE VIEW structured.data_unlocks AS
SELECT reporter_user_id AS user_id, count(*) AS proof_count
FROM structured.usable_payment_proofs
GROUP BY reporter_user_id;

COMMENT ON VIEW structured.data_unlocks IS
  '실제 결제 분포를 볼 자격이 있는 사용자. 업체가 매칭된 결제인증 1건 이상. 수기 제보는 세지 않는다.';
