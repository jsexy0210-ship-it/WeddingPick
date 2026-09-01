import { LOW_CONFIDENCE_THRESHOLD } from './document';
import {
  fieldsNeedingConfirmation,
  needsVisionFallback,
  parsePaymentText,
} from './payment-parser';

/** 문자를 받은 시점. 연도 없는 날짜를 언제로 읽는지가 이 값에 걸린다. */
const NOW = new Date('2026-08-28T09:00:00+09:00');

describe('결제문자 읽기', () => {
  it('카드 승인 문자를 읽는다', () => {
    const parsed = parsePaymentText(
      ['[Web발신]', '신한카드(1234)승인 홍*동', '3,000,000원 일시불', '05/20 14:23', '가온예식홀'].join(
        '\n'
      ),
      NOW
    );

    expect(parsed.rejection).toBeNull();
    expect(parsed.merchantName?.value).toBe('가온예식홀');
    expect(parsed.paidAmount?.value).toBe(3_000_000);
    expect(parsed.method?.value).toBe('card');
    expect(parsed.paidAt?.value.slice(0, 10)).toBe('2026-05-20');
    expect(parsed.missing).toEqual([]);
  });

  it('누적·잔액을 결제 금액으로 읽지 않는다', () => {
    /*
     * 가장 큰 수를 고르면 누적을 집는다. 그래서 고르는 규칙이 아니라 빼는 규칙을 쓴다.
     */
    const parsed = parsePaymentText(
      [
        '[Web발신]',
        'KB국민카드 승인',
        '3,000,000원 일시불',
        '05/20 14:23',
        '가온예식홀',
        '누적 12,450,000원',
      ].join('\n'),
      NOW
    );

    expect(parsed.paidAmount?.value).toBe(3_000_000);
  });

  it('이체 알림의 잔액도 마찬가지다', () => {
    const parsed = parsePaymentText(
      ['[Web발신]', '국민 12*******34', '05/20 14:23', '3,000,000원 이체출금', '가온예식홀', '잔액 1,234,567원'].join(
        '\n'
      ),
      NOW
    );

    expect(parsed.paidAmount?.value).toBe(3_000_000);
    expect(parsed.method?.value).toBe('transfer');
    expect(parsed.merchantName?.value).toBe('가온예식홀');
  });

  it('날짜와 이름이 한 줄에 있어도 읽는다', () => {
    // 줄 단위로 버리면 이름까지 같이 버린다. 그래서 토큰 단위로 지운다.
    const parsed = parsePaymentText(
      ['[Web발신]', '삼성카드 승인', '1,500,000원', '06/12 11:03 스튜디오온'].join('\n'),
      NOW
    );

    expect(parsed.merchantName?.value).toBe('스튜디오온');
    expect(parsed.paidAt?.value.slice(0, 10)).toBe('2026-06-12');
  });

  it('연도가 없으면 오늘보다 뒤가 되지 않는 해로 읽는다', () => {
    // 앞으로의 결제는 없다. 8월에 받은 12/28은 작년 12월이다.
    const parsed = parsePaymentText(
      ['현대카드 승인', '2,000,000원', '12/28 15:00', '가온예식홀'].join('\n'),
      NOW
    );

    expect(parsed.paidAt?.value.slice(0, 7)).toBe('2025-12');
  });

  it('연도를 추정한 값은 사람이 확인한다', () => {
    // 한 해가 어긋나면 "최근 12개월"이 통째로 달라진다. 기준값과 똑같이 두면
    // 경계에 걸려 아무것도 표시되지 않는다 — 그래서 기준보다 낮아야 한다.
    const short = parsePaymentText('신한카드 승인 100,000원 05/20 가온예식홀', NOW);
    const full = parsePaymentText('신한카드 승인 100,000원 2026-05-20 가온예식홀', NOW);

    expect(short.paidAt!.confidence).toBeLessThan(full.paidAt!.confidence);
    expect(fieldsNeedingConfirmation(short, LOW_CONFIDENCE_THRESHOLD)).toContain('paidAt');
    expect(fieldsNeedingConfirmation(full, LOW_CONFIDENCE_THRESHOLD)).not.toContain('paidAt');
  });

  it('없는 날짜는 만들지 않는다', () => {
    const parsed = parsePaymentText('신한카드 승인 100,000원 02/31 가온예식홀', NOW);

    // 적혀 있지 않은 값은 null로 둔다(추출규칙 1번). 2월 31일은 없다.
    expect(parsed.paidAt).toBeNull();
    expect(parsed.missing).toContain('paidAt');
  });

  it('취소 문자는 등록으로 넘기지 않는다', () => {
    /*
     * 취소를 결제로 등록하면 낸 적 없는 돈이 낸 돈이 된다. 읽기 실패보다 나쁘다 —
     * 읽기 실패는 눈에 보이지만 이건 안 보인다.
     */
    const parsed = parsePaymentText(
      ['[Web발신]', '신한카드 승인취소', '3,000,000원', '05/22 10:00', '가온예식홀'].join('\n'),
      NOW
    );

    expect(parsed.rejection).toContain('취소');
    expect(parsed.paidAmount).toBeNull();
    // 취소 문자로는 AI를 부르지 않는다. 읽을 것이 없어서가 아니라 읽으면 안 돼서다.
    expect(needsVisionFallback(parsed)).toBe(false);
  });

  it('결제 안내가 아닌 글은 거절한다', () => {
    const parsed = parsePaymentText('안녕하세요 상담 문의드립니다 010-1234-5678', NOW);

    expect(parsed.rejection).toContain('금액이 적힌 안내문으로 보이지 않아요');
  });

  it('빈 글도 거절한다', () => {
    expect(parsePaymentText('   ', NOW).rejection).toBeTruthy();
  });
});

