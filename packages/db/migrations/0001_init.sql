-- WeddingPick 초기 스키마
--
-- 사업계획서 28번: 원본·개인정보·구조화 데이터·통계 데이터는 분리 관리한다.
-- 스키마를 셋으로 나눠 그 분리를 권한 단위로 만들 수 있게 했다.
--   originals  — 원본 문서의 메타데이터. 파일 자체는 별도 객체 스토리지 버킷에 둔다.
--   structured — 개인정보를 마스킹한 뒤의 구조화 데이터
--   stats      — 집계 결과. 개별 계약을 되짚을 수 없다.

CREATE SCHEMA originals;
CREATE SCHEMA structured;
CREATE SCHEMA stats;

COMMENT ON SCHEMA originals IS '원본 문서 메타데이터. 파일 본체는 별도 버킷. 자동삭제 대상.';
COMMENT ON SCHEMA structured IS '마스킹 후 구조화 데이터. 서비스가 읽고 쓰는 본체.';
COMMENT ON SCHEMA stats IS '집계 결과. 개별 계약으로 역추적되지 않아야 한다.';

-- ---------------------------------------------------------------------------
-- 열거형
-- ---------------------------------------------------------------------------

-- 선언 순서가 곧 등급 순서다. min_verification_level >= 'L2' 같은 비교가 이 순서를 쓴다.
CREATE TYPE verification_level AS ENUM ('L0', 'L1', 'L2', 'L3', 'L4');
COMMENT ON TYPE verification_level IS '데이터 검증 등급. 사업계획서 26번, 서비스정책서 2번.';

-- 사업계획서 2번의 가격 단계. 최초 견적과 최종 지출이 어긋나는 것이 이 서비스가 다루는
-- 문제이므로 단계를 뭉뚱그리지 않는다.
CREATE TYPE document_type AS ENUM (
  'official_price',
  'quote',
  'pre_contract',
  'revised_quote',
  'contract',
  'additional_charge',
  'final_payment',
  'unknown'
);
COMMENT ON TYPE document_type IS '문서 종류. unknown은 AI 문서분류 전이거나 분류 실패.';

-- 사업계획서 6번의 카테고리 확장 순서.
CREATE TYPE vendor_category AS ENUM (
  'wedding_info_company',
  'hall',
  'sdm',
  'planner_agency',
  'snap',
  'goods',
  'etc'
);

-- 사업계획서 25번. 공식정보와 실제 데이터를 섞지 않기 위해 값마다 출처를 들고 다닌다.
CREATE TYPE source_type AS ENUM (
  'public_data',
  'vendor_official',
  'user_quote',
  'contract_verified',
  'usage_verified',
  'ai_extraction',
  'external_schedule'
);

CREATE TYPE line_item_kind AS ENUM ('included', 'excluded', 'additional_candidate');

CREATE TYPE contract_term_category AS ENUM (
  'cancellation',
  'refund',
  'penalty',
  'schedule',
  'other'
);

CREATE TYPE raw_document_status AS ENUM (
  'uploaded',
  'analyzed',
  'scheduled_delete',
  'deleted',
  'delete_failed'
);

-- ---------------------------------------------------------------------------
-- structured — 사용자와 웨딩
-- ---------------------------------------------------------------------------

CREATE TABLE structured.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
COMMENT ON TABLE structured.users IS
  '계정 식별자만 둔다. 이름·연락처 같은 개인정보는 여기 두지 않는다.';

CREATE TABLE structured.weddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  -- 배우자 연결 전에는 NULL이고, 해제하면 다시 NULL이 된다. 사업계획서 12번.
  partner_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  wedding_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_is_not_owner
    CHECK (partner_user_id IS NULL OR partner_user_id <> owner_user_id)
);
COMMENT ON TABLE structured.weddings IS
  '결혼 준비 한 건. 배우자 연결 전 "내 웨딩", 연결 후 "우리 웨딩".';

CREATE INDEX weddings_owner_idx ON structured.weddings (owner_user_id);
CREATE INDEX weddings_partner_idx ON structured.weddings (partner_user_id)
  WHERE partner_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- structured — 업체와 플래너
-- ---------------------------------------------------------------------------

CREATE TABLE structured.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category vendor_category NOT NULL,
  name text NOT NULL,
  region text NOT NULL,
  source source_type NOT NULL,
  -- 변하기 쉬운 정보는 출처와 마지막 확인일을 함께 들고 다닌다. 사업계획서 25번.
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendors_category_region_idx ON structured.vendors (category, region);

