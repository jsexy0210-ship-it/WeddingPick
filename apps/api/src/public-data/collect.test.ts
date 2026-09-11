import iconv from 'iconv-lite';
import { WEDDING_UPJONG_CODES, contentHash, downloadSbizApiVendors, findNumber, findRecords, isVendorRegion, isoDay, listIndustryCategories, parsePublicCsv, resolveSbizCategory, resolveUpjongQuery, type CollectedVendor } from './collect';
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
    // 업종코드는 호출자가 넘긴다 — 아래 값은 테스트 전용 가짜 코드다.
    const { vendors, fetched, rejected } = await downloadSbizApiVendors(
      'sbiz-seoul', 'test-key', new Date('2026-09-04T00:00:00Z'),
      { divId: 'indsSclsCd', codes: ['S21101'] });
    expect(fetched).toBe(2);
    expect(rejected).toBe(1); // 경기 업체는 시도 필터에서 빠진다
    expect(vendors).toHaveLength(1);
    expect(vendors[0]?.name).toBe('강남웨딩홀');
    expect(vendors[0]?.region).toBe('서울특별시 강남구');
    expect(vendors[0]?.category).toBe('hall');
    expect(vendors[0]?.sourceRecordId).toBe('S1');
  } finally {
    global.fetch = origFetch;
  }
});
test('봉투가 중첩돼 있어도 레코드 배열을 찾는다', () => {
  // 2026-09-09 실 응답 확인: sdsc2 업종코드 조회는 { data: [...] }가 아니라
  // 여러 겹으로 감싼 모양으로 온다. 봉투 이름에 의존하지 않는다.
  const nested = { response: { header: { resultCode: '00' },
    body: { totalCount: '2', items: [
      { indsLclsCd: 'Q1', indsLclsNm: '보건의료', stdrDt: '2023-02-28' },
      { indsLclsCd: 'R1', indsLclsNm: '예술·스포츠', stdrDt: '2023-02-28' },
    ] } } };
  expect(findRecords<{ indsLclsCd: string }>(nested, 'indsLclsCd').map((r) => r.indsLclsCd))
    .toEqual(['Q1', 'R1']);
  expect(findNumber(nested, 'totalCount')).toBe(2);
  expect(findRecords(nested, '없는필드')).toEqual([]);
});
test('환경변수가 없으면 확인된 소분류 코드를 쓴다', () => {
  /*
   * 전에는 여기서 던졌다 — 코드를 몰랐기 때문이다. 대분류 'Q'가 활용가이드에
   * 없는 값이라 조용한 0건이 나던 시절의 가드다. 2026-09-10에 smallUpjongList를
   * 실 키로 불러 실제 코드를 확인했으므로 이제 기본값이 있다. 그래도 «코드 없이
   * 부르지 않는다»는 원래 뜻은 그대로다 — 아래 테스트가 지킨다.
   */
  const saved = process.env.SBIZ_UPJONG_CODES;
  delete process.env.SBIZ_UPJONG_CODES;
  try {
    expect(resolveUpjongQuery()).toEqual({ divId: 'indsSclsCd', codes: [...WEDDING_UPJONG_CODES] });
  } finally {
    if (saved === undefined) delete process.env.SBIZ_UPJONG_CODES;
    else process.env.SBIZ_UPJONG_CODES = saved;
  }
});

