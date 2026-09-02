-- 0052/0053에서 미룬 것: reward_grants가 monthly_draw 지급도 구분하게 한다.
--
-- 0053에서 더한 `reward_kind.monthly_draw`는 이제 다른 트랜잭션에서 안전하게 쓸 수
-- 있다. 세 source(referral·promotion·monthly_draw) 중 실제 kind와 맞는 것만
-- 채워져 있는지 다시 검사한다.

ALTER TABLE structured.reward_grants
  DROP CONSTRAINT grant_source_matches_kind;

ALTER TABLE structured.reward_grants
  ADD CONSTRAINT grant_source_matches_kind
    CHECK (
      (kind = 'referral')     = (referral_id   IS NOT NULL) AND
      (kind = 'promotion')    = (promotion_id  IS NOT NULL) AND
      (kind = 'monthly_draw') = (draw_entry_id IS NOT NULL)
    );
