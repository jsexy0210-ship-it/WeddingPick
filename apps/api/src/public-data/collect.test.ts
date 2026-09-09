import iconv from 'iconv-lite';
import { contentHash, downloadSbizApiVendors, isoDay, listIndustryCategories, parsePublicCsv, type CollectedVendor } from './collect';
import { sourceKey } from './sources';
import { replacementDecision } from './sync';

const at = new Date('2026-09-04T00:00:00Z');
const csv = '업체명,도로명주소,기준일자,전화번호,위도\n긴 웨딩홀 원문,경기도 이천시 길 1,2026-07-01,010-1234-5678,37.1';
test.each(['utf8','cp949'])('최소 필드만 남긴다 (%s)', (encoding) => {
  const parsed = parsePublicCsv(iconv.encode(csv,encoding),'icheon-halls',at);
  expect(parsed.vendors).toHaveLength(1);
  expect(parsed.vendors[0]).toMatchObject({name:'긴 웨딩홀 원문', region:'경기도 이천시',status:'needs_verification'});
  expect(JSON.stringify(parsed)).not.toContain('010-1234');
  expect(JSON.stringify(parsed)).not.toContain('길 1');
  expect(JSON.stringify(parsed)).not.toContain('37.1');
});
test('잘못된 날짜와 미래 날짜는 조회일로 대체하지 않는다', () => {
  expect(isoDay('2026-02-30','2026-09-04')).toBeNull();
  expect(isoDay('2026-10-01','2026-09-04')).toBeNull();
  expect(parsePublicCsv(Buffer.from(csv.replace('2026-07-01','')),'icheon-halls',at).rejected).toBe(1);
});
test('스키마 변경은 실패하고 중복은 별도 집계한다', () => {
  expect(() => parsePublicCsv(Buffer.from('name,address\na,b'),'icheon-halls',at)).toThrow();
  expect(parsePublicCsv(Buffer.from(csv+'\n'+csv.split('\n')[1]),'icheon-halls',at).duplicates).toBe(1);
});
test('상권 CSV의 일반 미용실·사진관은 자동 등록하지 않는다', () => {
  const data='상호명,도로명주소,상가업소번호,상권업종소분류명\n일반사진관,서울특별시 강남구 길 1,1,사진 촬영업\n행복웨딩,서울특별시 강남구 길 2,2,예식장업';
  const parsed=parsePublicCsv(Buffer.from(data),'sbiz',at);
  expect(parsed.rejected).toBe(1);
  expect(parsed.vendors[0]?.publishedOn).toBeNull();
});
test('Google·네이버·카카오를 저장 허용 출처로 받을 수 없다', () => {
  for(const key of ['google','naver','kakao','__proto__']) expect(()=>sourceKey(key)).toThrow();
});
test('sbiz-api 응답에서 서울 예식장만 파싱한다', async () => {
  const mockPage = {
    totalCount: 2, currentCount: 2, pageIndex: 1, pageSize: 1000,
    data: [
      { bizesId: 'S1', bizesNm: '강남웨딩홀', brchNm: '', indsSclsNm: '예식장', ctprvnCd: '11', rdnmAdr: '서울특별시 강남구 길 1' },
      { bizesId: 'G1', bizesNm: '수원웨딩홀', brchNm: '', indsSclsNm: '예식장', ctprvnCd: '41', rdnmAdr: '경기도 수원시 길 1' },
    ],
  };
  const origFetch = global.fetch;
  const body = Buffer.from(JSON.stringify(mockPage));
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: { [Symbol.asyncIterator]: async function* () { yield body; } },
  });
  try {
    const vendors = await downloadSbizApiVendors('sbiz-seoul', 'test-key', new Date('2026-09-04T00:00:00Z'));
    expect(vendors).toHaveLength(1);
    expect(vendors[0]?.name).toBe('강남웨딩홀');
    expect(vendors[0]?.region).toBe('서울특별시 강남구');
    expect(vendors[0]?.category).toBe('hall');
    expect(vendors[0]?.sourceRecordId).toBe('S1');
  } finally {
    global.fetch = origFetch;
  }
});
test('이미 URL-encode된 서비스키를 이중 인코딩하지 않는다', async () => {
  // 공공데이터포털 인증키는 이미 encode된 값으로 온다('/'→%2F, '='→%3D).
  // URLSearchParams.set()에 그대로 넘기면 '%'가 %25로 한 번 더 encode되어
  // 서버가 키를 못 알아본다(403) — apis.data.go.kr 연동 최다 실수.
  const encodedKey = 'abc%2Fdef%3D%3D';
  const origFetch = global.fetch;
  let requestedUrl = '';
  const body = Buffer.from(JSON.stringify({ data: [] }));
  global.fetch = jest.fn().mockImplementation((url: string) => {
    requestedUrl = url;
    return Promise.resolve({
      ok: true,
      body: { [Symbol.asyncIterator]: async function* () { yield body; } },
    });
  });
  try {
    await listIndustryCategories('small', encodedKey);
    const sentKey = new URL(requestedUrl).searchParams.get('serviceKey');
    expect(sentKey).toBe('abc/def==');
  } finally {
    global.fetch = origFetch;
  }
});
/**
 * 응답 껍데기가 한 가지가 아니다. 공공데이터포털은 표준 봉투
 * `{ response: { body: { items: { item: [...] } } } }`를 쓰는 곳과 `{ data: [...] }`를
 * 그대로 주는 곳이 섞여 있다. 한 모양만 보면 목록을 못 찾고도 «0건»으로 조용히
 * 끝나 원인 조사가 헛돈다 — 실제로 그랬다(2026-09-09).
 */
