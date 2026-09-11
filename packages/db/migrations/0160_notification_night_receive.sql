-- 야간 수신 스위치. AGENTS.md «WP-NOTI-003 야간 수신 끔»(사용자 승인 2026-09-06)
-- · 시안 13-my-sub WP-MY-007 «알림 수신» 그룹.
--
-- 정책은 2026-09-06에 확정됐는데 켜고 끌 자리가 없었다. 스위치가 없으면 정책은
-- 코드에 적힌 주석일 뿐이고, 스위치만 있고 발송이 안 걸러지면 «꺼놨는데 온다»가
-- 된다 — 눌러도 아무 일이 없는 것보다 나쁘다. 그래서 칸과 발송 조건을 같이 넣는다.

ALTER TABLE structured.notification_settings
  ADD COLUMN night_push_enabled boolean NOT NULL DEFAULT false;

/*
 * **기본이 꺼짐이다.** 다른 스위치(`push_enabled`·`price_change_enabled`)는 행이
 * 없으면 켜진 것으로 보지만 이 칸은 반대다 — 시안이 이 스위치를 꺼진 상태로
 * 그렸고(13-my-sub WP-MY-007), 밤 9시에 울리는 쪽을 기본으로 두면 끄기 전까지는
 * 정책이 없는 것과 같다.
 *
 * 읽는 쪽도 `coalesce(..., false)`로 맞춘다. 한쪽만 바꾸면 행이 있는 사람과 없는
 * 사람의 야간 동작이 갈린다.
 */
COMMENT ON COLUMN structured.notification_settings.night_push_enabled IS
  '야간(한국시간 21:00 이상 ~ 다음 날 08:00 미만) 푸시를 받는가. 꺼져 있으면 그 동안 푸시를 생략한다. 알림함은 그대로 남고 아침에 재발송하지 않는다.';
