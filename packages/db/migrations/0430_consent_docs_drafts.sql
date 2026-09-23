-- 0430: 새 약관 문서 3종 초안 + 마케팅 동의 조문 채우기
--
-- 0429가 늘린 `terms_doc_kind` 값(pick_verification · consultation_recording ·
-- contact_sharing)으로 판·조문을 넣는다. 같은 트랜잭션에서 바로 쓸 수 있다
-- (0429는 별도 파일 = 별도 트랜잭션으로 이미 커밋됐다).
--
-- **셋 다 초안으로만 넣는다. 공개하지 않는다.** 세 문서는 지금까지 한 번도
-- 사용자에게 공개된 적 없는 신규 법적 문서다 — 0422처럼 `carried_over=true`로
-- 심으면 "이미 살아 있던 글을 표로 옮겼다"는 뜻이 되어 감사 기록에 거짓이 남는다.
-- 대표님이 관리자 화면(`웨딩픽 약관 방침.dc.html`, WP-ADM-036)에서 조문을 검수한
-- 뒤 직접 「초안 공개」를 눌러야 한다.
--
-- **조문은 새 법적 사실을 지어내지 않는다.** 이미 이용약관(0422가 심은 `terms`
-- 제2·6·7·9조)과 개인정보처리방침(같은 이관의 `privacy` 제1·2·4·5항)에 있는
-- 확정 사실을 그대로 재사용한다. 업체 연락처 보유기간처럼 아직 법무 검토가
-- 끝나지 않은 값은 CLAUDE.md의 표시("법무 검토 필요")를 조문에도 그대로 남긴다.
--
-- **마케팅(기존 3종 중 하나)에는 조문이 없었다** — 0422 주석: 「저장소 어디에도
-- 없다 … 대표님이 관리자에서 조문을 더하시면 그때 글이 생긴다」. 이미 만들어진
-- 초안 판(v1.0)에 조문만 채운다. 새 판을 만들지 않는다.

-- ---------------------------------------------------------------------------
-- 1. 새 문서 3종의 초안 판. 이미 판이 있으면(재실행) 건드리지 않는다.
-- ---------------------------------------------------------------------------

INSERT INTO structured.terms_versions (doc, version)
SELECT seed.doc::terms_doc_kind, 'v1.0'
FROM (VALUES
  ('pick_verification'),
  ('consultation_recording'),
  ('contact_sharing')
) AS seed(doc)
WHERE NOT EXISTS (
  SELECT 1 FROM structured.terms_versions v WHERE v.doc = seed.doc::terms_doc_kind
);

-- ---------------------------------------------------------------------------
-- 2. Pick 인증 자료 수집·이용 동의 — 이용약관 제2·7·9조, 방침 제4항(문자인식·영상
--    분석 위탁) 재사용
-- ---------------------------------------------------------------------------

