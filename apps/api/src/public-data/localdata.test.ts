import iconv from 'iconv-lite';

import { MissingColumnError, parseLocaldataCsv, toRegion } from './localdata';

/** 인허가 자료는 CP949로 내려온다. */
function cp949(rows: string[][]): Buffer {
  return iconv.encode(rows.map((row) => row.join(',')).join('\n'), 'cp949');
}

const HEADERS = [
  '개방자치단체코드',
  '관리번호',
  '인허가일자',
  '영업상태명',
  '상세영업상태명',
  '폐업일자',
  '사업장명',
  '소재지전체주소',
  '도로명전체주소',
  '데이터갱신일자',
];

const row = (overrides: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    개방자치단체코드: '3220000',
    관리번호: '3220000-101-2020-00001',
    인허가일자: '20200310',
    영업상태명: '영업/정상',
    상세영업상태명: '영업중',
    폐업일자: '',
    사업장명: '더채플앳청담',
    소재지전체주소: '서울특별시 강남구 청담동 123',
    도로명전체주소: '서울특별시 강남구 도산대로 456',
    데이터갱신일자: '2026-08-01',
    ...overrides,
  };

  return HEADERS.map((header) => base[header] ?? '');
};

describe('인허가 자료 읽기', () => {
  it('영업 중인 업체를 이름·지역과 함께 읽는다', () => {
    const { vendors } = parseLocaldataCsv(cp949([HEADERS, row()]));

    expect(vendors).toEqual([
      {
        name: '더채플앳청담',
        region: '서울특별시 강남구',
        address: '서울특별시 강남구 도산대로 456',
        lastVerifiedAt: '2026-08-01',
      },
    ]);
  });

  it('폐업한 업체는 빼고 센다', () => {
    const { vendors, skipped } = parseLocaldataCsv(
      cp949([
        HEADERS,
        row(),
        row({ 사업장명: '문닫은홀', 폐업일자: '20240101', 상세영업상태명: '폐업' }),
        row({ 사업장명: '휴업홀', 상세영업상태명: '휴업' }),
      ])
    );

    // 폐업한 곳을 비교 대상에 올리지 않는다.
    expect(vendors.map((vendor) => vendor.name)).toEqual(['더채플앳청담']);
    expect(skipped).toBe(2);
  });

  it('도로명주소가 없으면 지번주소를 쓴다', () => {
    const { vendors } = parseLocaldataCsv(cp949([HEADERS, row({ 도로명전체주소: '' })]));

    expect(vendors[0]!.address).toBe('서울특별시 강남구 청담동 123');
  });

  it('이름이나 주소가 비어 있는 행은 버린다', () => {
    const { vendors, skipped } = parseLocaldataCsv(
      cp949([
        HEADERS,
        row({ 사업장명: '' }),
        row({ 소재지전체주소: '', 도로명전체주소: '' }),
      ])
    );

    expect(vendors).toHaveLength(0);
    expect(skipped).toBe(2);
  });

  it('갱신일자가 없으면 읽은 날을 쓴다', () => {
    const { vendors } = parseLocaldataCsv(cp949([HEADERS, row({ 데이터갱신일자: '' })]), {
      readAt: new Date('2026-08-28T00:00:00Z'),
    });

    // 사업계획서 25번: 변하기 쉬운 정보는 마지막 확인일을 함께 둔다.
    expect(vendors[0]!.lastVerifiedAt).toBe('2026-08-28');
  });

  it('20260516 형식 날짜도 읽는다', () => {
    const { vendors } = parseLocaldataCsv(cp949([HEADERS, row({ 데이터갱신일자: '20260516' })]));

    expect(vendors[0]!.lastVerifiedAt).toBe('2026-05-16');
  });

  it('컬럼 이름이 달라도 후보 안에 있으면 찾는다', () => {
    const headers = ['업소명', '지번주소', '영업상태구분명'];
    const { vendors } = parseLocaldataCsv(
      cp949([headers, ['라움', '서울특별시 성동구 왕십리로 1', '영업']])
    );

    expect(vendors[0]).toMatchObject({ name: '라움', region: '서울특별시 성동구' });
  });

  it('이름 컬럼을 못 찾으면 실제 헤더를 알려주고 멈춘다', () => {
    // 엉뚱한 컬럼을 업체명으로 잡는 것보다 멈추는 편이 낫다.
    expect(() => parseLocaldataCsv(cp949([['알수없는컬럼', '주소'], ['가', '나']]))).toThrow(
      MissingColumnError
    );

    try {
      parseLocaldataCsv(cp949([['알수없는컬럼', '또다른컬럼'], ['가', '나']]));
    } catch (error) {
      expect((error as Error).message).toContain('알수없는컬럼');
      expect((error as Error).message).toContain('사업장명');
    }
  });

  it('쉼표가 들어간 상호도 깨지지 않는다', () => {
    const { vendors } = parseLocaldataCsv(
      cp949([HEADERS, row({ 사업장명: '"웨딩홀, 강남점"' })])
    );

    expect(vendors[0]!.name).toBe('웨딩홀, 강남점');
  });
});

describe('지역 뽑기', () => {
  it('시도와 시군구까지만 남긴다', () => {
    expect(toRegion('서울특별시 강남구 도산대로 456')).toBe('서울특별시 강남구');
    expect(toRegion('경기도 성남시 분당구 판교로 1')).toBe('경기도 성남시');
  });
});
