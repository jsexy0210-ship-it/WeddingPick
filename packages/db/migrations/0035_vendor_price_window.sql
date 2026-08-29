-- 업체별 최근 12개월 결제 요약. 최종통합정책 v2.0 C-1.
--
-- 검색이 가격으로 정렬하고 목록에 구간을 실으려면 업체마다 이 값이 필요하다.
-- 뷰로 두는 이유는 **기간과 자격 조건을 한곳에만 적기 위해서**다 — 검색과 상세가
-- 각자 적으면 언젠가 한쪽만 바뀌고, 같은 업체가 화면에 따라 다른 구간을 갖는다.
--
-- 중앙값이나 단계는 여기서 만들지 않는다. 몇 건부터 무엇을 보여줄지는 도메인의
-- 사다리가 정하고(0~2/3~4/5~9/10건+), SQL은 재료만 낸다. 규칙을 둘로 나누면
-- 언젠가 둘이 어긋난다.

CREATE VIEW structured.vendor_paid_window AS
SELECT
  p.vendor_id,
  count(*) AS proof_count,
  /*
   * 정렬에 쓰는 대표값. 최저·최고가 아니라 분포의 허리를 쓴다 — 3억짜리 한 건이
   * 업체를 목록 맨 뒤로 보내지 않게.
   */
  percentile_cont(0.5) WITHIN GROUP (ORDER BY p.paid_amount)::bigint AS median_amount,
  min(p.paid_at) AS first_paid_at,
  max(p.paid_at) AS last_paid_at
FROM structured.usable_payment_proofs p
WHERE p.paid_at >= now() - interval '12 months'
GROUP BY p.vendor_id;

COMMENT ON VIEW structured.vendor_paid_window IS
  '업체별 최근 12개월 결제인증 요약. 기간과 자격 조건을 여기 한곳에만 적는다. 공개 단계는 도메인이 정한다.';
