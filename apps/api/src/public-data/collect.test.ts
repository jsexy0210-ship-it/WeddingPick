import iconv from 'iconv-lite';
import { contentHash, downloadSbizApiVendors, isVendorRegion, isoDay, listIndustryCategories, parsePublicCsv, resolveSbizCategory, type CollectedVendor } from './collect';
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
  // 보류 사유를 나눠 돌려준다 — 잠금(locked)과 최신성 미달(stale)은 서로 다른 신호다.
  expect(replacementDecision(existing,{...incoming,publishedOn:'2026-07-01'})).toBe('stale');
  expect(replacementDecision(existing,{...incoming,publishedOn:null})).toBe('stale');
  expect(replacementDecision({...existing,source_url:'other'},incoming)).toBe('stale');
  expect(replacementDecision({...existing,admin_locked:true},incoming)).toBe('locked');
});
test('해시는 수집 시각에 영향받지 않는다', () => {
  expect(contentHash(incoming)).toBe(contentHash({...incoming,collectedAt:'later'} as CollectedVendor));
});

// ── 결함 회귀 ────────────────────────────────────────────────────────────────

test('폐업·휴업 행은 수집하지 않고 rejected와 따로 센다', () => {
  // 이 열들을 보지 않아서 폐업 업체가 영업 중으로 들어왔다.
  const data = [
    '업체명,도로명주소,기준일자,영업상태명,폐업일자',
    '문닫은웨딩홀,경기도 이천시 길 1,2026-07-01,폐업,2026-06-01',
    '쉬는웨딩홀,경기도 이천시 길 2,2026-07-01,휴업,',
    '여는웨딩홀,경기도 이천시 길 3,2026-07-01,영업/정상,',
  ].join('\n');
  const parsed = parsePublicCsv(Buffer.from(data), 'icheon-halls', at);
  expect(parsed.vendors.map((v) => v.name)).toEqual(['여는웨딩홀']);
  expect(parsed.closed).toBe(2);
  expect(parsed.rejected).toBe(0);
});

test('영업상태 열이 없는 명단 파일은 그대로 수집한다', () => {
  // 이천·제천 «현황» 자료에는 상태 열이 없다. 열이 없다고 전부 버리면 안 된다.
  expect(parsePublicCsv(iconv.encode(csv, 'utf8'), 'icheon-halls', at).closed).toBe(0);
});

test('업종 12종으로 매핑하고, 못 고른 웨딩 업체는 버리지 않고 etc로 남긴다', () => {
  const rows: [string, string, string | null][] = [
    ['예식장업', '행복예식장', 'hall'],
    ['결혼 상담업', '좋은결혼정보', 'wedding_info_company'],
    ['그외 기타 미용업', '웨딩헤어살롱', 'hair'],
    ['피부 미용업', '브라이덜메이크업', 'makeup'],
    ['화훼 소매업', '웨딩플라워', 'bouquet'],
    ['기타 인쇄물 출판업', '웨딩청첩장', 'invitation'],
    ['시계·귀금속 소매업', '웨딩예물관', 'goods'],
    ['침구·직물 소매업', '웨딩혼수마을', 'dowry'],
    ['일반 여행사업', '웨딩허니문투어', 'honeymoon'],
    ['의류 대여업', '웨딩드레스샵', 'dress'],
    ['인물 사진 촬영업', '본식스냅하우스', 'snap'],
    ['인물 사진 촬영업', '웨딩스튜디오하우스', 'studio'],
    // 규칙에 없는 업종인데 상호가 웨딩이면 버리지 않는다 — 사람이 업종을 정한다.
    ['그외 기타 분류 안된 서비스업', '웨딩종합서비스', 'etc'],
    // 웨딩 표시가 없는 일반 업종은 그대로 버린다.
    ['그외 기타 미용업', '동네미용실', null],
    ['화훼 소매업', '골목꽃집', null],
    ['일반 여행사업', '싼값여행사', null],
  ];
  for (const [industry, name, expected] of rows) {
    expect([industry, name, resolveSbizCategory(industry, name)]).toEqual([industry, name, expected]);
  }
});

test('지역 판정은 도메인 regionTokens 규칙을 쓴다', () => {
  expect(isVendorRegion('서울특별시 강남구')).toBe(true);
  expect(isVendorRegion('경기도 이천시')).toBe(true);
  expect(isVendorRegion('충청북도 제천시')).toBe(true);
  // 시·도가 아닌 주소 조각과 토막 수가 안 맞는 값은 받지 않는다.
  expect(isVendorRegion('길 1')).toBe(false);
  expect(isVendorRegion('서울특별시')).toBe(false);
  expect(isVendorRegion('')).toBe(false);
});
