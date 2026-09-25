import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';

import {
  buildUrl,
  findDownload,
  findItems,
  isFilePage,
  readCsv,
  readXlsx,
  redactUrl,
  summarize,
  tableLines,
} from './public-api-probe.mjs';

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

/** 시험용 zip — 로컬 헤더와 중앙 디렉터리만 채운다(CRC는 읽는 쪽이 안 본다). */
function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

test('파일데이터 페이지만 키 없이 받는다', () => {
  assert.equal(isFilePage('https://www.data.go.kr/data/15155669/fileData.do'), true);
  assert.equal(isFilePage('https://www.data.go.kr/data/15155669/standard.do'), false);
  assert.equal(isFilePage('https://evil.example/data/1/fileData.do'), false);
});

test('ld+json에서 공식 다운로드 주소와 이용허락을 읽는다', () => {
  const html =
    '<p>이용허락범위 제한 없음</p><script type="application/ld+json">' +
    JSON.stringify({
      name: '서울특별시 혼인건수',
      distribution: [{ contentUrl: 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=F1', encodingFormat: 'XLSX' }],
    }) +
    '</script>';
  assert.deepEqual(findDownload(html), {
    url: 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=F1',
    license: '이용허락범위 제한 없음',
    name: '서울특별시 혼인건수',
    format: 'XLSX',
  });
  assert.equal(findDownload('<script type="application/ld+json">{"distribution":[{"contentUrl":"https://example.com/x"}]}</script>'), null);
});

test('XLSX 첫 시트를 공유 문자열·숫자·빈 칸까지 행으로 읽는다', () => {
  const xlsx = makeZip({
    'xl/sharedStrings.xml': '<sst><si><t>연도</t></si><si><t>혼인건수</t></si><si><r><t>합</t></r><r><t>계</t></r></si></sst>',
    'xl/worksheets/sheet1.xml':
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2"><v>2024</v></c><c r="C2" t="s"><v>2</v></c></row>' +
      '</sheetData></worksheet>',
  });
  assert.deepEqual(readXlsx(xlsx), [
    ['연도', '혼인건수'],
    ['2024', '', '합계'],
  ]);
});

test('CSV는 UTF-8이 깨지면 CP949로 읽는다', () => {
  // 「연도,건수」를 CP949로 적은 바이트
  const cp949 = Buffer.from([0xbf, 0xac, 0xb5, 0xb5, 0x2c, 0xb0, 0xc7, 0xbc, 0xf6, 0x0a, 0x32, 0x30, 0x32, 0x34, 0x2c, 0x31]);
  assert.deepEqual(readCsv(cp949), [
    ['연도', '건수'],
    ['2024', '1'],
  ]);
});

test('표를 찍을 때 머리글이 전화·주소인 칸의 값은 가린다', () => {
  const text = tableLines([
    ['상호명', '전화번호', '도로명주소'],
    ['시험홀', '02-000-0000', '서울 어딘가'],
  ]).join('\n');
  assert.match(text, /시험홀 \| \(값 있음\) \| \(값 있음\)/);
  assert.doesNotMatch(text, /02-000-0000|어딘가/);
});
