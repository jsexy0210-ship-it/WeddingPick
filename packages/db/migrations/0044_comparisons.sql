-- 비교한 적이 있는가. 통합정책 v3.7 최신 §9의 미션 ③.
--
-- 미션 `비교해보기`는 **비교할 수 있는 상태**가 아니라 **비교해본 사실**이다.
-- 후보 두 곳을 담았다고 비교한 것은 아니다 — 버튼이 옆에 있는 것과 눌러본 것은
-- 다르고, 미션은 눌러보게 하려고 있는 장치다.
--
-- 업종별로 남긴다. 웨딩홀을 비교한 사람과 드레스를 비교한 사람은 다른 곳까지
-- 온 것이고, 다음에 무엇을 권할지가 달라진다.

CREATE TABLE structured.comparisons (
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,
  category vendor_category NOT NULL,

  /** 처음 비교한 때. 몇 번 비교했는지는 세지 않는다 — 미션은 한 번이면 된다. */
  first_compared_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (wedding_id, category)
);

COMMENT ON TABLE structured.comparisons IS
  '업종별로 비교해본 사실. 비교할 수 있는 상태가 아니라 실제로 비교한 사실을 남긴다.';
