-- 자동으로 가린 후기를 되살릴 길. 최종통합정책 v2.0 원문 23·24번.
--
-- 0033이 위험정보를 규칙으로 가리게 만들면서 **작성자에게 "지우고 다시
-- 올려주세요"라고 말했다.** 그런데 후기를 고칠 길이 없고 가린 것을 되돌릴 길도
-- 없었다 — 지키지 못할 말을 한 셈이다. 이 마이그레이션이 그 말을 지킬 수 있게 한다.

/*
 * 규칙이 가린 것인가, 사람이 가린 것인가.
 *
 * 둘을 갈라두지 않으면 작성자가 **법적 분쟁으로 사람이 내린 임시조치까지 스스로
 * 풀 수 있게 된다.** 규칙이 가린 것만 작성자가 고쳐서 되살릴 수 있다.
 *
 * 사람이 가린 것은 여기가 NULL이고, 사람만 되돌릴 수 있다.
 */
ALTER TABLE structured.reviews
  ADD COLUMN auto_hidden_at timestamptz;

ALTER TABLE structured.reviews
  ADD CONSTRAINT auto_hidden_only_while_hidden
    CHECK (auto_hidden_at IS NULL OR status = 'under_objection');

COMMENT ON COLUMN structured.reviews.auto_hidden_at IS
  '규칙이 위험정보를 찾아 가린 시각. 사람이 내린 임시조치는 NULL이고, 그건 작성자가 풀 수 없다.';

CREATE INDEX reviews_auto_hidden_idx ON structured.reviews (auto_hidden_at)
  WHERE auto_hidden_at IS NOT NULL;
