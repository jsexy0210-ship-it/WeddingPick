-- 업체 관계자 인증. 최종통합정책 v2.0 26·27번.
--
-- 반론 심사 도구에 "소속을 어떻게 확인하는지는 아직 정하지 않았다"고 적혀 있던
-- 자리다. 우선순위가 정해졌다 — ① 공식 도메인 이메일 ② 공개된 이메일
-- ③ 사업자 관련 증빙. 회사 이메일이 없는 작은 업체가 ③으로 들어온다.
--
-- 이 표가 지켜야 하는 것 둘:
--   * 자동 승인이 없다. 도메인이 맞아도 그건 재료지 결론이 아니다.
--   * 증빙 원본이 일반 사용자에게 새지 않는다(원문 27번).

-- ---------------------------------------------------------------------------
-- 업체 공식 도메인
-- ---------------------------------------------------------------------------
--
-- 견줄 대상이 없으면 ①을 확인할 수 없다. 변하기 쉬운 정보이므로 vendors의
-- 다른 값들과 같이 last_verified_at이 함께 따라다닌다.

ALTER TABLE structured.vendors
  ADD COLUMN official_domain text
    CHECK (official_domain IS NULL OR official_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$');

COMMENT ON COLUMN structured.vendors.official_domain IS
  '업체 공식 홈페이지 도메인. 운영자가 출처를 확인해 적는다. 관계자 인증 ①의 견줄 대상이다.';

-- ---------------------------------------------------------------------------
-- 관계자 인증 신청
-- ---------------------------------------------------------------------------

CREATE TYPE vendor_claim_method AS ENUM (
  'official_domain_email',
  'listed_email',
  'business_document'
);

CREATE TYPE vendor_claim_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE structured.vendor_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,

  /** 업체에서 어떤 일을 하는지. 사람이 확인하는 것이 이것이다. */
  claimed_role text NOT NULL CHECK (length(btrim(claimed_role)) >= 2),

  method vendor_claim_method NOT NULL,

  -- ①②가 낸 주소. ③은 주소가 없다.
  contact_email text,
  -- ②가 그 주소를 어디에서 봤다고 했는지. 심사하는 사람이 그 자리를 열어본다.
  listed_at text,
  /*
   * ③의 증빙.
   *
   * **문서를 가리키기만 한다.** 사업자등록증에는 대표자 이름과 주소가 적혀
   * 있으므로 값을 이 표에 옮기지 않는다 — 원본은 originals에 남고 보관기간
   * 작업이 그걸 지운다. 추출규칙 10번과 같은 말이다.
   */
  evidence_document_id uuid REFERENCES originals.raw_documents (id) ON DELETE SET NULL,

  status vendor_claim_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  decision_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  /*
   * 수단마다 필요한 것이 다르다. 각 제약이 한 가지만 지킨다 — 0032에서 배운
   * 것이다. 하나로 묶으면 양변이 나란히 false가 되는 구멍이 생긴다.
   */
  CONSTRAINT email_methods_have_an_email
    CHECK ((method = 'business_document') = (contact_email IS NULL)),
  CONSTRAINT listed_email_says_where
    CHECK ((method = 'listed_email') = (listed_at IS NOT NULL)),
  CONSTRAINT document_method_has_a_document
    CHECK ((method = 'business_document') = (evidence_document_id IS NOT NULL)),

  -- 결론에는 때와 사람이 함께 남는다. 0032의 반론 제약과 같은 갈래다.
  CONSTRAINT claim_decision_is_dated
    CHECK ((status = 'pending') = (decided_at IS NULL)),
  CONSTRAINT claim_decision_names_the_person
    CHECK ((decided_at IS NULL) = (decided_by IS NULL))
);

/*
 * 한 사람이 한 업체에 확인 중인 신청을 둘 들 수 없다.
 *
 * 거절된 뒤 다시 내는 것은 막지 않는다 — 증빙을 갖춰 다시 오는 길을 닫으면
 * 회사 이메일이 없는 업체가 영영 들어오지 못한다.
 */
CREATE UNIQUE INDEX vendor_claims_one_open_per_person
  ON structured.vendor_claims (vendor_id, claimant_user_id)
  WHERE status = 'pending';

CREATE INDEX vendor_claims_pending_idx ON structured.vendor_claims (created_at)
  WHERE status = 'pending';
CREATE INDEX vendor_claims_claimant_idx
  ON structured.vendor_claims (claimant_user_id, created_at DESC);

