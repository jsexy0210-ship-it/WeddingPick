-- 0052/0053에서 미룬 것: reward_grants가 monthly_draw 지급도 구분하게 한다.
--
-- 0053에서 더한 `reward_kind.monthly_draw`는 이제 다른 트랜잭션에서 안전하게 쓸 수
-- 있다. 네 source(referral·promotion·monthly_draw 둘) 중 실제 kind와 맞는 것만
-- 채워져 있는지 다시 검사한다.
--
-- `kind = 'monthly_draw'`는 `draw_entry_id`(0047, `monthly_draw_entries` 참조)만
-- 본다 — `routes/rewards.ts`가 실제로 채우는 컬럼이 그거다. 0052가 더한
-- `mission_draw_entry_id`는 앱 코드가 아직 안 쓰는 별도 스키마라 여기서 kind와
-- 엮지 않는다(위 0052 주석 참고). NULL이 아니면 그 자체로 grant_has_exactly_one_source가
-- 이미 막는다.

ALTER TABLE structured.reward_grants
  DROP CONSTRAINT grant_source_matches_kind;

ALTER TABLE structured.reward_grants
  ADD CONSTRAINT grant_source_matches_kind
    CHECK (
      (kind = 'referral')     = (referral_id   IS NOT NULL) AND
      (kind = 'promotion')    = (promotion_id  IS NOT NULL) AND
      (kind = 'monthly_draw') = (draw_entry_id IS NOT NULL)
    );
