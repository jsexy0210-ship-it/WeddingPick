/**
 * 회원탈퇴. 디자인 핸드오프 WP-MY-008.
 *
 * **탈퇴는 개인정보 삭제이지, 서비스 정보 삭제가 아니다.** 내가 남긴 후기 하나가
 * 사라지면 그 업체를 보던 다음 사람의 판단 근거가 함께 사라진다. 탈퇴한 사람이
 * 요구한 것은 "나를 지워달라"이지 "내가 남긴 사실을 세상에서 없애달라"가 아니다.
 *
 * 그래서 화면은 두 묶음을 나눠 적는다 — 지워지는 것과, 작성자 정보와 분리돼
 * 유지되는 것.
 *
 * **문구가 여기 있는 이유는 세 곳이 같은 말을 해야 하기 때문이다** — 탈퇴 화면 ·
 * 이용약관 제12조 · 개인정보처리방침 보유기간 표. 화면에서만 고치면 나머지 둘과
 * 어긋나고, 어긋나면 읽는 사람은 어느 쪽이 맞는지 알 수 없다.
 */

export const WITHDRAWAL_HEADLINE = '정말 그만두시나요?';

/** 화면이 동의를 받기 전에 반드시 보여주는 두 줄. */
export const WITHDRAWAL_TITLE = '탈퇴하면 계정과 개인화 정보는 삭제돼요';
export const WITHDRAWAL_IRREVERSIBLE =
  '다시 되돌릴 수 없어요. 같은 계정으로 다시 가입하면 새로 시작해요.';

export const WITHDRAWAL_CONSENT = '위 내용을 확인했고 탈퇴에 동의해요';
export const WITHDRAWAL_CANCEL = '그대로 둘게요';
export const WITHDRAWAL_SUBMIT = '탈퇴하기';

export const WITHDRAWAL_DELETED_GROUP = '지워지는 것';

/**
 * 유지되는 묶음의 이름.
 *
 * **`남는 것`이라고 쓰지 않는다.** 남는다는 말은 "내 것이 그대로 있다"로 읽히지만,
 * 실제로 유지되는 것은 작성자 정보와 끊어진 자료다. 이름이 사실과 다르면 그 화면은
 * 동의를 받은 것이 아니라 오해를 받은 것이 된다.
 */
export const WITHDRAWAL_SEPARATED_GROUP = '작성자 정보와 분리되는 정보';
/** 통합정책 v3.15 §J-3 "하단 고지"의 문구를 그대로 쓴다. */
export const WITHDRAWAL_SEPARATED_NOTE =
  '후기와 실 제보는 나를 알아볼 수 없도록 분리해 유지될 수 있어요';
export const WITHDRAWAL_SEPARATED_EMPTY = '작성한 후기나 남는 정보가 없어요';
export const WITHDRAWAL_ANONYMOUS_BADGE = '익명';

/** 되돌릴 수 없는 행동이라 시트로 한 번 더 묻는다. */
export const WITHDRAWAL_SHEET_TITLE = '탈퇴를 진행할까요?';
export const WITHDRAWAL_SHEET_BODY =
  '탈퇴하면 계정과 개인화 정보가 삭제돼요. 삭제된 정보는 되돌릴 수 없어요.';

/** 완료 화면. **성공 모션을 넣지 않는다** — 축하할 일이 아니다. */
export const WITHDRAWAL_DONE_TITLE = '탈퇴가 끝났어요';
export const WITHDRAWAL_DONE_BODY = '그동안 웨딩픽을 써주셔서 고마웠어요';
export const WITHDRAWAL_DONE_GROUP = '처리된 내용';

export type WithdrawalRow = { label: string; value: string; empty?: boolean };
export type WithdrawalKeptRow = { label: string; note: string; anonymous: boolean };

/**
 * 탈퇴하면 어떻게 되는지 세는 값.
 *
 * 개수를 화면이 짐작하지 않는다. `Pick한 곳 8곳`은 서버가 센 값이어야 하고, 세지
 * 못한 것을 0으로 적지 않는다 — 0곳이라고 적힌 화면을 보고 누른 사람은 자기가
 * 무엇을 지우는지 모른 채 누른 것이다.
 */
export type WithdrawalCounts = {
  hasPartner: boolean;
  /**
   * 배우자를 부를 이름.
   *
   * 우리는 이름을 저장하지 않는다(`structured.users`는 식별자만 둔다). 그래서
   * 대개 null이고, 그때는 이름 없이 말한다 — **없는 이름을 지어내지 않는다.**
   */
  partnerName: string | null;
  candidates: number;
  tasks: number;
  expenseTotal: number;
  reviews: number;
  confirmedReports: number;
};

const 만 = 10_000;

/** 지출 합계를 화면 단위로. 원 단위까지 적으면 읽는 눈이 숫자에 걸린다. */
export function formatWon(amount: number): string {
  if (amount % 만 === 0) return `${(amount / 만).toLocaleString('ko-KR')}만원`;

  return `${amount.toLocaleString('ko-KR')}원`;
}