describe('식별정보는 종류만 남는다', () => {
  it('카드번호가 있었다는 것까지만 안다', () => {
    const parsed = parsePaymentText(
      ['신한카드(1234)승인 홍*동', '3,000,000원 일시불', '05/20 14:23', '가온예식홀'].join('\n'),
      NOW
    );

    expect(parsed.maskedIdentifiers).toContain('card_number');
    // 가족카드 명의자가 찍히는 자리다(스펙 8.4).
    expect(parsed.maskedIdentifiers).toContain('person_name');
  });

  it('읽어낸 값 어디에도 그 번호가 없다', () => {
    /*
     * 반환 타입에 카드번호를 담을 필드가 없다. 읽더라도 밖으로 나가지 못한다.
     * 이 테스트는 그 사실을 값으로 확인한다.
     */
    const parsed = parsePaymentText(
      ['신한카드(1234)승인 홍*동', '3,000,000원 일시불', '05/20 14:23', '가온예식홀'].join('\n'),
      NOW
    );

    expect(JSON.stringify(parsed)).not.toContain('1234');
    expect(JSON.stringify(parsed)).not.toContain('홍');
  });

  it('마스킹되지 않은 이름도 잡는다', () => {
    /*
     * 처음에는 홍*동만 찾았다. 실제 문자에는 이름이 그대로 찍혀 나오는 것이 있고,
     * 마스킹된 쪽보다 그쪽이 더 위험한데 못 보고 있었다.
     */
    const parsed = parsePaymentText(
      ['[Web발신]', '롯데카드', '승인 홍길동님', '1,200,000원 3개월 할부', '07/03 16:41', '(주)라비돌웨딩'].join(
        '\n'
      ),
      NOW
    );

    expect(parsed.maskedIdentifiers).toContain('person_name');
    // 그리고 그 이름이 가맹점 자리로 새어 들어가지 않는다.
    expect(parsed.merchantName?.value).toBe('(주)라비돌웨딩');
    expect(JSON.stringify(parsed)).not.toContain('홍길동');
  });

  it('날짜를 계좌번호로 읽지 않는다', () => {
    // 2026-07-03은 계좌번호처럼 생겼다. 없는 계좌를 찾아내면 안 된다.
    const parsed = parsePaymentText('현금영수증 발급\n2026-07-03\n3,000,000원\n가온예식홀', NOW);

    expect(parsed.maskedIdentifiers).not.toContain('account_number');
    expect(parsed.merchantName?.value).toBe('가온예식홀');
  });

  it('가맹점 이름에 마스킹된 이름이 섞이지 않는다', () => {
    const parsed = parsePaymentText(
      ['NH농협체크 승인', '홍*동님 3,000,000원', '05/20 14:23 가온예식홀'].join('\n'),
      NOW
    );

    expect(parsed.merchantName?.value).toBe('가온예식홀');
  });
});

