-- 업체 데이터 품질 — 상태 추적, 수동 수정 보호, 기준일 분리.
--
-- 규격 초안 4·11·12·13번에서 필요한 컬럼들.
--
-- is_active / closed_at:
--   임포트가 폐업 업체를 필터링해 건너뛰는 것과, 이미 등록된 업체가 폐업으로
--   전환되는 것은 다른 일이다. 지금까지 전자만 처리했고 후자는 없었다.
--   DB에 상태를 두어야 다음 임포트가 기존 행을 폐업으로 전환하고,
--   검색·비교에서 폐업 업체를 빼고, 이력을 남길 수 있다.
--
-- admin_locked:
--   ON CONFLICT에서 last_verified_at만 갱신하므로 수동 수정이 우연히 보호되는
--   구조였다. 명시적 잠금 플래그가 없으면 업체명이 바뀌어 normalized_name이
--   달라졌을 때 새 행이 삽입되어 기존 수정값이 고아가 된다.
--
-- data_published_at:
--   last_verified_at은 "우리가 확인한 날"이고 이 컬럼은 원본 데이터의 기준일이다.
--   공공데이터포털 파일의 데이터갱신일자가 여기 들어간다.
--
-- updated_at:
--   임포트·관리자 수정·폐업 전환 등 행이 실제로 바뀐 시각. 변경 감지에 쓴다.

ALTER TABLE structured.vendors
  ADD COLUMN is_active        boolean     NOT NULL DEFAULT true,
  ADD COLUMN closed_at        timestamptz,
  ADD COLUMN admin_locked     boolean     NOT NULL DEFAULT false,
  ADD COLUMN data_published_at date,
  ADD COLUMN updated_at       timestamptz NOT NULL DEFAULT now();

-- 폐업으로 전환했으면 언제인지 반드시 남긴다.
ALTER TABLE structured.vendors
  ADD CONSTRAINT vendors_closed_requires_date
    CHECK (is_active OR closed_at IS NOT NULL);

COMMENT ON COLUMN structured.vendors.is_active IS
  '영업 중이면 true. 폐업·휴업 감지 시 false로 전환하고 closed_at을 기록한다. 즉시 삭제하지 않는다.';

COMMENT ON COLUMN structured.vendors.closed_at IS
  '폐업이 확인된 시각. is_active = false일 때 의미가 있다.';

COMMENT ON COLUMN structured.vendors.admin_locked IS
  'true이면 공개 데이터 임포트가 어떤 필드도 갱신하지 않는다. 관리자가 수동으로 확정한 행에 설정한다.';

COMMENT ON COLUMN structured.vendors.data_published_at IS
  '원본 데이터(예: 공공데이터포털 파일)의 기준일. last_verified_at(우리 확인일)과 구분한다.';

COMMENT ON COLUMN structured.vendors.updated_at IS
  '행이 마지막으로 바뀐 시각. 임포트·관리자 수정·폐업 전환 모두 갱신한다.';

-- 영업 중인 업체만 빠르게 찾는다. 검색·비교·상세가 공통으로 쓴다.
CREATE INDEX vendors_is_active_idx ON structured.vendors (category, region) WHERE is_active;
