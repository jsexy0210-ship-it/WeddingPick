/**
 * 배우자 연결 (A-18).
 *
 * 사업계획서 2번이 꼽은 문제 중 하나가 "부부 공동 의사결정"이다 — 견적·후보·일정·의견이
 * 메신저와 캡처 이미지에 흩어져 함께 결정하기 어렵다.
 *
 * 연결은 양쪽이 각각 동의해야 이뤄진다. 한쪽이 초대하고, 다른 쪽이 **무엇이 공유되는지
 * 보고 나서** 받아들여야 연결된다. 그래서 공유 범위를 여기 적어두고 초대 화면에 그대로
 * 보여준다 — 동의는 무엇에 동의하는지 알 때만 동의다.
 */

/** 초대 링크가 살아 있는 시간. 흘러나온 링크가 영원히 열려 있지 않게 한다. */
export const INVITE_TTL_HOURS = 72;

/** 연결하면 함께 보게 되는 것. */
export const PARTNER_SHARED = [
  '정리된 견적·계약 내용 (업체, 상품, 금액, 계약조건, 추가비용)',
  '실제 계약과의 가격 비교 결과',
  '문서를 올린 날짜와 원본 삭제 예정일',
] as const;

/**
 * 연결해도 공유하지 않는 것.
 *
 * 이용약관 제5조: 원본 계약서와 개인정보는 배우자 연결 시에도 자동 공유하지 않는다.
 */
export const PARTNER_NOT_SHARED = [
  '원본 문서 파일 자체 — 올린 사람만 가집니다',
  '상대방의 계정 정보 (이메일, 로그인 수단)',
  '자료 확인 신청에 낸 증빙 — 낸 사람만 쓸 수 있습니다',
] as const;

/** 연결을 끊으면 어떻게 되는지. 끊기 전에 알려준다. */
export const PARTNER_UNLINK_EFFECTS = [
  '상대방은 이 웨딩의 견적과 비교 결과를 더 볼 수 없습니다.',
  '각자 올린 원본 문서는 올린 사람에게 그대로 남습니다.',
  '이미 확인을 마친 자료는 가격 비교에 그대로 쓰입니다 — 연결과 무관합니다.',
] as const;

export type InviteState = 'usable' | 'expired' | 'revoked' | 'accepted' | 'already_linked';

export const INVITE_STATE_MESSAGE: Record<InviteState, string> = {
  usable: '',
  expired: '초대 기한이 지났습니다. 초대한 분께 다시 보내달라고 해주세요.',
  revoked: '취소된 초대입니다. 초대한 분께 다시 보내달라고 해주세요.',
  accepted: '이미 사용된 초대입니다.',
  already_linked: '이미 배우자가 연결되어 있습니다. 한 웨딩에는 두 사람까지입니다.',
};

/** 이 초대를 지금 쓸 수 있는지. 쓸 수 없으면 왜인지 함께 준다. */
export function inviteState(input: {
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
  partnerAlreadyLinked: boolean;
  now?: Date;
}): InviteState {
  if (input.status === 'revoked') return 'revoked';
  if (input.status === 'accepted') return 'accepted';
  if (input.partnerAlreadyLinked) return 'already_linked';

  const now = input.now ?? new Date();

  return new Date(input.expiresAt) > now ? 'usable' : 'expired';
}