function respondWith(page: unknown): () => void {
  const origFetch = global.fetch;
  const body = Buffer.from(JSON.stringify(page));
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      body: { [Symbol.asyncIterator]: async function* () { yield body; } },
    })
  );
  return () => {
    global.fetch = origFetch;
  };
}

test('표준 봉투로 감싸 와도 업종 목록을 찾는다', async () => {
  const row = { indsSclsCd: 'S11001', indsSclsNm: '예식장업' };
  const shapes: unknown[] = [
    { response: { body: { items: { item: [row] } } } },
    { response: { body: { items: [row] } } },
    { items: { item: [row] } },
    [row],
    /*
     * 이 서비스가 실제로 주는 모양(2026-09-09 실키 확인) — `response` 껍데기 없이
     * 최상위에 header · body가 온다. 실측 전에는 이 자리를 안 봤고, 그래서
     * 「업종 목록을 응답에서 찾지 못했다」로 멈췄다.
     */
    { header: { resultCode: '00' }, body: { items: { item: [row] } } },
    { header: { resultCode: '00' }, body: { items: [row] } },
  ];

  for (const shape of shapes) {
    const restore = respondWith(shape);
    try {
      await expect(listIndustryCategories('small', 'test-key')).resolves.toEqual([
        { code: 'S11001', name: '예식장업' },
      ]);
    } finally {
      restore();
    }
  }
});

test('키를 거절당한 200 응답을 «0건»이 아니라 계정 문제로 알린다', async () => {
  /*
   * 포털은 키를 거절해도 HTTP 200으로 답한다. 머리만 실패고 몸통이 비어 있어서
   * 검사하지 않으면 조용히 0건으로 끝난다. 코드마다 사람이 할 일이 다르다 —
   * 사용자 결정(2026-09-09)대로 운영계정 키 하나로 통일하는 것이 답인 코드들이다.
   */
  const cases: [string, RegExp][] = [
    ['22', /하루 1,000건.*운영계정 키로 바꿔라/],
    ['30', /등록되지 않은 서비스 키/],
    ['20', /운영계정 활용신청에 포함/],
  ];

  for (const [code, expected] of cases) {
    const restore = respondWith({ header: { resultCode: code, resultMsg: 'X' }, body: { items: [] } });
    try {
      await expect(listIndustryCategories('middle', 'test-key')).rejects.toThrow(expected);
    } finally {
      restore();
    }
  }
});

