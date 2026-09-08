-- 회원탈퇴. 디자인 핸드오프 WP-MY-008.
--
-- **탈퇴는 개인정보 삭제이지, 실 제보까지 지우는 것이 아니다.** 후기 하나가
-- 사라지면 그 업체를 보던 다음 사람의 판단 근거가 함께 사라지고, 그건 탈퇴한
-- 사람이 요구한 것이 아니다. 요구한 것은 "나를 지워달라"이지 "내가 남긴 사실을
-- 세상에서 없애달라"가 아니다.
--
-- 지금 스키마는 그 반대로 정해져 있었다. 후기·가격제보·결제인증이 사람을 NOT NULL로
-- 붙들고 CASCADE로 매달려 있어, 계정을 지우면 실 제보가 함께 지워졌다.
-- 핸드오프 표와 스키마가 어긋나 있으면 어긋난 쪽이 실제로 일어나는 일이다.

-- ---------------------------------------------------------------------------
-- 사람과 끊어지되 사실은 남는다
-- ---------------------------------------------------------------------------
--
-- 별도의 `익명` 표시 열을 두지 않는다. 이 세 열은 지금까지 NOT NULL이었으므로
-- **NULL이라는 것 자체가 "탈퇴한 사람의 것"이라는 뜻이다.** 표시를 따로 두면
-- 언젠가 둘이 어긋나고, 어긋나면 어느 쪽이 참인지 아무도 답할 수 없다.

ALTER TABLE structured.reviews
  ALTER COLUMN author_user_id DROP NOT NULL;

ALTER TABLE structured.reviews
  DROP CONSTRAINT reviews_author_user_id_fkey,
  ADD CONSTRAINT reviews_author_user_id_fkey
    FOREIGN KEY (author_user_id) REFERENCES structured.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN structured.reviews.author_user_id IS
  'NULL이면 탈퇴한 사람의 후기다. 내용은 남고 사람과의 연결만 끊긴다.';

ALTER TABLE structured.price_reports
  ALTER COLUMN reporter_user_id DROP NOT NULL;

ALTER TABLE structured.price_reports
  DROP CONSTRAINT price_reports_reporter_user_id_fkey,
  ADD CONSTRAINT price_reports_reporter_user_id_fkey
    FOREIGN KEY (reporter_user_id) REFERENCES structured.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN structured.price_reports.reporter_user_id IS
  'NULL이면 탈퇴한 사람의 제보다. 업체별 금액 구간에는 그대로 반영된다.';

ALTER TABLE structured.payment_proofs
  ALTER COLUMN reporter_user_id DROP NOT NULL;

ALTER TABLE structured.payment_proofs
  DROP CONSTRAINT payment_proofs_reporter_user_id_fkey,
  ADD CONSTRAINT payment_proofs_reporter_user_id_fkey
    FOREIGN KEY (reporter_user_id) REFERENCES structured.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN structured.payment_proofs.reporter_user_id IS
  'NULL이면 탈퇴한 사람의 결제인증이다. 확인된 금액은 그대로 쓰인다.';

/*
 * 후기는 사람당 업체당 하나였다. 그 제약은 살아 있는 계정에만 걸어야 한다 —
 * 탈퇴한 사람의 후기가 NULL로 여럿 남으면 유니크가 걸릴 수 있기 때문이다.
 * PostgreSQL은 NULL을 서로 다르게 보므로 `UNIQUE (vendor_id, author_user_id)`는
 * 그대로 두어도 막지 않는다. 이 주석은 그것이 우연이 아니라 의도임을 적어둔다.
 */

