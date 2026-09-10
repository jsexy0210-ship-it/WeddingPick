-- sbiz OpenAPI 출처의 임포트 스위치를 켠다.
--
-- 0071은 icheon-halls · jecheon-halls · sbiz(CSV) 세 행만 넣었고 OpenAPI 출처인
-- sbiz-seoul · sbiz-gyeonggi를 빠뜨렸다. sync.ts의 syncOne은 import_switches에
-- enabled=true 행이 없으면 SOURCE_DISABLED로 던지므로, 이 두 출처는 --apply가
-- 업체 전건 실패한다. 수집은 성공하고 DB 반영만 전량 실패해서 조용히 지나간다.
--
-- 운영계정 승인(2026-09-08)으로 이 두 출처가 실제로 도는 상태라 지금 켜야 한다.
-- 이용허락범위 제한 없음은 데이터셋 단위라 CSV 출처(sbiz)와 같다.
INSERT INTO structured.import_switches(source_key, enabled, reason)
VALUES ('sbiz-seoul', true, '2026-09-08 소상공인 상권정보 운영계정 승인 · 이용허락범위 제한 없음'),
       ('sbiz-gyeonggi', true, '2026-09-08 소상공인 상권정보 운영계정 승인 · 이용허락범위 제한 없음')
ON CONFLICT(source_key) DO NOTHING;
