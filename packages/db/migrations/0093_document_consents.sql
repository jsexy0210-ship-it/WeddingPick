-- 견적서 동의
-- ---------------------------------------------------------------------------
--
-- 견적서 원본도 결제 증빙과 똑같이 외부 서비스로 나가는데, **그 경로에는 동의
-- 화면도 서버 기록도 없었다**(Release Audit 1차 P0-5, 2026-09-09). 같은 앱의
-- 결제 증빙 경로에는 둘 다 있으므로 정책이 아니라 누락이다.
--
-- `payment_consents`(0036)와 같은 모양이다. 지우지 않고 이력으로 쌓는다 —
-- 언제 동의했고 언제 철회했는지는 나중에 물어볼 수 있는 질문이고, 덮어쓰면
-- 답할 수 없다.

CREATE TABLE structured.document_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,

  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,

  /**
   * 무엇에 동의했는가. 안내 문구가 바뀌면 이전 동의는 다른 것에 대한 동의다.
   */
  consent_version text NOT NULL CHECK (length(btrim(consent_version)) > 0),

  CONSTRAINT document_consent_revoked_after_granted
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

/*
 * 살아 있는 동의는 사람당 하나. 철회한 뒤 다시 동의할 수 있으므로 부분 색인이다.
 */
CREATE UNIQUE INDEX document_consents_active_idx
  ON structured.document_consents (user_id)
  WHERE revoked_at IS NULL;

/*
 * 지금 동의한 사람. **관문은 여기 하나다.**
 *
 * 업로드 경로와 화면이 각자 조건을 적으면 언젠가 한쪽이 철회를 못 보고,
 * 철회한 사람의 견적서가 들어온다.
 */
CREATE VIEW structured.active_document_consents AS
SELECT c.user_id, c.granted_at, c.consent_version
FROM structured.document_consents c
WHERE c.revoked_at IS NULL;

COMMENT ON VIEW structured.active_document_consents IS
  '지금 견적서 업로드에 동의한 사람. 철회하면 여기서 빠진다.';
