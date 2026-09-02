-- 임시조치는 저절로 끝난다. 정보통신망법 제44조의2.
--
-- 0020이 30일 상한을 트리거로 지켰다. 그런데 그 트리거가 막는 것은 **더 긴 기간을
-- 적어 넣는 일**뿐이고, 기간이 지났다고 글이 돌아오지는 않았다. `visible_reviews`가
-- `status = 'published'`만 보기 때문이다.
--
-- 그래서 아무도 손대지 않으면 임시조치가 영영 풀리지 않는다. **법이 정한 상한이
-- 실질적으로 무한이 된다** — 업체는 이의 한 번으로 불리한 후기를 영구히 내릴 수 있고,
-- 그건 반론권이 아니라 검열이다. 0020이 막으려던 바로 그 일이다.
--
-- 고치는 방법이 둘이었다.
--
--   1. 만료된 것을 되돌리는 작업을 주기적으로 돌린다
--   2. 보이는지 여부를 저장하지 않고 **계산한다**
--
-- 2번을 고른다. 1번은 작업이 멈추면 다시 영구 삭제가 되고, 멈춘 것을 아무도 모른다.
-- 원본 파기 일정을 계산으로 둔 것과 같은 이유다(0018) — "확인과 심사가 끝날 때마다
-- 달라지는 값이라, 저장해두면 낡는다."
--
-- 저장된 `status`는 사람이 정한 것 그대로 둔다. 여기서 만드는 것은 **지금 이 순간
-- 실제로 보이는가**이고, 둘은 다른 질문이다.

CREATE VIEW structured.review_visibility AS
SELECT
  r.id AS review_id,
  r.status AS recorded_status,
  r.objection_hold_until,
  CASE
    -- 기간이 지난 임시조치는 끝난 임시조치다. 사람의 손을 기다리지 않는다.
    WHEN r.status = 'under_objection' AND r.objection_hold_until <= now() THEN 'published'
    ELSE r.status::text
  END AS effective_status
FROM structured.reviews r;

COMMENT ON VIEW structured.review_visibility IS
  '지금 이 순간 후기가 보이는가. 저장된 status와 다른 질문이다 — 기간이 지난 임시조치는 끝난 것으로 계산한다.';

/*
 * 보이는 후기와 점수에 들어가는 후기가 같은 계산을 쓴다.
 *
 * 둘이 각자 조건을 적으면 언젠가 한쪽만 고쳐지고, 그러면 화면에는 보이는데 점수에는
 * 안 들어가는(또는 그 반대인) 후기가 생긴다. 어느 쪽이 맞는지 아무도 답할 수 없다.
 */
CREATE OR REPLACE VIEW structured.visible_reviews AS
SELECT
  r.id,
  r.vendor_id,
  r.author_user_id,
  r.role,
  r.overall,
  r.title,
  r.body,
  r.pros,
  r.cons,
  r.verification,
  r.verified_quote_id,
  r.verified_at,
  r.verified_by,
  r.status,
  r.objection_hold_until,
  r.created_at,
  r.updated_at
FROM structured.reviews r
JOIN structured.review_visibility v ON v.review_id = r.id
WHERE v.effective_status = 'published';

CREATE OR REPLACE VIEW structured.scored_reviews AS
SELECT
  r.id,
  r.vendor_id,
  r.role,
  r.overall,
  r.verification,
  r.created_at
FROM structured.reviews r
JOIN structured.review_visibility v ON v.review_id = r.id
WHERE v.effective_status = 'published'
  AND r.verification <> 'reported'::review_verification;

COMMENT ON VIEW structured.visible_reviews IS
  '화면에 보이는 후기. 미인증도 보이지만 이의 확인 중인 글은 보이지 않는다 — 기간이 지나면 다시 보인다.';
COMMENT ON VIEW structured.scored_reviews IS
  '이용점수에 들어가는 후기. 보이는 것 중 확인된 것만. 서비스정책서 5번.';
