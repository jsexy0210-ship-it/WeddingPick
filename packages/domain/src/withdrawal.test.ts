import { findBannedPhrases, findVaguePhrases } from './copy-rules';
import {
  WITHDRAWAL_ANONYMOUS_BADGE,
  WITHDRAWAL_IRREVERSIBLE,
  WITHDRAWAL_SEPARATED_EMPTY,
  WITHDRAWAL_SEPARATED_GROUP,
  WITHDRAWAL_SEPARATED_NOTE,
  WITHDRAWAL_SHEET_BODY,
  WITHDRAWAL_TITLE,
  deletedOnWithdrawal,
  formatWon,
  separatedOnWithdrawal,
  withdrawalDoneItems,
  withdrawalLead,
  type WithdrawalCounts,
} from './withdrawal';

const linked: WithdrawalCounts = {
  hasPartner: true,
  partnerName: '준호',
  candidates: 8,
  tasks: 12,
  expenseTotal: 21_400_000,
  reviews: 2,
  confirmedReports: 4,
};

const solo: WithdrawalCounts = {
  hasPartner: false,
  partnerName: null,
  candidates: 2,
  tasks: 3,
  expenseTotal: 0,
  reviews: 0,
  confirmedReports: 0,
};

describe('회원탈퇴 안내', () => {
  it('지워지는 것에 그 사람의 실제 개수가 들어간다', () => {
    // 개수가 없으면 무엇을 잃는지 모른 채 동의하게 된다.
    const rows = deletedOnWithdrawal(linked);

    expect(rows).toContainEqual({ label: 'Pick한 곳', value: '8곳' });
    expect(rows).toContainEqual({ label: '일정 · 체크리스트', value: '12개' });
    expect(rows).toContainEqual({ label: '지출 기록', value: '2,140만원' });
    expect(rows).toContainEqual({ label: '배우자 연결', value: '즉시 해제' });
  });

  it('배우자가 없으면 배우자 줄을 세우지 않는다', () => {
    // 없는 것을 지운다고 적으면 화면이 그 사람의 형편이 아니라 우리 표를 말하게 된다.
    const rows = deletedOnWithdrawal(solo);

    expect(rows.map((row) => row.label)).not.toContain('배우자 연결');
    expect(rows).toContainEqual({ label: '취향 · 개인화', value: '즉시 삭제' });
  });

  it('지출이 없으면 0원이 아니라 없다고 적는다', () => {
    expect(deletedOnWithdrawal(solo)).toContainEqual({
      label: '지출 기록',
      value: '없어요',
      empty: true,
    });
  });

  it('배우자 이름을 모르면 지어내지 않는다', () => {
    // structured.users 는 식별자만 둔다. 이름이 없는 것이 정상이다.
    expect(withdrawalLead(linked)).toBe('준호님과 함께 만든 기록도 함께 사라져요');
    expect(withdrawalLead({ ...linked, partnerName: null })).toBe(
      '배우자와 함께 만든 기록도 함께 사라져요'
    );
    expect(withdrawalLead(solo)).toBe('지금까지 준비한 기록이 사라져요');
  });

  it('유지되는 것에는 익명 배지가 붙는다', () => {
    const kept = separatedOnWithdrawal(linked);

    expect(kept[0]).toEqual({
      label: '작성한 후기 2건',
      note: '나를 알아볼 수 없도록 분리해 유지될 수 있어요',
      anonymous: true,
    });
    expect(kept[1]!.label).toBe('Pick 인증한 정보 4건');
    expect(kept[2]!.anonymous).toBe(false);
  });

  it('남긴 것이 없으면 0건짜리 줄을 세우지 않는다', () => {
    // 있지도 않은 것을 잃는 것처럼 보이면 안 된다. 화면은 빈 문구를 적는다.
    expect(separatedOnWithdrawal(solo)).toEqual([]);
  });

  it('보존 기간을 날짜나 일수로 약속하지 않는다', () => {
    /*
     * 항목별 법정기간은 개인정보처리방침이 확정될 때 정해진다. 그 전에 `30일`을
     * 적으면 지키지 못할 약속이 되고, 지키지 못한 약속은 안 한 것보다 나쁘다.
     */
    const text = [
      ...separatedOnWithdrawal(linked).map((row) => `${row.label} ${row.note}`),
      ...deletedOnWithdrawal(linked).map((row) => `${row.label} ${row.value}`),
      WITHDRAWAL_SHEET_BODY,
    ].join(' ');

    expect(text).not.toMatch(/\d+\s*(일|개월|년)\b/);
  });

  it('완료 화면은 일어난 일만 적는다', () => {
    expect(withdrawalDoneItems(linked)).toEqual([
      '계정과 프로필을 삭제했어요',
      '준호님과의 연결을 해제했어요',
      'Pick · 일정 · 지출 기록을 삭제했어요',
      '후기와 실 제보는 나를 알아볼 수 없도록 분리했어요',
    ]);

    // 분리한 것이 없으면 분리했다고 적지 않는다.
    expect(withdrawalDoneItems(solo)).toEqual([
      '계정과 프로필을 삭제했어요',
      'Pick · 일정 · 지출 기록을 삭제했어요',
    ]);
  });

  it('안내 문구가 화면 문구 규칙을 지킨다', () => {
    const texts = [
      WITHDRAWAL_TITLE,
      WITHDRAWAL_IRREVERSIBLE,
      WITHDRAWAL_SEPARATED_GROUP,
      WITHDRAWAL_SEPARATED_NOTE,
      WITHDRAWAL_SEPARATED_EMPTY,
      WITHDRAWAL_ANONYMOUS_BADGE,
      WITHDRAWAL_SHEET_BODY,
      withdrawalLead(linked),
      ...withdrawalDoneItems(linked),
      ...separatedOnWithdrawal(linked).flatMap((row) => [row.label, row.note]),
      ...deletedOnWithdrawal(linked).flatMap((row) => [row.label, row.value]),
    ];

    for (const text of texts) {
      expect(findBannedPhrases(text)).toEqual([]);
      expect(findVaguePhrases(text)).toEqual([]);
    }
  });

  it('유지되는 묶음을 `남는 것`이라 부르지 않는다', () => {
    // 남는다는 말은 "내 것이 그대로 있다"로 읽힌다. 실제로는 작성자와 끊어진 자료다.
    expect(WITHDRAWAL_SEPARATED_GROUP).toBe('작성자 정보와 분리되는 정보');
    expect(findBannedPhrases('남는 것')).not.toEqual([]);
  });

  it('금액은 만원 단위로 끊고, 딱 떨어지지 않으면 그대로 적는다', () => {
    expect(formatWon(21_400_000)).toBe('2,140만원');
    expect(formatWon(1_234_567)).toBe('1,234,567원');
  });
});
