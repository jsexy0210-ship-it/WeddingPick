-- 개인정보 탐지 재검토.
--
-- 서비스정책서 4번: "개인정보 탐지 자동화 초기 정확도가 100%가 아니므로,
-- 오픈 초기엔 사람 재검토 1단계 유지."
--
-- 문서를 읽는 쪽은 개인정보의 값을 옮기지 않고 종류만 적도록 되어 있다. 그건
-- 지시일 뿐 보장이 아니다. 특히 계약조건은 원문 그대로 옮기라고 되어 있어
-- (취소 조항에 이름이나 연락처가 섞여 있으면 그대로 따라 들어온다) 새어 들어올
-- 자리가 분명히 있다.

CREATE TYPE pii_review_status AS ENUM ('pending', 'clean', 'redacted');

ALTER TABLE structured.quotes
  ADD COLUMN pii_review pii_review_status NOT NULL DEFAULT 'pending',
  ADD COLUMN pii_reviewed_at timestamptz,
  ADD COLUMN pii_reviewed_by uuid REFERENCES structured.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN structured.quotes.pii_review IS
  '개인정보 재검토 상태. pending인 문서의 값은 남들이 보는 면으로 가지 않는다. 서비스정책서 4번.';

-- 결론에는 사람이 남는다. 인증 심사(0011)·문의(0009)와 같은 규칙이다.
ALTER TABLE structured.quotes
  ADD CONSTRAINT pii_review_has_reviewer
    CHECK ((pii_review = 'pending') = (pii_reviewed_at IS NULL AND pii_reviewed_by IS NULL));

CREATE INDEX quotes_pii_pending_idx ON structured.quotes (created_at)
  WHERE pii_review = 'pending';

-- ---------------------------------------------------------------------------
-- 무엇을 지웠나
-- ---------------------------------------------------------------------------
--
-- 지운 값은 남기지 않는다 — 개인정보를 지우면서 그 개인정보를 다른 표에 옮겨
-- 적으면 지운 것이 아니다. 어느 필드에서 어떤 종류를 지웠는지만 남긴다.

CREATE TABLE structured.pii_redactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES structured.quotes (id) ON DELETE CASCADE,
  -- 'vendorNameRaw' | 'plannerName' | 'productName' | 'hallName' | 'contractTerms'
  field text NOT NULL CHECK (length(btrim(field)) > 0),
  kind text NOT NULL CHECK (length(btrim(kind)) > 0),
  redacted_by uuid NOT NULL REFERENCES structured.users (id) ON DELETE RESTRICT,
  redacted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pii_redactions_quote_idx ON structured.pii_redactions (quote_id);

COMMENT ON TABLE structured.pii_redactions IS
  '무엇을 지웠는지의 기록. 지운 값 자체는 남기지 않는다 — 옮겨 적으면 지운 것이 아니다.';

-- ---------------------------------------------------------------------------
-- 관문을 좁힌다
-- ---------------------------------------------------------------------------
--
-- 시장 대표가격에 들어가는 길은 이 뷰 하나뿐이다. 여기서 막으면 우회로가 없다.
--
-- 등급(L2 이상)과 재검토는 서로 다른 질문에 답한다. 등급은 "이 금액이 진짜인가"를
-- 보고, 재검토는 "이 안에 남의 개인정보가 섞여 있지 않은가"를 본다. 둘 다
-- 통과해야 한다.
--
-- 본인이 자기 계약서를 자기 화면에서 보는 것은 막지 않는다. 그건 유출이 아니다.

CREATE OR REPLACE VIEW structured.comparable_quotes AS
SELECT
  id,
  vendor_id,
  planner_id,
  product_key,
  doc_type,
  total_amount,
  contract_date,
  verification_level
FROM structured.quotes
WHERE confirmed_at IS NOT NULL
  AND verification_level >= 'L2'
  AND pii_review <> 'pending'
  AND vendor_id IS NOT NULL
  AND product_key IS NOT NULL
  AND total_amount IS NOT NULL
  AND contract_date IS NOT NULL;

COMMENT ON VIEW structured.comparable_quotes IS
  '시장 대표가격 계산에 들어갈 수 있는 문서. L2 이상이고, 사용자 확인을 마쳤고, 개인정보 재검토를 받은 것만. 서비스정책서 2번·4번.';

-- ---------------------------------------------------------------------------
-- 검토 대기 목록
-- ---------------------------------------------------------------------------
--
-- 검토자가 봐야 하는 것은 문서 한 줄이 아니라, 문서에서 **글자를 그대로 옮겨온**
-- 필드들이다. 금액·날짜·인원수는 숫자라 개인정보가 새어 들어올 자리가 아니다.

CREATE VIEW structured.pending_pii_reviews AS
SELECT
  q.id,
  q.created_at,
  q.vendor_name_raw,
  q.product_name,
  q.hall_name,
  p.name AS planner_name,
  d.personal_info_kinds,
  COALESCE(
    (SELECT string_agg(t.body, E'\n' ORDER BY t.id)
       FROM structured.contract_terms t WHERE t.quote_id = q.id),
    ''
  ) AS contract_terms
FROM structured.quotes q
LEFT JOIN structured.planners p ON p.id = q.planner_id
LEFT JOIN originals.raw_documents d ON d.id = q.raw_document_id
WHERE q.pii_review = 'pending'
ORDER BY q.created_at;

COMMENT ON VIEW structured.pending_pii_reviews IS
  '개인정보 재검토가 필요한 문서와, 문서에서 글자를 그대로 옮겨온 필드들. 서비스정책서 4번.';
