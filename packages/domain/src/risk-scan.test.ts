import { RISK_KIND_LABEL, riskNotice, scanForRisk, shouldHideImmediately } from './risk-scan';

/**
 * 이 표는 **실제 후기에 나올 법한 문장으로 찔러본 결과**다. 테스트를 먼저 쓰고
 * 통과시킨 것이 아니라, 스무 문장을 넣어보고 걸린 것을 고친 뒤 남긴 것이다.
 */
describe('위험정보 찾기', () => {
  const clean = [
    '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.',
    '2026-08-29에 계약했고 잔금은 2027-04-17에 냈습니다.',
    '총 3,000,000원을 결제했고 보증인원은 250명이었어요.',
    '식대가 1인 65,000원이라 200명 기준 1300만원 나왔습니다.',
    '2026.08.29 상담, 2026.09.02 계약했어요.',
    '보증인원 200-250명 사이로 조정 가능하다고 했어요.',
    '11-12월은 성수기라 대관료가 더 비쌌습니다.',
    '홀 3개를 봤는데 A홀 500만원, B홀 620만원, C홀 480만원이었습니다.',
    '식사는 뷔페 65000원, 코스 89000원 두 가지였어요.',
    '스튜디오 촬영은 4시간이었고 원본 300장을 받았어요.',
  ];

  it('멀쩡한 후기를 걸지 않는다', () => {
    /*
     * 오탐이 더 나쁘다. 위험정보를 하나 놓치면 신고로 받을 수 있지만, 멀쩡한
     * 후기가 자동으로 가려지면 쓴 사람은 이유도 모르고 글을 잃는다.
     */
    for (const text of clean) {
      expect({ text, kinds: scanForRisk(text) }).toEqual({ text, kinds: [] });
    }
  });

  it('날짜를 계좌번호로 읽지 않는다', () => {
    // 자릿수만으로는 2026-08-29가 계좌처럼 보인다. 흔한 문장이라 특히 위험하다.
    expect(scanForRisk('2026-08-29에 계약했습니다')).toEqual([]);
  });

  it.each([
    ['문의는 010-1234-5678로 주세요', 'phone_number'],
    ['연락처 01012345678입니다', 'phone_number'],
    ['02-123-4567로 전화주세요', 'phone_number'],
    ['031-123-4567 여기로 연락하래요', 'phone_number'],
    ['주민번호 900101-1234567을 요구했어요', 'resident_registration_number'],
    ['입금은 국민은행 123-456-789012로 하래요', 'account_number'],
    ['계좌 110-234-567890으로 보냈습니다', 'account_number'],
    ['카드 1234-5678-1234-5678로 결제했어요', 'card_number'],
    ['담당자 이메일 hong@example.com으로 보내라고 했습니다', 'email'],
  ])('%s → %s', (text, kind) => {
    /*
     * **하나만 나온다.** 잡은 자리를 지우고 다음으로 넘기기 전에는 전화번호가
     * 계좌번호로도 잡혀, 화면이 "전화번호 · 계좌번호로 보이는 내용이 있어요"라고
     * 틀린 말을 했다.
     */
    expect(scanForRisk(text)).toEqual([kind]);
  });

  it('찾은 값을 돌려주지 않는다', () => {
    // 추출규칙 10번. 값을 돌려주면 그 값이 로그와 알림을 타고 번진다.
    const kinds = scanForRisk('연락처 010-1234-5678');

    expect(JSON.stringify(kinds)).not.toContain('1234');
  });

  it('안내 문구가 값을 되읽어주지 않는다', () => {
    // 지우라고 말하면서 한 번 더 적는 셈이 되면 안 된다.
    const notice = riskNotice(scanForRisk('연락처 010-1234-5678'));

    expect(notice).toContain('전화번호');
    expect(notice).not.toContain('1234');
  });

  it('부정적인 후기라는 이유만으로는 가리지 않는다', () => {
    // 원문 24번이 못박은 것이다.
    expect(
      shouldHideImmediately('상담이 불친절했고 안내받은 금액과 계약서 금액이 달랐습니다.')
    ).toBe(false);
  });

  it('위험정보가 있으면 바로 가린다', () => {
    expect(shouldHideImmediately('계좌 110-234-567890으로 입금하래요')).toBe(true);
  });

  it('모든 종류에 사람이 읽는 이름이 있다', () => {
    for (const kind of scanForRisk('010-1234-5678 900101-1234567 hong@example.com')) {
      expect(RISK_KIND_LABEL[kind].length).toBeGreaterThan(0);
    }
  });
});
