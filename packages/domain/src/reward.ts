/**
 * 이벤트 보상. 최종통합정책 v2.0 I장.
 *
 * **돈을 실제로 보내는 수단은 아직 없다.** 그래서 조건이 찼다는 판정까지가
 * 자동이고, 지급은 사람이 한다. 그 둘을 다른 상태로 두는 이유는, 하나로 두면
 * 화면이 "3,000원을 받았어요"라고 적게 되기 때문이다 — 아직 아무도 돈을 보내지
 * 않았다면 그건 거짓말이다.
 */

/** 지금 정해진 금액. v2.0 I장 — "현재 우선안"이라고 적혀 있어 바뀔 수 있다. */
export const REWARDS = {
  /** 친구초대. **가입만으로는 주지 않는다** — 첫 유효 결제인증이 조건이다(I-1). */
  referral: { amountKrw: 3_000, campaignLimit: 100 },
  /** 홍보인증. 공개 게시물 URL 자동검증이 기본(I-2). */
  promotion: { amountKrw: 2_000, perPerson: 1 },
} as const;

export type RewardKind = keyof typeof REWARDS;

/** 목록으로도 쓴다. 스키마가 열거하려면 배열이 필요하다. */
export const REWARD_KINDS = ['referral', 'promotion'] as const satisfies readonly RewardKind[];

export const REWARD_LABEL: Record<RewardKind, string> = {
  referral: '친구초대',
  promotion: '홍보인증',
};

/**
 * 친구초대 보상 조건. I-1 · K-7.
 *
 * 폐기된 것: `친구 가입+온보딩만으로 보상`
 * 새 규칙: **추천받은 사람의 첫 유효 결제인증**이 조건이다.
 *
 * 가입만으로 돈을 주면 가입만 하는 계정이 모이고, 그 계정들이 만드는 것은
 * 데이터가 아니라 비용이다.
 */
export function canPayReferral(input: {
  invitedUserSignedUp: boolean;
  invitedUserHasUsablePaymentProof: boolean;
}): boolean {
  return input.invitedUserSignedUp && input.invitedUserHasUsablePaymentProof;
}

/**
 * 보상은 신뢰도에 더하지 않는다. C-10.
 *
 * > NPay 등 보상 수령 여부는 결제 데이터의 신뢰점수에 가산하지 않는다.
 *
 * 돈을 받고 낸 자료가 더 믿을 만할 이유가 없고, 그렇게 두면 보상을 노린 자료가
 * 통계를 밀어 올린다. **검증과 보상은 다른 시스템이다.**
 */
export const REWARD_DOES_NOT_AFFECT_TRUST = true;

/**
 * 앱스토어 리뷰와 보상을 **절대 연결하지 않는다.**
 *
 * v2.0이 금지사항으로 못박았고, 애플·구글 정책 위반이기도 하다. 리뷰를 써주면
 * 돈을 주는 구조는 앱이 내려갈 수 있는 사유다.
 *
 * 상수로 두는 이유는 이 규칙이 코드로 표현될 자리가 없어서다 — 만들지 않는 것이
 * 곧 구현이라, 대신 여기 적어 두고 테스트가 이 파일을 읽게 한다.
 */
export const APP_STORE_REVIEW_REWARD_FORBIDDEN = true;

/**
 * 자동지급 흐름. I-3.
 *
 * `조건확인 → 어뷰징검사 → 지급판정 → 한도확인 → 자동지급 → 실패 재시도 → 기록`
 *
 * **설정 한도 안의 정상 지급은 사람이 승인하지 않는다.** 비정상 패턴·예산 초과·
 * 한도 초과만 막거나 위로 올린다.
 */
export const REWARD_STEPS = [
  'check_condition',
  'check_abuse',
  'decide',
  'check_budget',
  'pay',
  'retry',
  'record',
] as const;

export type RewardStep = (typeof REWARD_STEPS)[number];

/** 사람에게 올려야 하는 때. 그 밖에는 자동으로 끝난다. */
export function needsHumanApproval(input: {
  suspectedAbuse: boolean;
  overCampaignLimit: boolean;
  overBudget: boolean;
}): boolean {
  return input.suspectedAbuse || input.overCampaignLimit || input.overBudget;
}

/**
 * 보상 상태.
 *
 * `earned`와 `paid`가 갈려 있는 것이 요점이다. 조건이 찬 것과 돈이 간 것은
 * 다른 일이고, 화면은 각각 다른 말을 해야 한다.
 */
export const REWARD_STATUSES = ['earned', 'held', 'paid', 'blocked'] as const;

export type RewardStatus = (typeof REWARD_STATUSES)[number];

export const REWARD_STATUS_LABEL: Record<RewardStatus, string> = {
  earned: '지급 대기',
  held: '확인 중',
  paid: '지급 완료',
  blocked: '지급하지 않음',
};

/**
 * 받는 사람에게 보이는 상태 설명.
 *
 * **언제 준다고 적지 않는다.** 지킬 수 있는 날짜가 정해져 있지 않고, 지키지 못할
 * 약속은 안 하느니만 못하다.
 */
