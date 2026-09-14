-- Npay 리워드 수령(WP-EVT-006) — 디자인 핸드오프 v3.22 15-events · SPEC §11.3.
--
-- 사용자가 «받는 분 · 휴대폰 번호 · 동의»를 넣어 지급을 요청하고, 운영자가 Npay로 보낸 뒤
-- «보냈다»고 적는다. 돈을 보내는 것은 이 표가 아니다 — 사람이 보내고 사실만 남긴다.
--
-- **휴대폰 번호는 보내는 데만 쓰고 보낸 뒤 지운다.** 화면이 그렇게 약속한다(«리워드를
-- 보내는 데만 써요 · 보내드린 뒤 지워요»). requested 상태에서만 번호가 있고, sent · failed가
-- 되는 순간 NULL이 된다(CHECK). 실패했으면 사용자가 번호를 다시 넣어 새로 요청한다.
--
-- 요청 하나가 그때 «지급 대기»(earned)였던 보상 전부를 묶는다. 보상은 payout_id로 어느
-- 요청에 묶였는지 가리키고, 요청이 실패하면 풀려서 다시 받을 수 있다.

CREATE TYPE reward_payout_status AS ENUM ('requested', 'sent', 'failed');

CREATE TABLE structured.reward_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  amount_krw integer NOT NULL CHECK (amount_krw > 0),

  recipient_name text NOT NULL CHECK (length(btrim(recipient_name)) BETWEEN 1 AND 20),
  /** 010-XXXX-XXXX 꼴로 정규화해 둔다. 보낸 뒤(또는 실패 뒤) NULL. */
  recipient_phone text CHECK (recipient_phone IS NULL OR recipient_phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
  consent_at timestamptz NOT NULL,

  status reward_payout_status NOT NULL DEFAULT 'requested',
  /** 실패 사유. 받는 사람이 읽는다 — «휴대폰 번호를 확인해주세요». */
  failure_reason text CHECK (failure_reason IS NULL OR length(btrim(failure_reason)) > 0),

  requested_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  settled_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  phone_deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payout_phone_only_while_requested
    CHECK ((status = 'requested') = (recipient_phone IS NOT NULL)),
  CONSTRAINT payout_phone_deletion_dated
    CHECK ((recipient_phone IS NULL) = (phone_deleted_at IS NOT NULL)),
  CONSTRAINT payout_settled_is_dated
    CHECK ((status = 'requested') = (settled_at IS NULL)),
  CONSTRAINT payout_settled_names_the_person
    CHECK ((settled_at IS NULL) = (settled_by IS NULL)),
  CONSTRAINT payout_failure_has_reason
    CHECK ((status = 'failed') = (failure_reason IS NOT NULL))
);

COMMENT ON TABLE structured.reward_payouts IS
  'Npay 리워드 수령 요청(WP-EVT-006). 번호는 requested 동안만 있고 보낸 뒤 지운다. 돈은 사람이 보낸다.';

CREATE INDEX reward_payouts_user_idx ON structured.reward_payouts (user_id, requested_at DESC);
/* 한 사람이 동시에 두 요청을 열 수 없다 — 열린 요청이 있으면 그 결과를 먼저 본다. */
CREATE UNIQUE INDEX reward_payouts_one_open_idx ON structured.reward_payouts (user_id)
  WHERE status = 'requested';

ALTER TABLE structured.reward_grants
  ADD COLUMN payout_id uuid REFERENCES structured.reward_payouts (id) ON DELETE SET NULL;

COMMENT ON COLUMN structured.reward_grants.payout_id IS
  '어느 수령 요청에 묶였는지. NULL이면 아직 받을 수 있다(earned) 또는 묶일 일이 없다(held·blocked).';

CREATE INDEX reward_grants_payout_idx ON structured.reward_grants (payout_id) WHERE payout_id IS NOT NULL;
