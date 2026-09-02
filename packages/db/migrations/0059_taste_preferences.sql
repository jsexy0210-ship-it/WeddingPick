-- 취향. 홈 C-1 시안 1 — 사진 넉 장으로 «어떤 결혼식을 원하세요?»를 받는 자리.
--
-- 지금까지는 계약에도 도메인에도 취향이라는 개념이 없어 기기(AsyncStorage)에만
-- 저장했다 — 새 기기에서는 다시 물었다. 이 마이그레이션이 그 자리를 만든다.
--
-- 행이 없으면 "아직 안 골랐다"로 본다(설정·알림설정과 같은 관례) — 로그인한
-- 모든 사람에게 미리 빈 행을 만들지 않는다.

CREATE TABLE structured.taste_preferences (
  user_id uuid PRIMARY KEY REFERENCES structured.users (id) ON DELETE CASCADE,
  -- 허용값(white/daylight/flower/classic)은 계약(zod)이 지킨다 — 사진 시안이
  -- 늘면 항목도 늘 수 있어 DB에 CHECK로 못박지 않는다.
  tastes text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.taste_preferences IS
  '사용자가 홈에서 고른 취향(사진 넉 장). 행이 없으면 아직 안 고른 것이다.';