test('빈 문자열로 온 설정은 «없음»으로 본다', () => {
  /*
   * GitHub Actions는 정의되지 않은 Variables를 빈 값으로 넘긴다. `??`만 쓰면
   * `''`가 값으로 통과해 「셋 중 하나여야 한다」로 죽는다 — 실제로 그렇게 죽었다.
   */
  const saved = [process.env.SBIZ_UPJONG_CODES, process.env.SBIZ_UPJONG_DIV_ID];
  process.env.SBIZ_UPJONG_CODES = '';
  process.env.SBIZ_UPJONG_DIV_ID = '';
  try {
    expect(resolveUpjongQuery()).toEqual({ divId: 'indsSclsCd', codes: [...WEDDING_UPJONG_CODES] });
  } finally {
    for (const [name, value] of [['SBIZ_UPJONG_CODES', saved[0]], ['SBIZ_UPJONG_DIV_ID', saved[1]]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('빈 업종코드를 넘기면 수집을 시작하지 않는다', () => {
  // 코드가 틀리거나 비면 API는 오류 대신 빈 목록을 준다 — 조용한 0건 수집을 막는다.
  expect(() => resolveUpjongQuery({ divId: 'indsSclsCd', codes: [] })).toThrow('SBIZ_UPJONG_CODES');
});
test('이미 URL-encode된 서비스키를 이중 인코딩하지 않는다', async () => {
  // 공공데이터포털 인증키는 이미 encode된 값으로 온다('/'→%2F, '='→%3D).
  // URLSearchParams.set()에 그대로 넘기면 '%'가 %25로 한 번 더 encode되어
  // 서버가 키를 못 알아본다(403) — apis.data.go.kr 연동 최다 실수.
  const encodedKey = 'abc%2Fdef%3D%3D';
  const origFetch = global.fetch;
  let requestedUrl = '';
  // 목록이 비면 «봉투를 못 찾음»으로 던진다. 여기서 보는 것은 URL이므로 한 줄 채운다.
  const body = Buffer.from(JSON.stringify({ data: [{ indsSclsCd: 'S21101', indsSclsNm: '예식장업' }] }));
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
  // 보류 사유를 나눠 돌려준다 — 잠금(locked)과 최신성 미달(stale)은 서로 다른 신호다.
  expect(replacementDecision(existing,{...incoming,publishedOn:'2026-07-01'})).toBe('stale');
  expect(replacementDecision(existing,{...incoming,publishedOn:null})).toBe('stale');
  expect(replacementDecision({...existing,source_url:'other'},incoming)).toBe('stale');
  expect(replacementDecision({...existing,admin_locked:true},incoming)).toBe('locked');
});
test('해시는 수집 시각에 영향받지 않는다', () => {
  expect(contentHash(incoming)).toBe(contentHash({...incoming,collectedAt:'later'} as CollectedVendor));
});

/*
 * 2026-09-11 대표 지시 — 「소량만 우선 수집해 100건 정도」.
 *
 * 받아 놓고 자르는 것이 아니라 **API를 그만 두드려야** 소량 수집이다. 전수를 받은
 * 뒤 100건만 남기면 소량으로 확인하려던 이유(부하·시간)가 사라진다.
 */
test('소량 상한을 채우면 다음 쪽을 부르지 않는다', async () => {
  const page = (rows: number, offset: number) => ({
    totalCount: 5000,
    data: Array.from({ length: rows }, (_, i) => ({
      bizesId: `V${offset + i}`, bizesNm: `업체${offset + i}웨딩홀`, brchNm: '',
      indsSclsNm: '예식장업', ctprvnCd: '11', rdnmAdr: '서울특별시 강남구 길 1',
    })),
  });
  const origFetch = global.fetch;
  let calls = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    calls += 1;
    const body = Buffer.from(JSON.stringify(page(1000, calls * 1000)));
    return Promise.resolve({
      ok: true,
      body: { [Symbol.asyncIterator]: async function* () { yield body; } },
    });
  });
  try {
    const result = await downloadSbizApiVendors(
      'sbiz-seoul', 'test-key', new Date('2026-09-11T00:00:00Z'),
      { divId: 'indsSclsCd', codes: ['S21101'] }, 100);

    expect(result.vendors).toHaveLength(100);
    // 한 쪽(1,000건)만 부르고 멈춘다 — totalCount가 5,000이어도 더 안 부른다.
    expect(calls).toBe(1);
    expect(result.truncated).toEqual([
      { code: 'S21101', got: 1000, total: 5000, reason: '소량 상한' },
    ]);
  } finally { global.fetch = origFetch; }
});

test('한 페이지가 끊겨도 그때까지 모은 것을 버리지 않는다', async () => {
  /*
   * 전국 전수를 돌리다 apis.data.go.kr이 4분 끊기면 이미 받아 둔 수천 건이 통째로
   * 사라졌다(2026-09-10 run 34427466145). 페이지가 수천 개면 어느 하나는 반드시
   * 끊긴다 — 전부 아니면 전무는 전수 수집에서 성립하지 않는다.
   */
  const page = (rows: number, offset: number) => ({
    totalCount: 3000,
    data: Array.from({ length: rows }, (_, i) => ({
      bizesId: `V${offset + i}`, bizesNm: `업체${offset + i}웨딩홀`, brchNm: '',
      indsSclsNm: '예식장업', ctprvnCd: '11', rdnmAdr: '서울특별시 강남구 길 1',
    })),
  });

  const origFetch = global.fetch;
  const savedRetries = process.env.PUBLIC_DATA_RETRIES;
  // 실제로 4분을 기다리지 않는다 — 여기서 보는 것은 끊긴 뒤의 처리다.
  process.env.PUBLIC_DATA_RETRIES = '1';
  let call = 0;

  global.fetch = jest.fn().mockImplementation(() => {
    call += 1;
    // 첫 쪽은 가득 채워 주고, 둘째 쪽부터 연결이 끊긴다.
    if (call > 1) return Promise.reject(new TypeError('fetch failed'));

    const body = Buffer.from(JSON.stringify(page(1000, 0)));

    return Promise.resolve({
      ok: true,
      body: { [Symbol.asyncIterator]: async function* () { yield body; } },
    });
  });

  try {
    const result = await downloadSbizApiVendors(
      'sbiz-seoul', 'test-key', new Date('2026-09-10T00:00:00Z'),
      { divId: 'indsSclsCd', codes: ['S21101'] });

    expect(result.vendors).toHaveLength(1000);
    expect(result.truncated).toEqual([
      { code: 'S21101', got: 1000, total: 3000, reason: '연결 끊김' },
    ]);
  } finally {
    global.fetch = origFetch;
    if (savedRetries === undefined) delete process.env.PUBLIC_DATA_RETRIES;
    else process.env.PUBLIC_DATA_RETRIES = savedRetries;
  }
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

test('업종 12종으로 매핑하고, 확정 못 한 것은 버리지 않고 etc로 받는다', () => {
  const rows: [string, string, string][] = [
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
    ['한복 소매업', '웨딩한복관', 'dowry'],
    // 규칙에 없는 업종인데 상호가 웨딩이면 사람이 업종을 정한다.
    ['그외 기타 분류 안된 서비스업', '웨딩종합서비스', 'etc'],
  ];
  for (const [industry, name, expected] of rows)
    for (const preFiltered of [true, false])
      expect([industry, name, preFiltered, resolveSbizCategory(industry, name, preFiltered)])
        .toEqual([industry, name, preFiltered, expected]);
});

/*
 * 2026-09-11 대표 지시 — 「실제 데이터 보고 맞지 않을 경우 기타로 다 집어넣는다」.
 * 「웨딩」을 상호에 안 붙인 실제 거래처가 통째로 사라지던 것을 막는다.
 *
 * 다만 그 규칙은 **업종코드로 이미 걸러 온 행에만** 쓴다. 전국 상권 CSV는 거르는
 * 자리가 없어서 그대로 두면 전국 사업자 명부가 통째로 «기타»로 들어온다.
 */
test('걸러 온 행은 상호 표시가 없어도 기타로 받는다', () => {
  const rows: [string, string][] = [
    ['그외 기타 미용업', '동네미용실'],
    ['화훼 소매업', '골목꽃집'],
    ['일반 여행사업', '싼값여행사'],
    ['한복 소매업', '우리한복'],
  ];
  for (const [industry, name] of rows) {
    // OpenAPI — WEDDING_UPJONG_CODES로 받아올 업종을 이미 골랐다.
    expect([name, resolveSbizCategory(industry, name, true)]).toEqual([name, 'etc']);
    // 전국 상권 CSV — 거르는 자리가 없어 상호 표시가 없으면 버린다.
    expect([name, resolveSbizCategory(industry, name, false)]).toEqual([name, null]);
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