COMMENT ON TABLE structured.vendor_claims IS
  '업체 관계자 인증 신청. v2.0 26번. 승인은 사람이 한다 — 도메인이 맞는 것은 재료지 결론이 아니다.';
COMMENT ON COLUMN structured.vendor_claims.evidence_document_id IS
  '증빙 원본을 가리키기만 한다. 일반 사용자에게 공개하지 않는다(v2.0 27번).';

/*
 * 확인된 관계자.
 *
 * **증빙 열이 이 뷰에 없다.** 원문 27번이 "일반 사용자에게 원본 공개하지 않음"
 * 이라고 적었고, 그걸 관례가 아니라 뷰의 모양으로 지킨다 — 화면이 실수로
 * 이메일이나 증빙을 꺼내려 해도 꺼낼 열 자체가 없다.
 */
CREATE VIEW structured.approved_vendor_claims AS
SELECT c.id,
       c.vendor_id,
       c.claimant_user_id,
       c.claimed_role,
       c.method,
       c.decided_at
FROM structured.vendor_claims c
WHERE c.status = 'approved';

COMMENT ON VIEW structured.approved_vendor_claims IS
  '확인된 업체 관계자. 증빙과 연락처 열이 아예 없어 화면으로 새지 않는다.';

-- ---------------------------------------------------------------------------
-- 심사가 열려 있는 동안에는 증빙을 지우지 않는다
-- ---------------------------------------------------------------------------
--
-- 사업자 증빙은 `kind = 'document'`로 올라와 업로드 30일 뒤에 지워진다. 그런데
-- 관계자 인증 심사가 그때까지 안 끝나 있으면 **심사하는 사람이 볼 것이 사라진다.**
-- 0018이 인증 심사에 대해 이미 같은 답을 냈다 — 심사가 열려 있는 동안에는 파기
-- 일정이 서지 않는다. 관계자 인증도 같은 심사이므로 같은 규칙을 쓴다.
--
-- 조건이 세 군데에 나오므로 함수로 뺀다. 세 벌을 손으로 맞춰두면 언젠가 한 벌만
-- 고쳐진다.

CREATE FUNCTION originals.held_for_review(document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
           SELECT 1
             FROM structured.verification_evidence e
             JOIN structured.verification_requests r ON r.id = e.request_id
            WHERE e.raw_document_id = document_id
              AND r.status IN ('received', 'in_review')
         )
      OR EXISTS (
           SELECT 1
             FROM structured.vendor_claims c
            WHERE c.evidence_document_id = document_id
              AND c.status = 'pending'
         );
$$;

COMMENT ON FUNCTION originals.held_for_review(uuid) IS
  '사람의 심사가 열려 있어 파기 일정이 서지 않는 원본인지. 인증 심사와 관계자 인증 심사를 함께 본다.';

/*
 * 열 목록이 그대로라 갈아엎지 않고 바꿔 끼운다. 딸린 뷰 여섯이 그대로 산다.
 */
CREATE OR REPLACE VIEW originals.document_retention AS
SELECT
  d.id,
  d.owner_user_id,
  d.uploaded_at,
  d.deleted_at,
  d.status,
  d.delete_attempts,
  d.personal_info_kinds,
  d.kind,

  -- 결제내역은 심사에 붙지 않는다. 조건에 kind를 함께 적어 그 사실을 눈에 보이게 둔다.
  d.kind = 'document' AND originals.held_for_review(d.id) AS awaiting_verification,

  CASE
    WHEN d.kind = 'document' AND originals.held_for_review(d.id) THEN NULL
    WHEN d.kind = 'payment_proof' THEN
      -- 스펙 8.3은 "분석 완료 후"라고 적는다. 분석이 끝나지 않았으면 업로드가 바닥이다.
      greatest(
        d.uploaded_at,
        (SELECT max(p.analyzed_at) FROM structured.payment_proofs p WHERE p.raw_document_id = d.id)
      )
    ELSE greatest(
      d.uploaded_at,
      (SELECT max(q.confirmed_at) FROM structured.quotes q WHERE q.raw_document_id = d.id),
      (SELECT max(r.decided_at)
         FROM structured.verification_evidence e
         JOIN structured.verification_requests r ON r.id = e.request_id
        WHERE e.raw_document_id = d.id),
      -- 심사가 끝난 관계자 인증도 바닥이 된다. 결론이 난 날부터 30일이다.
      (SELECT max(c.decided_at)
         FROM structured.vendor_claims c
        WHERE c.evidence_document_id = d.id)
    )
  END AS verified_at
FROM originals.raw_documents d;
