-- 이벤트 운영정보와 약관 편집의 웹 정본 연결. 기존 법률 문구/동의 이력은 변경하지 않는다.
CREATE TABLE structured.admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  budget_amount bigint CHECK (budget_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_by uuid NOT NULL REFERENCES structured.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE structured.terms_versions ADD COLUMN document_snapshot jsonb;
ALTER TABLE structured.terms_clauses ADD COLUMN source_path text[];
ALTER TABLE marketing_jobs ADD COLUMN deleted_at timestamptz;
