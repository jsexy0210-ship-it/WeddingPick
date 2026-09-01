-- 업체 정보 정정 흐름.
--
-- 규격 초안 15번: 업체 정보 수정 요청 → 소속 확인 → 변경 내용 검증 → 반영 → 해당 값 보호.
--
-- 문의 창구(A-12·A-13)를 통해 접수된 정정 신청이 이 테이블에 쌓인다.
-- 관리자가 승인하면 vendor 행을 직접 갱신하고 vendor_change_log(0048)에 이력을 남긴다.
--
-- 0038 vendor_claims(관계자 인증)와의 차이:
--   vendor_claims는 "이 업체 관계자임을 증명"하는 신청이고,
--   vendor_corrections는 "이 필드 값이 틀렸다"는 정보 정정 신청이다.
--   업체가 아닌 일반 사용자도 정정을 신청할 수 있다.

CREATE TYPE correction_status AS ENUM (
  'pending',    -- 접수, 검토 전
  'approved',   -- 승인, vendor 행에 반영됨
  'rejected',   -- 반려 (근거 없음, 이미 정확함 등)
  'superseded'  -- 같은 vendor·field에 더 최신 신청이 먼저 처리됨
);

CREATE TABLE structured.vendor_corrections (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id        uuid               NOT NULL
                     REFERENCES structured.vendors (id) ON DELETE CASCADE,
  field_name       text               NOT NULL CHECK (length(btrim(field_name)) > 0),

  -- 신청 시점의 현재값 스냅샷. 관리자가 나중에 "내가 이미 바꿨나" 판단할 때 쓴다.
  current_value    text,
  requested_value  text               NOT NULL CHECK (length(btrim(requested_value)) > 0),
  reason           text,              -- 신청자가 적은 설명 (선택)

  -- 신청자. 앱 사용자이면 requested_by. 앱 밖 제보이면 NULL + contact_info.
  requested_by     uuid               REFERENCES structured.users (id) ON DELETE SET NULL,
  contact_info     text,              -- 앱 밖 제보일 때 연락처 (이메일 등)

  status           correction_status  NOT NULL DEFAULT 'pending',
  decided_by       uuid               REFERENCES structured.users (id) ON DELETE SET NULL,
  decided_at       timestamptz,
  decision_note    text,              -- 승인·반려 이유

  created_at       timestamptz        NOT NULL DEFAULT now(),

  -- 신청자 정보는 최소 하나가 있어야 한다.
  CONSTRAINT correction_requires_contact
    CHECK (requested_by IS NOT NULL OR contact_info IS NOT NULL),

  -- 결론이 났으면 누가 언제 냈는지 반드시 남는다. 0032·0038에서 이미 쓴 패턴.
  CONSTRAINT correction_decided_by_and_at_together
    CHECK ((decided_by IS NULL) = (decided_at IS NULL)),
  -- approved·rejected는 decided_at이 있어야 하고, pending·superseded는 없어야 한다.
  -- superseded는 자동 시스템 전환이라 관리자 결정(decided_at)이 없다.
  CONSTRAINT correction_decided_set_iff_resolved
    CHECK ((status IN ('approved', 'rejected')) = (decided_at IS NOT NULL))
);

-- 심사 대기 목록. 관리자가 처리 순서대로 읽는다.
CREATE INDEX vendor_corrections_pending_idx
  ON structured.vendor_corrections (created_at)
  WHERE status = 'pending';

-- 업체별 정정 이력.
CREATE INDEX vendor_corrections_vendor_idx
  ON structured.vendor_corrections (vendor_id, created_at DESC);

COMMENT ON TABLE structured.vendor_corrections IS
  '업체 정보 정정 신청. 관리자 승인 시 vendor 행을 갱신하고 vendor_change_log에 이력을 남긴다.';

COMMENT ON COLUMN structured.vendor_corrections.current_value IS
  '신청 시점의 현재값 스냅샷. 관리자가 그사이 다른 값으로 이미 바꿨는지 판단할 때 쓴다.';

COMMENT ON COLUMN structured.vendor_corrections.status IS
  'superseded: 같은 vendor·field에 더 최신 신청이 먼저 승인되면 기존 pending을 자동 전환한다. decided_at 없음.';

-- ---------------------------------------------------------------------------
-- 동일 필드 중복 신청 방지
-- ---------------------------------------------------------------------------
--
-- 같은 업체의 같은 필드에 pending 신청이 둘 이상 있으면 관리자가 헷갈린다.
-- 기존 pending이 있으면 새 신청 전에 안내한다 — 앱이 이 인덱스를 보고 막거나
-- 신청자에게 "이미 접수 중"임을 알릴 수 있다.
CREATE UNIQUE INDEX vendor_corrections_one_pending_per_field
  ON structured.vendor_corrections (vendor_id, field_name)
  WHERE status = 'pending';
