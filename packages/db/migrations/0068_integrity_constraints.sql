-- 데이터 무결성 강화: 웨딩 유니크 제약 및 분석 문서 제약

-- ---------------------------------------------------------------------------
-- 웨딩 테이블: 배우자 쌍 유니크 제약
-- ---------------------------------------------------------------------------
-- 같은 두 사용자가 여러 웨딩을 생성하는 것 방지.
-- 예: (user_A, user_B)와 (user_B, user_A)는 동일 쌍으로 간주.
-- partner_user_id가 NULL이면 "내 웨딩" 상태로, 제약에서 제외됨.

-- 함수 기반 제약: 두 user_id를 정렬하여 순서 무관하게 유니크 보장
CREATE UNIQUE INDEX IF NOT EXISTS idx_weddings_partner_pair
  ON structured.weddings (
    LEAST(owner_user_id, partner_user_id),
    GREATEST(owner_user_id, partner_user_id)
  ) WHERE partner_user_id IS NOT NULL;

DO $$ BEGIN
  COMMENT ON INDEX idx_weddings_partner_pair IS
    '배우자가 연결된 웨딩에서만 적용. 동일한 두 사용자의 웨딩은 최대 1개 존재해야 함.';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 분석 테이블: 문서당 유니크 제약
-- ---------------------------------------------------------------------------
-- 같은 문서에 대해 여러 분석이 실행되는 것 방지.
-- 분석 재시도는 기존 분석 레코드의 상태 업데이트로 처리.

DO $$ BEGIN
  ALTER TABLE structured.analyses ADD CONSTRAINT unique_analysis_per_document
    UNIQUE (raw_document_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  COMMENT ON CONSTRAINT unique_analysis_per_document ON structured.analyses IS
    '문서당 최대 1개의 분석 레코드. 재시도는 상태 업데이트로 처리.';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 필요시 인덱스: analyses는 raw_document_id로 빈번하게 조회되므로,
-- 위 UNIQUE 제약이 자동으로 인덱스를 생성함.
