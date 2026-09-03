-- 데이터 무결성 강화: 웨딩 유니크 제약 및 분석 문서 제약
--
-- 모든 DDL을 DO 블록으로 감싸 idempotent하게 처리.
-- COMMENT ON INDEX/CONSTRAINT 실패 시 Postgres는 42P01(undefined_table)을 발생시키므로
-- undefined_object가 아닌 undefined_table과 함께 잡아야 한다.

-- ---------------------------------------------------------------------------
-- 웨딩 테이블: 배우자 쌍 유니크 제약
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_weddings_partner_pair
    ON structured.weddings (
      LEAST(owner_user_id, partner_user_id),
      GREATEST(owner_user_id, partner_user_id)
    ) WHERE partner_user_id IS NOT NULL;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  COMMENT ON INDEX idx_weddings_partner_pair IS
    '배우자가 연결된 웨딩에서만 적용. 동일한 두 사용자의 웨딩은 최대 1개 존재해야 함.';
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 분석 테이블: 문서당 유니크 제약
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE structured.analyses ADD CONSTRAINT unique_analysis_per_document
    UNIQUE (raw_document_id);
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  COMMENT ON CONSTRAINT unique_analysis_per_document ON structured.analyses IS
    '문서당 최대 1개의 분석 레코드. 재시도는 상태 업데이트로 처리.';
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;