/** 배우자가 있으면 그 사실부터 말한다. 함께 만든 기록이 함께 사라지기 때문이다. */
export function withdrawalLead(counts: WithdrawalCounts): string {
  if (!counts.hasPartner) return '지금까지 준비한 기록이 사라져요';

  return counts.partnerName
    ? `${counts.partnerName}님과 함께 만든 기록도 함께 사라져요`
    : '배우자와 함께 만든 기록도 함께 사라져요';
}

/**
 * 지워지는 것.
 *
 * 값 칸에는 **그 사람의 실제 값**을 적는다. `일정 · 체크리스트 12개`는 12개를
 * 지운다는 뜻이고, 숫자가 없으면 무엇을 잃는지 모른 채 동의하게 된다.
 *
 * 배우자가 없으면 배우자 줄을 넣지 않는다 — 없는 것을 지운다고 적으면 화면이
 * 그 사람의 형편이 아니라 우리 표를 말하게 된다.
 */
export function deletedOnWithdrawal(counts: WithdrawalCounts): WithdrawalRow[] {
  const spend: WithdrawalRow =
    counts.expenseTotal > 0
      ? { label: '지출 기록', value: formatWon(counts.expenseTotal) }
      : { label: '지출 기록', value: '없어요', empty: true };

  if (!counts.hasPartner) {
    return [
      { label: '계정 · 프로필', value: '즉시 삭제' },
      { label: 'Pick한 곳', value: `${counts.candidates}곳` },
      { label: '일정 · 체크리스트', value: `${counts.tasks}개` },
      spend,
      { label: '취향 · 개인화', value: '즉시 삭제' },
    ];
  }

  return [
    { label: '계정 · 프로필', value: '즉시 삭제' },
    { label: '배우자 연결', value: '즉시 해제' },
    { label: 'Pick한 곳', value: `${counts.candidates}곳` },
    { label: '일정 · 체크리스트', value: `${counts.tasks}개` },
    spend,
    // 며칠 뒤가 아니라 목적이 끝나면 지운다. 날짜를 약속하지 않는다.
    { label: 'Pick 인증 자료', value: '목적 달성 시 삭제' },
  ];
}

/**
 * 작성자 정보와 분리돼 유지되는 것.
 *
 * **일수를 화면에 쓰지 않는다.** 통합정책 v3.15 §J-3에 따라 보존 기간은 관련 법령
 * (전자상거래법·통신비밀보호법 등)의 법정 보존 기간에서 직접 가져온다. 서버가 그
 * 기간에 맞춰 처리하며, 화면에 숫자를 직접 명시하면 법령 개정 시 화면과 법령이
 * 어긋나는 문제가 생기므로 적지 않는다.
 *
 * 남긴 것이 하나도 없으면 빈 목록을 낸다. 화면은 그때 `WITHDRAWAL_SEPARATED_EMPTY`를
 * 적는다 — 0건짜리 줄을 세우면 있지도 않은 것을 잃는 것처럼 보인다.
 */
export function separatedOnWithdrawal(counts: WithdrawalCounts): WithdrawalKeptRow[] {
  const rows: WithdrawalKeptRow[] = [];

  if (counts.reviews > 0) {
    rows.push({
      label: `작성한 후기 ${counts.reviews}건`,
      note: '나를 알아볼 수 없도록 분리해 유지될 수 있어요',
      anonymous: true,
    });
  }

  if (counts.confirmedReports > 0) {
    rows.push({
      label: `Pick 인증한 정보 ${counts.confirmedReports}건`,
      note: '업체별 금액 구간에만 반영돼요',
      anonymous: true,
    });
  }

  if (rows.length > 0) {
    rows.push({
      label: '신고 · 분쟁 기록',
      note: '처리와 법령에 필요한 기간 동안 별도로 보관해요',
      anonymous: false,
    });
  }

  return rows;
}

/** 완료 화면이 적는 처리 내역. 무엇이 실제로 일어났는지만 담백하게 적는다. */
export function withdrawalDoneItems(counts: WithdrawalCounts): string[] {
  const items = ['계정과 프로필을 삭제했어요'];

  if (counts.hasPartner) {
    items.push(
      counts.partnerName
        ? `${counts.partnerName}님과의 연결을 해제했어요`
        : '배우자와의 연결을 해제했어요'
    );
  }

  items.push('Pick · 일정 · 지출 기록을 삭제했어요');

  if (counts.reviews > 0 || counts.confirmedReports > 0) {
    items.push('후기와 실 제보는 나를 알아볼 수 없도록 분리했어요');
  }

  return items;
}

/**
 * 운영자는 앱에서 탈퇴할 수 없다.
 *
 * 운영자가 내린 결정에는 그 사람이 남아 있어야 한다 — 파기 승인과 광고 전환 승인은
 * 스키마가 사람을 지우지 못하게 막아둔 자리(RESTRICT)다. 앱이 그 사실을 모른 채
 * 탈퇴를 받으면 마지막 단계에서 알 수 없는 오류로 끝난다. 미리 막고 이유를 말한다.
 */
export const OPERATOR_CANNOT_WITHDRAW =
  '운영자 계정은 앱에서 탈퇴할 수 없어요. 문의 창구로 알려주세요.';
