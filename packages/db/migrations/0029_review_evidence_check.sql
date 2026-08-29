-- 후기 근거 확인 규칙을 네 단계에 맞춘다.
--
-- 0028이 'usage'를 더했다. 같은 트랜잭션에서는 방금 더한 enum 값을 쓸 수 없어
-- 파일을 나눴다.

/*
 * 근거 확인 규칙을 새 단계까지 넓힌다.
 *
 * 0023의 CASE에는 ELSE가 없었다. 값을 하나 더하면 그 값은 CASE에서 NULL이 되고,
 * **NULL은 CHECK를 통과한다.** 즉 'usage' 후기는 근거 없이 만들 수 있었다.
 * enum에 값을 더하는 것만으로 제약이 조용히 뚫린 셈이다.
 *
 * 그래서 ELSE false를 둔다. 다음에 값을 하나 더 더하면 이번에는 조용히 통과하는
 * 대신 그 자리에서 막힌다 — 막히는 편이 낫다.
 */
ALTER TABLE structured.reviews DROP CONSTRAINT verification_names_its_evidence;

ALTER TABLE structured.reviews
  ADD CONSTRAINT verification_names_its_evidence CHECK (
    CASE verification
      WHEN 'reported' THEN
        verified_at IS NULL
        AND verified_by IS NULL
        AND verified_quote_id IS NULL
        AND verified_payment_proof_id IS NULL
      WHEN 'payment' THEN
        verified_at IS NOT NULL
        AND verified_payment_proof_id IS NOT NULL
        AND verified_quote_id IS NULL
      -- 계약·이용 인증은 사람이 심사한 것이다. 심사자가 반드시 남는다.
      WHEN 'contract' THEN
        verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_quote_id IS NOT NULL
      WHEN 'usage' THEN
        verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_quote_id IS NOT NULL
      ELSE false
    END
  );

COMMENT ON CONSTRAINT verification_names_its_evidence ON structured.reviews IS
  '확인 배지는 근거를 가리켜야 한다. ELSE false — 새 단계를 더하면 여기서 막힌다.';
