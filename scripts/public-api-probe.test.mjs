import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildUrl, findItems, redactUrl, summarize } from './public-api-probe.mjs';

const ENDPOINT = 'https://api.data.go.kr/openapi/tn_pubr_public_sample_api';

test('data.go.kr OpenAPI 호스트가 아니면 키를 보내지 않고 멈춘다', () => {
  assert.throws(() => buildUrl('https://example.com/api', {}, 'KEY'), /data\.go\.kr/);
  assert.throws(() => buildUrl('https://www.data.go.kr/data/1/fileData.do', {}, 'KEY'), /data\.go\.kr/);
});

test('디코딩 키는 인코딩하고, 이미 인코딩된 키는 그대로 붙인다', () => {
  assert.match(buildUrl(ENDPOINT, {}, 'a+b/c=='), /serviceKey=a%2Bb%2Fc%3D%3D$/);
  assert.match(buildUrl(ENDPOINT, {}, 'a%2Bb%3D%3D'), /serviceKey=a%2Bb%3D%3D$/);
  assert.match(buildUrl(ENDPOINT, { type: 'json' }, 'k'), /\?type=json&serviceKey=k$/);
});

test('로그용 주소는 키를 가린다', () => {
  assert.equal(
    redactUrl(`${ENDPOINT}?type=json&serviceKey=SECRET`),
    `${ENDPOINT}?type=json&serviceKey=***`
  );
});

test('항목이 하나뿐이라 객체로 와도 목록으로 찾는다', () => {
  assert.deepEqual(findItems({ response: { body: { items: { item: { a: 1 } } } } }), [{ a: 1 }]);
  assert.deepEqual(findItems({ response: { body: { items: [{ a: 1 }, { a: 2 }] } } }), [
    { a: 1 },
    { a: 2 },
  ]);
});

test('JSON 응답은 결과 코드 · 건수 · 칸 이름을 찍고 전화 · 주소 · 좌표 값은 가린다', () => {
  const body = JSON.stringify({
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
      body: {
        totalCount: 1234,
        items: [{ 예식장명: '시험홀', 전화번호: '02-000-0000', 소재지도로명주소: '서울 어딘가 1', 위도: '37.5' }],
      },
    },
  });
  const text = summarize(body).join('\n');

  assert.match(text, /결과 코드: 00/);
  assert.match(text, /전체 건수: 1234/);
  assert.match(text, /예식장명: 시험홀/);
  assert.match(text, /전화번호: \(값 있음 · 11자\)/);
  assert.doesNotMatch(text, /02-000-0000|어딘가|37\.5/);
});

test('XML 오류 응답도 결과 메시지를 찍는다', () => {
  const body =
    '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>' +
    '<returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';
  const text = summarize(body).join('\n');

  assert.match(text, /형식: XML/);
  assert.match(text, /결과 코드: 30/);
  assert.match(text, /SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);
});
