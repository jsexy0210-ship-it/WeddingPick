-- 후기 확인 단계를 결제인증에 맞춘다.
--
-- 0020은 'receipt'(영수증 확인)를 L1(견적인증)에 붙였다. 두 번 틀렸다:
--
--   L1은 "실제 견적자료 확인"이지 영수증이 아니다. 이름부터 맞지 않았다.
--   그리고 견적서를 받은 것과 그 업체를 이용한 것은 다른 일이다. 상담만 받고
--   계약하지 않은 사람의 후기에 확인 배지가 붙고 있었다.
--
-- 이제 그 자리에 결제인증(0022)이 들어간다. 결제인증이 있으면 그 사람이 그 업체에
-- 돈을 낸 것은 사실이고, "실제로 이용했다"에는 그것으로 충분하다.

ALTER TYPE review_verification RENAME VALUE 'receipt' TO 'payment';

COMMENT ON TYPE review_verification IS
  '후기가 어디까지 확인됐는지. payment는 결제인증(등록), contract는 인증 심사를 통과한 계약 문서(사람 확인).';

/*
 * 어디로 확인했는지.
 *
 * 0020은 계약 문서(verified_quote_id)만 가리킬 수 있었다. 이제 결제인증으로도
 * 확인되므로 가리킬 곳이 하나 더 필요하다.
 */
ALTER TABLE structured.reviews
  ADD COLUMN verified_payment_proof_id uuid
    REFERENCES structured.payment_proofs (id) ON DELETE SET NULL;

/*
 * 확인의 근거가 실제로 있어야 한다.
 *
 * 0020의 verification_has_evidence는 "확인됐으면 확인 시각과 확인한 사람이 있다"까지만
 * 봤다. 무엇으로 확인했는지는 보지 않았다 — verified_quote_id도 결제인증도 없이
 * 'contract'인 행을 만들 수 있었다는 뜻이다. 여기서 막는다.
 *
 * 결제인증에는 확인한 '사람'이 없다. 심사가 아니라 등록이라서다. 그래서
 * verified_by는 계약 확인일 때만 요구한다 — 없는 사람을 지어내 채우느니
 * 없다고 두는 편이 맞다.
 */
ALTER TABLE structured.reviews DROP CONSTRAINT verification_has_evidence;

ALTER TABLE structured.reviews
  ADD CONSTRAINT verification_names_its_evidence CHECK (
    CASE verification
      WHEN 'unverified' THEN
        verified_at IS NULL
        AND verified_by IS NULL
        AND verified_quote_id IS NULL
        AND verified_payment_proof_id IS NULL
      WHEN 'payment' THEN
        verified_at IS NOT NULL
        AND verified_payment_proof_id IS NOT NULL
        AND verified_quote_id IS NULL
      WHEN 'contract' THEN
        verified_at IS NOT NULL
        -- 계약 확인은 사람이 심사한 것이다. 심사자가 반드시 남는다.
        AND verified_by IS NOT NULL
        AND verified_quote_id IS NOT NULL
    END
  );

COMMENT ON CONSTRAINT verification_names_its_evidence ON structured.reviews IS
  '확인 배지는 근거를 가리켜야 한다. 계약 확인에는 심사자가, 결제 확인에는 결제인증이 있어야 한다.';