CREATE TABLE structured.planners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 프리랜서면 소속이 없다. 플래너는 업체 부속정보가 아니라 독립 비교대상이다. 사업계획서 11번.
  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  name text NOT NULL,
  regions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- originals — 원본 문서
-- ---------------------------------------------------------------------------

CREATE TABLE originals.raw_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  -- 객체 스토리지의 키. 파일 본체는 이 DB에 들어오지 않는다.
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  page_count integer NOT NULL CHECK (page_count > 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  -- 보관 기간이 아직 확정되지 않아 NULL을 허용한다. 서비스정책서 미확정 항목.
  retention_until timestamptz,
  deleted_at timestamptz,
  -- 자동삭제가 실패하면 운영자가 손으로 처리한다. 서비스정책서 4번.
  delete_attempts integer NOT NULL DEFAULT 0 CHECK (delete_attempts >= 0),
  status raw_document_status NOT NULL DEFAULT 'uploaded',
  CONSTRAINT deleted_status_matches_timestamp
    CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);
COMMENT ON TABLE originals.raw_documents IS
  '원본 문서 메타데이터. 개인정보 밀도가 가장 높은 지점이라 별도 스키마에 둔다.';
COMMENT ON COLUMN originals.raw_documents.retention_until IS
  '보관 만료 시각. 기준 일수가 확정되지 않아 아직 NULL일 수 있다.';

CREATE INDEX raw_documents_owner_idx ON originals.raw_documents (owner_user_id);
CREATE INDEX raw_documents_retention_idx ON originals.raw_documents (retention_until)
  WHERE deleted_at IS NULL;

-- 자동삭제 작업이 집어갈 목록.
CREATE VIEW originals.expired_documents AS
SELECT id, owner_user_id, storage_key, retention_until, delete_attempts
FROM originals.raw_documents
WHERE deleted_at IS NULL
  AND retention_until IS NOT NULL
  AND retention_until <= now();

COMMENT ON VIEW originals.expired_documents IS
  '보관 기간이 지난 원본. 삭제 작업이 이 목록만 본다.';

-- ---------------------------------------------------------------------------
-- structured — 견적·계약 문서
-- ---------------------------------------------------------------------------

CREATE TABLE structured.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,
  -- 원본이 자동삭제되면 끊긴다. 핵심 자산은 원본이 아니라 구조화된 데이터다. 사업계획서 28번.
  raw_document_id uuid REFERENCES originals.raw_documents (id) ON DELETE SET NULL,
  doc_type document_type NOT NULL DEFAULT 'unknown',
  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  planner_id uuid REFERENCES structured.planners (id) ON DELETE SET NULL,
  product_name text,
  -- "같은 상품"의 판단 기준이 아직 확정되지 않았다. 확정되면 이 값의 생성 규칙만 정하면 된다.
  product_key text,
  -- 금액은 원 단위 정수. 부동소수를 쓰면 합계가 어긋난다.
  total_amount bigint CHECK (total_amount >= 0),
  discount_amount bigint CHECK (discount_amount >= 0),
  contract_date date,
  verification_level verification_level NOT NULL DEFAULT 'L0',
  source source_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 사용자 확인 단계를 통과한 시각. 서비스정책서 1번.
  confirmed_at timestamptz
);
COMMENT ON TABLE structured.quotes IS
  '분석이 끝난 문서 한 건. 견적·가계약·계약·최종지출을 같은 표에 두고 doc_type으로 구분한다.';
COMMENT ON COLUMN structured.quotes.product_key IS
  '같은 상품끼리 묶는 키. 판단 기준 미확정 — docs/05 7번.';
COMMENT ON COLUMN structured.quotes.confirmed_at IS
  '핵심 필드를 사용자가 확인한 시각. NULL이면 비교·통계에 쓰지 않는다.';

CREATE INDEX quotes_wedding_idx ON structured.quotes (wedding_id);
CREATE INDEX quotes_market_idx
  ON structured.quotes (vendor_id, product_key, doc_type, contract_date)
  WHERE confirmed_at IS NOT NULL;

CREATE TABLE structured.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES structured.quotes (id) ON DELETE CASCADE,
  kind line_item_kind NOT NULL,
  label text NOT NULL,
  amount bigint CHECK (amount >= 0),
  note text
);
COMMENT ON TABLE structured.quote_line_items IS
  '포함 항목·별도 항목·추가비용 후보. 무엇이 값에 들어있고 무엇이 나중에 붙는지 나눈다.';

CREATE INDEX quote_line_items_quote_idx ON structured.quote_line_items (quote_id);

