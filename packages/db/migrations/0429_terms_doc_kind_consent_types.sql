-- 0429: 약관 문서 종류 3개 추가 — Pick 인증 · 상담 녹음 · 연락처 제공 동의
--
-- v3.29 WP-AUTH-010(약관 동의 한 화면 통합) · WP-AUTH-011(약관 상세 풀팝업, 탭 6개)이
-- 요구하는 약관 문서는 6종인데 `terms_doc_kind`(0130)는 지금 3종(terms · privacy ·
-- marketing)뿐이다. 필수 동의 항목인 「Pick 인증 자료 수집·이용 동의」·「상담 녹음
-- 수집·이용 동의」, 선택 동의 항목인 「상담 예약 시 업체 연락처 제공 동의」를 더한다.
--
-- **이 파일은 enum 값만 늘린다.** Postgres는 `ALTER TYPE ... ADD VALUE`로 늘린 값을
-- 같은 트랜잭션 안에서 바로 못 쓴다 — 조문을 채우는 INSERT는 다음 마이그레이션
-- (0430)으로 나눈다.

ALTER TYPE terms_doc_kind ADD VALUE 'pick_verification';
ALTER TYPE terms_doc_kind ADD VALUE 'consultation_recording';
ALTER TYPE terms_doc_kind ADD VALUE 'contact_sharing';