test('정상 코드 «00»은 그대로 통과한다', async () => {
  const restore = respondWith({ header: { resultCode: '00' }, body: { items: [] } });
  try {
    await expect(listIndustryCategories('middle', 'test-key')).resolves.toEqual([]);
  } finally {
    restore();
  }
});

test('아는 자리 어디에도 목록이 없으면 «0건»으로 끝내지 않고 알린다', async () => {
  const restore = respondWith({ resultCode: '99', resultMsg: 'SERVICE ERROR' });
  try {
    // 모양만 알린다 — 본문을 그대로 찍으면 서비스 키가 섞여 나올 수 있다.
    await expect(listIndustryCategories('small', 'test-key')).rejects.toThrow(
      /최상위 키: resultCode · resultMsg/
    );
  } finally {
    restore();
  }
});

test('소분류 조회는 코드·이름을 읽고 요청 URL을 올바르게 만든다', async () => {
  // 아래 코드값은 이 테스트 전용 가짜 데이터다 — 실제 sbiz 코드가 아니다.
  // 진짜 코드는 listIndustryCategories를 실키로 호출해 확인해야 한다.
  const mockPage = {
    data: [
      { indsLclsCd: 'S1', indsLclsNm: '협회, 단체', indsMclsCd: 'S110', indsMclsNm: '결혼 관련 서비스', indsSclsCd: 'S11001', indsSclsNm: '예식장업' },
      { indsLclsCd: 'S1', indsLclsNm: '협회, 단체', indsMclsCd: 'S110', indsMclsNm: '결혼 관련 서비스', indsSclsCd: 'S11002', indsSclsNm: '결혼상담소' },
    ],
  };
  const origFetch = global.fetch;
  let requestedUrl = '';
  const body = Buffer.from(JSON.stringify(mockPage));
  global.fetch = jest.fn().mockImplementation((url: string) => {
    requestedUrl = url;
    return Promise.resolve({
      ok: true,
      body: { [Symbol.asyncIterator]: async function* () { yield body; } },
    });
  });
  try {
    const items = await listIndustryCategories('small', 'test-key', { indsLclsCd: 'S1', indsMclsCd: 'S110' });
    expect(items).toEqual([
      { code: 'S11001', name: '예식장업' },
      { code: 'S11002', name: '결혼상담소' },
    ]);
    expect(requestedUrl).toContain('/smallUpjongList?');
    expect(requestedUrl).toContain('indsLclsCd=S1');
    expect(requestedUrl).toContain('indsMclsCd=S110');
  } finally {
    global.fetch = origFetch;
  }
});
const incoming: CollectedVendor = {name:'새 이름',region:'경기도 이천시',category:'hall',sourceKey:'icheon-halls',
  sourceUrl:'https://www.data.go.kr/data/15100736/fileData.do',sourceRecordId:'id',publishedOn:'2026-09-02',
  collectedAt:at.toISOString(),status:'needs_verification'};
const existing={id:'id',name:'옛 이름',region:'경기도 이천시',category:'hall',source:'public_data',
  source_url:incoming.sourceUrl,data_published_at:'2026-08-01',admin_locked:false};
test('최신 동일 출처 갱신, 과거·다른 출처·잠금은 보류한다', () => {
  expect(replacementDecision(existing,incoming)).toBe('update');
  expect(replacementDecision(existing,{...incoming,publishedOn:'2026-07-01'})).toBe('hold');
  expect(replacementDecision(existing,{...incoming,publishedOn:null})).toBe('hold');
  expect(replacementDecision({...existing,source_url:'other'},incoming)).toBe('hold');
  expect(replacementDecision({...existing,admin_locked:true},incoming)).toBe('hold');
});
test('해시는 수집 시각에 영향받지 않는다', () => {
  expect(contentHash(incoming)).toBe(contentHash({...incoming,collectedAt:'later'} as CollectedVendor));
});
