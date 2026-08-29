-- 후기 확인 배지를 핸드오프 목록에 맞춘다.
--
-- 디자인 핸드오프 8번의 인증후기 배지: 계약인증 · 이용인증 · 상담제보.
-- 카피 규칙의 배지 목록에는 결제인증도 있다. 둘을 합치면 네 단계다:
--
--   상담제보 → 결제인증 → 계약인증 → 이용인증
--
-- 지금은 셋(미인증·결제·계약)이라 '이용인증'이 빠져 있었다. 이용인증은 L3 문서
-- (실제 이용 확인)가 근거다 — 계약했다는 것과 실제로 그 자리에서 결혼식을 올렸다는
-- 것은 다른 사실이고, 후기의 무게도 다르다.
--
-- 'unverified'를 'reported'로 바꾼다. 화면에 나가는 말이 "미인증"이 아니라
-- "상담제보"가 되기 때문이다 — 아무 근거가 없다는 뜻이 아니라, 이 사람이 겪은 일을
-- 적었다는 뜻이다.

ALTER TYPE review_verification RENAME VALUE 'unverified' TO 'reported';
ALTER TYPE review_verification ADD VALUE 'usage' AFTER 'contract';

COMMENT ON TYPE review_verification IS
  '후기 확인 단계. 상담제보 → 결제인증(등록) → 계약인증(심사) → 이용인증(심사). 뒤로 갈수록 근거가 무겁다.';

-- 제약을 새 값에 맞춰 다시 세우는 일은 0029가 한다. 같은 트랜잭션에서 방금 더한
-- enum 값을 쓸 수 없다("unsafe use of new value") — 파일을 나눠야 한다.
