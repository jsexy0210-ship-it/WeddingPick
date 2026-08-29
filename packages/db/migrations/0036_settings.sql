-- 알림 설정과 결제인증 동의. 디자인 핸드오프 19번, 최종통합정책 v2.0 36·37번.

-- ---------------------------------------------------------------------------
-- 알림 설정
-- ---------------------------------------------------------------------------
--
-- v2.0 36번: **사용자가 알림을 끄면 발송하지 않는다.** 끌 수 있게 만들어놓고
-- 보내는 쪽이 그 값을 안 보면, 그 스위치는 장식이다.
--
-- 행이 없으면 켜진 것으로 본다(기본값). 로그인한 모든 사람에게 미리 행을 만들지
-- 않기 위해서다 — 만들어두면 회원 수만큼 쓸모없는 행이 쌓인다.

CREATE TABLE structured.notification_settings (
  user_id uuid PRIMARY KEY REFERENCES structured.users (id) ON DELETE CASCADE,

  /** 서비스 알림 전체. 끄면 아무것도 보내지 않는다. */
  push_enabled boolean NOT NULL DEFAULT true,
  /**
   * 관심업체 가격 변동 알림. v2.0 37번.
   *
   * 서비스 알림과 따로 끈다 — 자료 확인 결과는 받고 싶지만 가격 알림은 시끄러운
   * 사람이 있다. 하나로 묶으면 그 사람은 둘 다 끄게 된다.
   */
  price_change_enabled boolean NOT NULL DEFAULT true,

  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 결제인증 동의
-- ---------------------------------------------------------------------------
--
-- 핸드오프 10번이 동의를 **최초 1회만** 받으라고 했고, 19번이 **철회**할 수 있게
-- 하라고 했다. 둘 다 하려면 동의가 어딘가에 남아 있어야 한다.
--
-- 지우지 않고 이력으로 쌓는다. 언제 동의했고 언제 철회했는지는 나중에 물어볼 수
-- 있는 질문이고, 덮어쓰면 답할 수 없다.

CREATE TABLE structured.payment_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,

  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,

  /**
   * 무엇에 동의했는가.
   *
   * 안내 문구가 바뀌면 이전 동의는 다른 것에 대한 동의다. 판을 적어두지 않으면
   * "이 사람이 무엇에 동의했는지"에 답할 수 없다.
   */
  consent_version text NOT NULL CHECK (length(btrim(consent_version)) > 0),

  CONSTRAINT revoked_after_granted CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

/*
 * 살아 있는 동의는 사람당 하나. 철회한 뒤 다시 동의할 수 있으므로 부분 색인이다.
 */
CREATE UNIQUE INDEX payment_consents_active_idx
  ON structured.payment_consents (user_id)
  WHERE revoked_at IS NULL;

/*
 * 지금 동의한 사람. **관문은 여기 하나다.**
 *
 * 등록 경로와 화면이 각자 조건을 적으면 언젠가 한쪽이 철회를 못 보고, 철회한
 * 사람의 결제내역이 들어온다.
 */
CREATE VIEW structured.active_payment_consents AS
SELECT c.user_id, c.granted_at, c.consent_version
FROM structured.payment_consents c
WHERE c.revoked_at IS NULL;

COMMENT ON VIEW structured.active_payment_consents IS
  '지금 결제인증에 동의한 사람. 철회하면 여기서 빠진다.';