INSERT INTO structured.terms_clauses (version_id, article_number, title, body, position, body_table)
SELECT v.id, c.article_number, c.title, c.body, c.position, c.body_table
FROM structured.terms_versions v
JOIN (VALUES
  ('pick_verification', '1', '제1조 수집·이용 목적',
   '회원이 실제 이용금액 확인을 위해 제출하는 영수증, 결제내역, 결제문자, 계좌이체 또는 간편결제 내역 등(이하 ''Pick 인증 자료'')을 제출 자료에서 필요한 항목을 추출·검증하여 실 제보(금액·품목·이용일·조건 등) 통계를 작성하고 서비스를 제공하기 위해 수집·이용합니다.',
   0, NULL::jsonb),
  ('pick_verification', '2', '제2조 수집·이용 항목',
   '통계 작성에 필요한 업체명, 금액, 이용일, 품목·옵션 등 최소 항목만 이용하고 불필요한 금융정보와 제3자 정보는 가림 또는 삭제합니다.',
   1, NULL::jsonb),
  ('pick_verification', '3', '제3조 보유 및 이용기간',
   '결제 인증 원본은 분석 완료 시점부터 24시간을 보유하며, 분석 완료 기록이 없으면 업로드 시점부터 계산합니다. 견적서 등 일반 문서 원본은 업로드·사용자 확인·인증 심사 결정 중 가장 늦은 시점부터 30일을 보유합니다. 진행 중인 인증 심사의 증빙 문서는 심사 종료 전까지 파기 일정 계산이 보류됩니다. 삭제 후에도 자료 식별자, 삭제 예정·완료 시각, 결과 코드 등 최소한의 감사기록은 별도로 정한 기간 동안 보관할 수 있습니다.',
   2, NULL::jsonb),
  ('pick_verification', '4', '제4조 처리위탁',
   '문자인식·영상 분석 업무를 Google LLC에 위탁하며, 업로드한 자료에서 필요한 항목을 추출·가림·검증하는 목적으로만 이용합니다. 원본 삭제는 제3조의 기준을 따르고, 수탁자의 입력·출력 보존기준은 개인정보처리방침 국외 이전 조항에 따릅니다.',
   3, NULL::jsonb),
  ('pick_verification', '5', '제5조 동의 거부 권리',
   'Pick 인증 자료 제출은 실 제보 정보를 제공받기 위한 필수 동의 항목입니다. 동의하지 않으면 Pick 인증 기능을 이용할 수 없습니다.',
   4, NULL::jsonb)
) AS c(doc, article_number, title, body, position, body_table)
  ON c.doc::terms_doc_kind = v.doc
WHERE v.doc = 'pick_verification'
  AND v.published_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM structured.terms_clauses x WHERE x.version_id = v.id);

-- ---------------------------------------------------------------------------
-- 3. 상담 녹음 수집·이용 동의 — 방침 제1항(상담기록 정리) · 제2항(상담 녹음 처리)
--    · 제4항(음성 인식·상담내용 분석 위탁) 재사용
-- ---------------------------------------------------------------------------

INSERT INTO structured.terms_clauses (version_id, article_number, title, body, position, body_table)
SELECT v.id, c.article_number, c.title, c.body, c.position, c.body_table
FROM structured.terms_versions v
JOIN (VALUES
  ('consultation_recording', '1', '제1조 수집·이용 목적',
   '이용자가 올린 상담 녹음 파일과 그 녹음에서 읽어낸 업체명·상담일·금액·상품 구성·계약 조건·상담 요약, 금액 항목의 근거가 된 짧은 인용(40자 이내)을 웨딩노트의 상담기록 정리(선택) 기능 제공을 위해 수집·이용합니다. 녹음에는 이용자 외 다른 사람의 목소리가 함께 담길 수 있습니다.',
   0, NULL::jsonb),
  ('consultation_recording', '2', '제2조 보유 및 삭제 시점',
   '녹음 원본은 읽어내기가 끝나면 바로 삭제하고, 끝나지 않은 경우에도 업로드 시점부터 24시간 안에 삭제합니다. 읽어낸 항목(업체명·상담일·금액·상품 구성·계약 조건·상담 요약)은 직접 삭제 또는 탈퇴 시까지 보관합니다. 녹취록은 만들지 않습니다.',
   1, NULL::jsonb),
  ('consultation_recording', '3', '제3조 처리위탁 및 국외 이전',
   '음성 인식·상담내용 분석 업무를 Google LLC(미국)에 위탁합니다. 이용자가 녹음을 올려 분석이 시작되는 시점에 암호화된 통신구간을 통해 전송하며, 회사 저장소의 녹음 원본은 항목 추출이 끝나는 즉시 파기합니다. 수탁자의 보존기준은 사업자가 공개한 정책을 따르고, 모델 학습에는 이용되지 않는 유료 API 경로로만 처리합니다.',
   2, NULL::jsonb),
  ('consultation_recording', '4', '제4조 동의 거부 권리',
   '상담 녹음 업로드는 상담기록 정리(선택) 기능을 위한 필수 동의 항목입니다. 동의하지 않으면 상담 녹음 업로드·자동 정리 기능을 이용할 수 없고, 기본 서비스 이용에는 제한이 없습니다.',
   3, NULL::jsonb)
) AS c(doc, article_number, title, body, position, body_table)
  ON c.doc::terms_doc_kind = v.doc