export const REWARD_STATUS_NOTE: Record<RewardStatus, string> = {
  earned: '조건을 채우셨어요. 지급되면 알림으로 알려드려요',
  held: '한 번 더 확인하고 있어요. 확인이 끝나면 알림으로 알려드려요',
  paid: '보내드렸어요',
  blocked: '이번에는 지급하지 않기로 했어요. 사유를 함께 보내드렸어요',
};

/** 초대 코드. 여섯 자리 대문자·숫자. 헷갈리는 글자는 빼고 만든다. */
export const REFERRAL_CODE_LENGTH = 6;

/**
 * 코드에 쓰는 글자.
 *
 * `0`과 `O`, `1`과 `I`를 빼둔다 — 코드는 눈으로 보고 손으로 옮겨 적는 것이라,
 * 닮은 글자를 남겨두면 "안 되는데요"가 우리 쪽 잘못이 된다.
 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function isReferralCode(value: string): boolean {
  const code = value.trim().toUpperCase();

  return (
    code.length === REFERRAL_CODE_LENGTH &&
    [...code].every((letter) => REFERRAL_CODE_ALPHABET.includes(letter))
  );
}

/**
 * 코드를 넣을 수 있는가. I-1 · I-3의 어뷰징검사 중 규칙이 볼 수 있는 것.
 *
 * 이 셋은 규칙이 확실히 안다. **모르는 것까지 규칙으로 막지 않는다** — 같은
 * 사람이 계정을 여러 개 만든 것인지는 여기서 알 수 없고, 그건 한도와 사람이
 * 본다.
 */
export type RedeemCheck = { ok: true } | { ok: false; message: string };

export function checkRedeem(input: {
  code: string;
  isOwnCode: boolean;
  alreadyInvited: boolean;
}): RedeemCheck {
  if (!isReferralCode(input.code)) {
    return { ok: false, message: '초대 코드를 다시 확인해주세요' };
  }

  if (input.isOwnCode) {
    // 자기 코드를 자기가 넣는 것. 표도 막지만 여기서 걸러야 읽을 수 있는 말을 받는다.
    return { ok: false, message: '내 코드는 넣을 수 없어요' };
  }

  if (input.alreadyInvited) {
    return { ok: false, message: '이미 초대 코드를 넣으셨어요' };
  }

  return { ok: true };
}

/**
 * 홍보 글 주소를 받아도 되는가. I-2.
 *
 * **그 글을 열어보지 않는다.** 남의 사이트를 긁지 않기로 했고, 열어봐도 그 글이
 * 이 사람 것인지는 알 수 없다. 규칙이 보는 것은 주소의 꼴까지이고, 글이 실제로
 * 올라가 있는지는 사람이 확인한다.
 */
export function checkPromotionUrl(url: string): RedeemCheck {
  const trimmed = url.trim();

  if (!trimmed.startsWith('https://')) {
    return { ok: false, message: '글 주소를 https로 시작하는 주소로 넣어주세요' };
  }

  // `https://` 뒤에 점이 있는 이름이 와야 한다. `https://abc`는 주소가 아니다.
  const host = trimmed.slice('https://'.length).split(/[/?#]/)[0] ?? '';

  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
    return { ok: false, message: '글 주소를 다시 확인해주세요' };
  }

  return { ok: true };
}

/**
 * 지급 판정. I-3의 `지급판정 → 한도확인`.
 *
 * **자동으로 끝나는 것과 사람에게 올리는 것을 여기서 가른다.** 설정 한도 안의
 * 정상 지급은 사람이 승인하지 않는다 — 승인 줄을 세워두면 그 줄이 곧 병목이 되고,
 * A-2가 만들지 말라고 한 구조가 된다.
 */
export function decideGrant(input: {
  kind: RewardKind;
  paidCountSoFar: number;
  suspectedAbuse: boolean;
}): { status: Extract<RewardStatus, 'earned' | 'held'>; reasonCode: string } {
  if (input.suspectedAbuse) return { status: 'held', reasonCode: 'suspected_abuse' };

  const limit = input.kind === 'referral' ? REWARDS.referral.campaignLimit : null;

  if (limit !== null && input.paidCountSoFar >= limit) {
    return { status: 'held', reasonCode: 'over_campaign_limit' };
  }

  return { status: 'earned', reasonCode: 'condition_met' };
}

/** 안내 문구. 조건을 먼저 말한다 — 금액부터 말하면 조건이 안 읽힌다. */
export const REFERRAL_NOTICE =
  '초대한 분이 Pick 인증을 처음 마치시면 지급 대상이 돼요. 가입만으로는 지급되지 않아요';

export const PROMOTION_NOTICE =
  '공개된 글의 주소를 넣어주세요. 담당자가 글을 확인한 뒤에 지급 대상이 돼요';

/** 지급 시점을 약속하지 않는다. 지킬 수 있는 날짜가 정해져 있지 않다. */
export const REWARD_PAYOUT_NOTICE = '지급되면 알림으로 알려드려요';
