-- 기능 중지 스위치를 DB로 옮긴다.
--
-- 지금까지 `routes/admin.ts`의 인메모리 Map에 있었다. 두 가지가 문제였다.
--
--   1. 재시작하면 사라진다. 껐다는 사실이 남지 않는다.
--   2. **아무도 읽지 않는다.** 관리자가 「껐다」고 보는데 기능은 계속 돈다.
--
-- 2번이 특히 나쁘다. 사고가 났을 때 끈 줄 알고 손을 놓게 만든다. 그래서 이 표는
-- `wired` 컬럼을 함께 둔다 — **이 스위치를 실제로 읽는 코드가 있는가.** false면
-- 꺼도 아무 일이 일어나지 않는다는 뜻이고, 관리자 화면이 그 사실을 그대로 보여준다.
-- 모르는 채로 껐다고 믿는 것보다 낫다.
--
-- 수집 출처 스위치는 `structured.import_switches`(0049)에 따로 있다. 그쪽은 출처가
-- 늘고 주는 목록이라 행이 데이터고, 이쪽은 기능마다 코드가 붙는 고정 목록이다.

CREATE TABLE structured.kill_switches (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  description text        NOT NULL,
  category    text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT true,
  wired       boolean     NOT NULL DEFAULT false,
  reason      text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

COMMENT ON TABLE structured.kill_switches IS
  '기능별 중지 스위치. enabled = false이면 그 기능이 명시적으로 멈춘다(조용히 성공하지 않는다).';

COMMENT ON COLUMN structured.kill_switches.wired IS
  '이 스위치를 읽는 코드가 실제로 있는가. false면 껐다 켜도 동작이 바뀌지 않는다.';

INSERT INTO structured.kill_switches (id, name, description, category, wired) VALUES
  ('ai-recommendations', 'AI 추천',   'AI 기반 업체 추천 기능을 중지합니다',        'AI',   true),
  ('ai-verification',    'AI 검증',   '문서 AI 자동 검증을 중지합니다',             'AI',   true),
  ('reward-payout',      '보상 지급', '친구 초대·홍보 보상 자동 지급을 중지합니다', '운영', true),
  ('ai-matching',        'AI 매칭',   '이메일 자동 매칭을 중지합니다',              'AI',   false),
  ('stats-update',       '통계 반영', '가격 통계 자동 갱신을 중지합니다',           '운영', false),
  ('auto-publish',       '자동 게시', '후기·반론 자동 게시를 중지합니다',           '운영', false);