WHERE v.doc = 'consultation_recording'
  AND v.published_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM structured.terms_clauses x WHERE x.version_id = v.id);

-- ---------------------------------------------------------------------------
-- 4. 상담 예약 시 업체 연락처 제공 동의(선택) — 이용약관 제6조 · 방침 제3항(제3자
--    제공) 재사용. 보유기간은 아직 법무 검토 중이라 확정 문구를 넣지 않는다.
-- ---------------------------------------------------------------------------

INSERT INTO structured.terms_clauses (version_id, article_number, title, body, position, body_table)
SELECT v.id, c.article_number, c.title, c.body, c.position, c.body_table
FROM structured.terms_versions v
JOIN (VALUES
  ('contact_sharing', '1', '제1조 제공 목적',
   '이용자가 상담 예약을 신청하면, 회사는 정보주체의 동의에 따라 업체가 상담을 준비하고 연락할 수 있도록 이용자의 연락처를 해당 업체에 제공합니다.',
   0, NULL::jsonb),
  ('contact_sharing', '2', '제2조 제공받는 자 및 제공 항목',
   '제공받는 자는 이용자가 상담을 신청한 업체이며, 제공 항목은 이용자의 이름과 휴대전화번호입니다.',
   1, NULL::jsonb),
  ('contact_sharing', '3', '제3조 보유 및 이용기간',
   '업체가 보유하는 연락처의 보유기간은 아직 법무 검토 중입니다. 검토가 끝나는 대로 이 조문을 확정 문구로 교체합니다.',
   2, NULL::jsonb),
  ('contact_sharing', '4', '제4조 동의 거부 권리',
   '이 동의는 선택 항목입니다. 동의하지 않아도 기본 서비스 이용에는 제한이 없으며, 상담 예약 시 업체에 연락처가 제공되는 기능만 제한됩니다.',
   3, NULL::jsonb)
) AS c(doc, article_number, title, body, position, body_table)
  ON c.doc::terms_doc_kind = v.doc
WHERE v.doc = 'contact_sharing'
  AND v.published_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM structured.terms_clauses x WHERE x.version_id = v.id);

-- ---------------------------------------------------------------------------
-- 5. 마케팅 정보 수신 동의 — 이미 있는 초안 판(0422)에 조문만 채운다. 방침 제7항
--    · 이용약관 제13조 재사용
-- ---------------------------------------------------------------------------

INSERT INTO structured.terms_clauses (version_id, article_number, title, body, position, body_table)
SELECT v.id, c.article_number, c.title, c.body, c.position, c.body_table
FROM structured.terms_versions v
JOIN (VALUES
  ('marketing', '1', '제1조 수신 동의 목적',
   '회사는 이용자가 동의한 경우에 한하여 혜택·이벤트 소식과 야간 시간대 알림을 앱 푸시 등으로 보냅니다. 동의하지 않아도 기본 서비스 이용에는 제한이 없습니다.',
   0, NULL::jsonb),
  ('marketing', '2', '제2조 동의 철회',
   '마케팅 동의는 채널별로 언제든 변경하거나 철회할 수 있습니다. 정상적인 마케팅 수신 거부만을 이유로 서비스 이용을 제한하지 않습니다.',
   1, NULL::jsonb)
) AS c(doc, article_number, title, body, position, body_table)
  ON c.doc::terms_doc_kind = v.doc
WHERE v.doc = 'marketing'
  AND v.published_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM structured.terms_clauses x WHERE x.version_id = v.id);