-- ---------------------------------------------------------------------------
-- 탈퇴 접수와 완료
-- ---------------------------------------------------------------------------
--
-- `users.deleted_at`은 처음부터 있었지만 아무도 읽지 않았다. 여기서 뜻을 준다:
-- **탈퇴를 접수한 시각**이다. 이 값이 있으면 그 계정으로는 아무것도 할 수 없다.
--
-- 접수와 완료를 나누는 이유는 하나다. **원본 파일이 스토리지에 남는 것을 막기
-- 위해서다.** 계정을 곧바로 지우면 raw_documents 행이 CASCADE로 함께 사라지고,
-- 파일은 지울 열쇠를 잃은 채 스토리지에 남는다. 아무도 그 파일이 있는 줄 모르게
-- 되는 것이 가장 나쁜 결과다.
--
-- 그래서 순서가 있다: 접수 → 원본을 즉시 파기 대상으로 → 파기 워커가 파일을
-- 지움 → 그 다음에 계정을 지운다.

COMMENT ON COLUMN structured.users.deleted_at IS
  '탈퇴를 접수한 시각. 접수되면 그 계정으로는 아무것도 할 수 없고, 원본이 모두 파기된 뒤 행 자체가 사라진다.';

CREATE INDEX users_pending_deletion_idx ON structured.users (deleted_at)
  WHERE deleted_at IS NOT NULL;

/*
 * 지울 준비가 된 계정.
 *
 * 접수됐고, 그 사람의 원본 중 아직 파일이 남은 것이 하나도 없는 계정이다.
 * `status = 'deleted'`인 행은 파일이 지워졌다는 기록이므로 남아 있어도 된다 —
 * 계정을 지우면 그 기록도 CASCADE로 사라지지만, 그때는 파일이 이미 없다.
 *
 * 뷰로 두는 이유는 관문을 하나로 두기 위해서다. 지우는 쪽이 각자 조건을 적으면
 * 언젠가 한 곳이 "파일이 남았는지"를 빠뜨리고, 그 한 번이 파일을 영영 남긴다.
 */
CREATE VIEW structured.deletable_accounts AS
SELECT u.id AS user_id, u.deleted_at
FROM structured.users u
WHERE u.deleted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM originals.raw_documents d
    WHERE d.owner_user_id = u.id AND d.status <> 'deleted'
  );

COMMENT ON VIEW structured.deletable_accounts IS
  '탈퇴를 접수했고 원본 파일이 모두 파기된 계정. 이 뷰에 뜬 계정만 지운다.';

-- ---------------------------------------------------------------------------
-- 탈퇴하면 원본은 기다리지 않는다
-- ---------------------------------------------------------------------------
--
-- 파기 일정은 저장값이 아니라 **계산값이다**(0018·0022). `raw_documents.retention_until`
-- 열을 손으로 고쳐도 파기 워커가 보는 값은 바뀌지 않는다. 그리고 심사가 열려 있는
-- 원본은 `verified_at`이 NULL이라 파기 시각 자체가 없다.
--
-- 그 둘이 겹치면 **탈퇴한 계정이 영원히 지워지지 않는다.** 원본이 남아 있으니
-- `deletable_accounts`에 뜨지 않고, 원본은 만료되지 않으니 파기되지 않는다.
--
-- 그래서 탈퇴 시각을 파기 시각으로 삼는다. 보관하던 이유는 그 사람의 자료를
-- 확인해주기 위해서였고, 그 사람이 떠났으면 그 목적이 끝난 것이다. 열려 있던
-- 심사도 함께 사라진다 — 승인해줄 사람이 없는 심사다.

CREATE OR REPLACE VIEW originals.document_retention_schedule AS
SELECT
  r.*,
  CASE
    -- 탈퇴가 다른 모든 사정을 앞선다. 심사 중이어도 마찬가지다.
    WHEN u.deleted_at IS NOT NULL THEN u.deleted_at
    WHEN r.verified_at IS NULL THEN NULL
    ELSE r.verified_at + originals.retention_interval(r.kind)
  END AS retention_until
FROM originals.document_retention r
JOIN structured.users u ON u.id = r.owner_user_id;

COMMENT ON VIEW originals.document_retention_schedule IS
  '계산된 파기 예정 시각. 종류별 보관 기간을 적용하고, 탈퇴한 사람의 것은 탈퇴 시각이 곧 파기 시각이다.';
