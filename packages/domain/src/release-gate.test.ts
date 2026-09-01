import {
  LEGAL_FIELD_LABEL,
  REQUIRED_LEGAL_FIELDS,
  assertReleasable,
  checkRelease,
  isPlaceholder,
  type LegalNotice,
} from './release-gate';

const FILLED: LegalNotice = {
  businessName: '가온컴퍼니',
  representative: '김지선',
  registrationNumber: '000-00-00000',
  address: '서울특별시 강남구',
  supportContact: 'help@example.test',
  privacyOfficer: '개인정보 보호책임자 김지선',
  termsEffectiveOn: '2026-10-01',
  privacyEffectiveOn: '2026-10-01',
};

describe('아직 안 정해진 값', () => {
  it('비었거나 공백이면 안 정해진 것이다', () => {
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder(null)).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('   ')).toBe(true);
  });

  it('placeholder 글자가 들어 있으면 안 정해진 것이다', () => {
    expect(isPlaceholder('TBD')).toBe(true);
    expect(isPlaceholder('미정')).toBe(true);
    expect(isPlaceholder('사업자명 TODO')).toBe(true);
  });

  it('실제 값은 통과한다', () => {
    expect(isPlaceholder('가온컴퍼니')).toBe(false);
  });
});

describe('출시 차단', () => {
  it('값이 다 채워지면 값 쪽은 통과한다', () => {
    /*
     * 값과 문서를 따로 센다. 문서(약관·방침·탈퇴 안내)는 아직 확정 전이라 여전히
     * 막는데, 그건 값이 모자란 것과 다른 문제이고 고치는 사람도 다르다.
     */
    expect(checkRelease(FILLED).missing).toEqual([]);
  });

  it('하나라도 비면 막는다', () => {
    const check = checkRelease({ ...FILLED, registrationNumber: undefined });

    expect(check.releasable).toBe(false);
    expect(check.missing).toEqual(['registrationNumber']);
    expect(check.note).toContain(LEGAL_FIELD_LABEL.registrationNumber);
  });

  it('빈 값을 그럴듯한 기본값으로 채워주지 않는다', () => {
    /*
     * 여기서 `주식회사 웨딩픽` 같은 값을 넣어주면 진짜 사업자명이 뭔지 아무도
     * 안 묻게 된다.
     */
    const check = checkRelease({});

    expect(check.missing).toEqual([...REQUIRED_LEGAL_FIELDS]);
  });

  it('Production에서는 던진다', () => {
    // 경고는 로그에 한 줄 남고 지나간다. 이건 지나가면 안 되는 상태다.
    expect(() => assertReleasable('production', {})).toThrow('배포할 수 없다');
  });

  it('개발·테스트에서는 경고만 돌려준다', () => {
    expect(assertReleasable('development', {})).toContain('사업자명');
    expect(assertReleasable(undefined, {})).toContain('사업자명');
  });

  it('값을 다 채워도 문서가 안 되면 막는다', () => {
    // 사업자 정보만으로 문을 열 수 없다. 문서 쪽은 withdrawal.test가 함께 지킨다.
    expect(() => assertReleasable('production', FILLED)).toThrow('확정되지 않은 문서');
  });

  it('모든 항목에 사람이 읽을 이름이 있다', () => {
    for (const field of REQUIRED_LEGAL_FIELDS) {
      expect(LEGAL_FIELD_LABEL[field]).toBeTruthy();
    }
  });
});