describe('상호에 카드사 이름이 들어가도 지우지 않는다', () => {
  it('하나웨딩컨벤션의 하나를 지우지 않는다', () => {
    // 카드사 이름은 카드·은행이 뒤에 붙었을 때만 지운다.
    const parsed = parsePaymentText(
      ['[Web발신]', '하나카드 승인', '5,000,000원 일시불', '07/03 16:41', '하나웨딩컨벤션'].join('\n'),
      NOW
    );

    expect(parsed.merchantName?.value).toBe('하나웨딩컨벤션');
    expect(parsed.merchantName!.confidence).toBeGreaterThan(0.8);
  });

  it('체크카드가 가맹점 후보로 남지 않는다', () => {
    const parsed = parsePaymentText(
      ['[Web발신]', '토스뱅크 체크카드 승인', '450,000원', '07/03 16:41', '메이크업스튜디오온'].join('\n'),
      NOW
    );

    expect(parsed.merchantName?.value).toBe('메이크업스튜디오온');
    // 후보가 하나뿐이라 확신이 높다. 찌꺼기가 남으면 여기가 0.5로 떨어진다.
    expect(parsed.merchantName!.confidence).toBeGreaterThan(0.8);
  });

  it('영문 상호도 읽는다', () => {
    const parsed = parsePaymentText(
      ['[Web발신]', '신한카드(1234)승인', '2,000,000원 일시불', '07/03 16:41', 'THE CHAPEL'].join('\n'),
      NOW
    );

    expect(parsed.merchantName?.value).toBe('THE CHAPEL');
  });
});

describe('언제 다음 단계로 넘기는가', () => {
  it('핵심 셋이 다 읽히면 넘기지 않는다', () => {
    const parsed = parsePaymentText(
      ['신한카드 승인', '3,000,000원 일시불', '05/20 14:23', '가온예식홀'].join('\n'),
      NOW
    );

    expect(needsVisionFallback(parsed)).toBe(false);
  });

  it('가맹점을 못 읽으면 넘긴다', () => {
    const parsed = parsePaymentText('신한카드 승인 3,000,000원 05/20 14:23', NOW);

    expect(parsed.merchantName).toBeNull();
    expect(needsVisionFallback(parsed)).toBe(true);
  });

  it('결제 수단 하나 때문에 넘기지는 않는다', () => {
    /*
     * 못 읽으면 '확인 안 됨'으로 두면 된다. 그것 하나 때문에 AI를 부르는 것은
     * 스펙 7.3이 막으려던 바로 그 일이다.
     */
    const parsed = parsePaymentText('영수증 3,000,000원 2026-05-20 가온예식홀', NOW);

    expect(parsed.method).toBeNull();
    expect(needsVisionFallback(parsed)).toBe(false);
  });
});

describe('확신이 낮은 것은 사람이 본다', () => {
  it('가맹점 후보가 여럿이면 확인을 받는다', () => {
    // 이름을 잘못 읽으면 남의 업체 분포에 내 결제가 들어간다.
    const parsed = parsePaymentText(
      ['신한카드 승인', '3,000,000원 일시불', '05/20 14:23', '가온예식홀', '강남지점 웨딩사업부'].join(
        '\n'
      ),
      NOW
    );

    expect(fieldsNeedingConfirmation(parsed, LOW_CONFIDENCE_THRESHOLD)).toContain('merchantName');
  });

  it('문서 쪽과 같은 기준값을 쓴다', () => {
    // 두 화면이 다른 기준으로 "확인해 주세요"를 띄우면 그 표시를 못 믿게 된다.
    const parsed = parsePaymentText(
      ['신한카드 승인', '3,000,000원 일시불', '2026-05-20 14:23', '가온예식홀'].join('\n'),
      NOW
    );

    expect(fieldsNeedingConfirmation(parsed, LOW_CONFIDENCE_THRESHOLD)).toEqual([]);
  });
});
