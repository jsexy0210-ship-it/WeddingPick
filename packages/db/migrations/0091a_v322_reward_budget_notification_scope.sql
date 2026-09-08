-- 핸드오프 v3.22(2026-09-08) — «이벤트 예산 · 월 50만원» · SPEC 13.12 «알림 범위».
--
-- 0091이 더한 `reward_kind.mission`은 이제 다른 트랜잭션이라 안전하게 쓸 수 있다.
--
-- 2. reward_grants가 근거 없는 종류(mission)를 담을 수 있게 제약을 푼다.
-- 3. 한 사람은 미션 완주 보상을 한 번만 받는다 — 부분 유니크 인덱스.
-- 4. notifications에 주제(topic)를 둔다 — 하루 한도와 «진행 중 업종만» 규칙이 본다.
--
-- ---------------------------------------------------------------------------
-- 2. 근거 제약
-- ---------------------------------------------------------------------------
--
-- 미션 완주는 초대·홍보 글·응모 행 같은 근거 행이 없다 — 근거는 사용자 자신의 상태
-- (설정 완료 · Pick · 배우자 연결 · Pick 인증)다. 그래서 «근거 정확히 하나»는
-- 미션이 아닐 때만 지키고, 미션이면 근거가 하나도 없어야 한다.

ALTER TABLE structured.reward_grants
  DROP CONSTRAINT IF EXISTS grant_has_exactly_one_source;

ALTER TABLE structured.reward_grants
  ADD CONSTRAINT grant_has_exactly_one_source CHECK (
    (referral_id   IS NOT NULL)::int
    + (promotion_id IS NOT NULL)::int
    + (draw_entry_id IS NOT NULL)::int
    = CASE WHEN kind = 'mission' THEN 0 ELSE 1 END
  );

ALTER TABLE structured.reward_grants
  DROP CONSTRAINT IF EXISTS grant_source_matches_kind;

ALTER TABLE structured.reward_grants
  ADD CONSTRAINT grant_source_matches_kind
    CHECK (
      (kind = 'referral')     = (referral_id   IS NOT NULL) AND
      (kind = 'promotion')    = (promotion_id  IS NOT NULL) AND
      (kind = 'monthly_draw') = (draw_entry_id IS NOT NULL)
    );

-- ---------------------------------------------------------------------------
-- 3. 미션 완주는 1인 1회
-- ---------------------------------------------------------------------------
--
-- 다른 종류는 근거 행의 UNIQUE가 중복을 막는다. 미션은 근거 행이 없으므로 여기서
-- 막는다 — 코드의 «이미 있나» 확인은 동시에 두 번 눌리는 경우를 못 잡는다.

CREATE UNIQUE INDEX reward_grants_one_mission_per_user
  ON structured.reward_grants (user_id)
  WHERE kind = 'mission';

-- ---------------------------------------------------------------------------
-- 4. 알림 주제
-- ---------------------------------------------------------------------------
--
-- `kind`는 알림함에서 어떻게 보이는지고, `topic`은 왜 보내는지다. 일정 알림과
-- 가격 변동 알림은 둘 다 `notice`로 보이지만 하나는 항상 가고 하나는 하루 2건
-- 한도에 든다 — 그 차이를 kind에 실으면 알림함 이름이 정책에 끌려다닌다.
--
-- 값은 도메인 NOTIFICATION_TOPICS와 같다. NULL은 이 컬럼이 생기기 전의 알림이거나
-- 주제를 정하지 않은 알림이다 — 한도를 셀 때 NULL은 «모르는 것»이라 센다.

ALTER TABLE structured.notifications
  ADD COLUMN topic text
    CHECK (topic IS NULL OR topic IN (
      'schedule', 'pick_candidates', 'price_change', 'benefit',
      'verification', 'partner', 'other'
    ));

COMMENT ON COLUMN structured.notifications.topic IS
  '왜 보낸 알림인지(SPEC 13.12). schedule·verification·partner는 항상 가고 나머지는 하루 2건 한도에 든다. NULL은 주제 미상 — 한도에 센다.';

-- 하루 한도를 셀 때 «오늘 이 사람에게 간 것»만 본다.
CREATE INDEX notifications_user_day_idx
  ON structured.notifications (user_id, created_at DESC)
  INCLUDE (kind, topic);