CREATE TABLE structured.contract_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES structured.quotes (id) ON DELETE CASCADE,
  category contract_term_category NOT NULL,
  body text NOT NULL,
  -- 사용자가 특히 확인해야 할 조건으로 띄울지
  flagged boolean NOT NULL DEFAULT false
);

CREATE INDEX contract_terms_quote_idx ON structured.contract_terms (quote_id);

-- ---------------------------------------------------------------------------
-- structured — AI 추출값과 사용자 확인
-- ---------------------------------------------------------------------------

CREATE TABLE structured.extraction_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES structured.quotes (id) ON DELETE CASCADE,
  field_path text NOT NULL,
  extracted_value text NOT NULL,
  confidence numeric(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  -- 서비스정책서 1번: 계약금액·계약일·환불조건은 예외 없이 사용자 확인을 거친다.
  -- 어떤 필드가 필수인지를 애플리케이션 코드가 아니라 스키마가 들고 있는다.
  requires_confirmation boolean
    GENERATED ALWAYS AS (field_path IN ('totalAmount', 'contractDate', 'refundTerms')) STORED,
  confirmed_by_user boolean NOT NULL DEFAULT false,
  corrected_value text,
  UNIQUE (quote_id, field_path)
);
COMMENT ON TABLE structured.extraction_fields IS
  'AI가 뽑은 값 하나와 신뢰도. 신뢰도가 낮아도 숨기지 않고 "확인 필요"로 드러낸다.';

CREATE INDEX extraction_fields_pending_idx ON structured.extraction_fields (quote_id)
  WHERE requires_confirmation AND NOT confirmed_by_user;

-- 확인이 끝나지 않은 문서를 확인 완료로 표시하지 못하게 막는다.
-- 앱이 실수해도 DB에서 걸린다.
CREATE FUNCTION structured.assert_required_fields_confirmed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.confirmed_at IS NOT NULL AND EXISTS (
    SELECT 1
    FROM structured.extraction_fields
    WHERE quote_id = NEW.id
      AND requires_confirmation
      AND NOT confirmed_by_user
  ) THEN
    RAISE EXCEPTION
      '확인되지 않은 핵심 필드가 남아 있어 문서를 확인 완료로 표시할 수 없다 (quote %)', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER quotes_require_confirmed_fields
  BEFORE INSERT OR UPDATE OF confirmed_at ON structured.quotes
  FOR EACH ROW
  WHEN (NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION structured.assert_required_fields_confirmed();

-- ---------------------------------------------------------------------------
-- 시장 가격에 들어갈 자격이 있는 문서
-- ---------------------------------------------------------------------------

-- 집계는 이 뷰만 본다. 등급·확인 여부 조건을 집계 쿼리마다 다시 쓰면 언젠가 하나가 빠진다.
CREATE VIEW structured.comparable_quotes AS
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
  AND vendor_id IS NOT NULL
  AND product_key IS NOT NULL
  AND total_amount IS NOT NULL
  AND contract_date IS NOT NULL;

COMMENT ON VIEW structured.comparable_quotes IS
  '시장 대표가격 계산에 들어갈 수 있는 문서. L2 이상이고 사용자 확인을 마친 것만. 서비스정책서 2번.';

-- ---------------------------------------------------------------------------
-- stats — 가격 통계
-- ---------------------------------------------------------------------------

CREATE TABLE stats.price_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,
  product_key text NOT NULL,
  doc_type document_type NOT NULL,
  -- 표본 수와 기준 기간은 중앙값과 함께 저장한다. 화면에 늘 같이 나가야 하므로
  -- 떼어놓을 수 없게 한 행에 둔다. 사업계획서 9번.
  sample_count integer NOT NULL CHECK (sample_count > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  median bigint NOT NULL CHECK (median >= 0),
  p25 bigint NOT NULL CHECK (p25 >= 0),
  p75 bigint NOT NULL CHECK (p75 >= 0),
  p90 bigint NOT NULL CHECK (p90 >= 0),
  min_verification_level verification_level NOT NULL,
  recomputed_at timestamptz NOT NULL DEFAULT now(),
  -- 서비스정책서 2번: 시장 대표가격은 L2 이상만 반영한다.
  CONSTRAINT market_price_needs_verified_data CHECK (min_verification_level >= 'L2'),
  CONSTRAINT period_is_ordered CHECK (period_start <= period_end),
  CONSTRAINT quantiles_are_ordered CHECK (p25 <= median AND median <= p75 AND p75 <= p90),
  UNIQUE (vendor_id, product_key, doc_type)
);
COMMENT ON TABLE stats.price_stats IS
  '업체·상품·문서종류별 가격 분포. 표본이 기준에 못 미치면 행을 만들지 않는다.';
