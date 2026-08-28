-- 파기 일정 알림.
--
-- 원본을 지우는 것은 사람이 한다. 그러려면 지울 때가 됐다는 것을 사람이 알아야
-- 하고, 알리는 일은 기계가 해야 한다 — 사람이 달력을 보고 있기를 기대하는 것은
-- 절차가 아니다. 서비스정책서 4번이 요구하는 "알림"의 자동화다.

-- ---------------------------------------------------------------------------
-- 1. 누가 운영자인가
-- ---------------------------------------------------------------------------
--
-- 알림을 보내려면 받을 사람을 알아야 한다. 지금까지 운영은 "서버에 접근할 수
-- 있는 사람"이라는 암묵적 정의로 돌아갔는데, 푸시는 특정 기기로 가므로 그
-- 정의로는 부족하다.
--
-- 역할 체계를 크게 만들지 않는다. 지금 필요한 구분은 하나뿐이다.

ALTER TABLE structured.users
  ADD COLUMN is_operator boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN structured.users.is_operator IS
  '운영 알림을 받고 파기를 집행하는 사람. 사람이 직접 켠다 — 가입이나 어떤 자동 경로로도 켜지지 않는다.';

-- 운영자는 사람이 DB에서 직접 켠다. 앱에도 API에도 이 값을 바꾸는 길이 없다.
CREATE INDEX users_operator_idx ON structured.users (id) WHERE is_operator;

-- ---------------------------------------------------------------------------
-- 2. 어디로 보내나
-- ---------------------------------------------------------------------------

CREATE TABLE structured.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  -- Expo 푸시 토큰. 기기마다 하나이고, 앱을 지우거나 다시 깔면 바뀐다.
  token text NOT NULL CHECK (length(btrim(token)) > 0),
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  /*
   * 보내봤더니 죽은 토큰이었을 때 끄는 자리. 지우지 않고 남기는 것은, 같은
   * 토큰이 다시 살아나는 경우가 있어서다(앱 재설치 등). 죽었다고 판단한 근거도
   * 함께 남는다.
   */
  disabled_at timestamptz,
  disabled_reason text,

  CONSTRAINT disabled_has_reason
    CHECK ((disabled_at IS NULL) = (disabled_reason IS NULL))
);

-- 한 기기가 두 번 등록되면 알림이 두 번 간다.
CREATE UNIQUE INDEX device_tokens_token_idx ON structured.device_tokens (token);
CREATE INDEX device_tokens_user_idx ON structured.device_tokens (user_id) WHERE disabled_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. 무엇을 언제 보냈나
-- ---------------------------------------------------------------------------
--
-- 같은 말을 반복해서 보내면 사람은 알림을 끈다. 그러면 알림이 있으나 마나가
-- 된다. 그래서 마지막으로 무엇을 알렸는지 남기고, 그때보다 일이 늘었거나
-- 충분히 시간이 지났을 때만 다시 보낸다.

CREATE TABLE structured.retention_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  -- 보낼 당시 파기해야 할 문서 수. 다음 판단의 기준이 된다.
  due_count integer NOT NULL CHECK (due_count > 0),
  sent_at timestamptz NOT NULL DEFAULT now(),
  -- 몇 대에 실제로 닿았는지. 0이면 보낼 기기가 없거나 전부 실패한 것이다.
  delivered_to integer NOT NULL DEFAULT 0 CHECK (delivered_to >= 0)
);

CREATE INDEX retention_alerts_operator_idx
  ON structured.retention_alerts (operator_user_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- 4. 파기해야 할 문서
-- ---------------------------------------------------------------------------
--
-- 0012의 retention_attention은 "문제가 생긴 것"을 모은다. 이건 "때가 된 것"이다.
-- 정상적으로 예정일이 지난 문서가 여기 오르고, 사람이 지우면 빠진다.
--
-- 보관 기간(ORIGINAL_RETENTION_DAYS)이 정해지지 않으면 retention_until이 비어
-- 있어 이 목록도 비어 있다. 그건 "지울 것이 없다"가 아니라 "언제 지울지 아직
-- 정하지 않았다"는 뜻이다 — 알림이 조용한 것을 안전하다고 읽으면 안 된다.

CREATE VIEW originals.documents_due_for_deletion AS
SELECT
  d.id,
  d.owner_user_id,
  d.retention_until,
  d.status,
  d.delete_attempts,
  d.personal_info_kinds
FROM originals.raw_documents d
WHERE d.deleted_at IS NULL
  AND d.retention_until IS NOT NULL
  AND d.retention_until <= now();

COMMENT ON VIEW originals.documents_due_for_deletion IS
  '파기 예정일이 지난 원본. 사람이 지운다. 보관 기간이 정해지지 않으면 비어 있다 — 안전해서가 아니라 일정이 없어서다.';
