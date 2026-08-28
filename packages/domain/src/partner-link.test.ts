import {
  INVITE_TTL_HOURS,
  PARTNER_NOT_SHARED,
  PARTNER_SHARED,
  inviteState,
} from './partner-link';

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const base = { status: 'pending' as const, expiresAt: future, partnerAlreadyLinked: false };

describe('배우자 초대', () => {
  it('살아 있는 초대만 쓸 수 있다', () => {
    expect(inviteState(base)).toBe('usable');
  });

  it('기한이 지나면 쓸 수 없다', () => {
    // 흘러나온 링크가 영원히 열려 있으면 언젠가 낯선 사람이 들어온다.
    expect(inviteState({ ...base, expiresAt: past })).toBe('expired');
  });

  it('취소하거나 이미 쓴 초대는 다시 쓸 수 없다', () => {
    expect(inviteState({ ...base, status: 'revoked' })).toBe('revoked');
    expect(inviteState({ ...base, status: 'accepted' })).toBe('accepted');
  });

  it('이미 배우자가 있으면 받아들일 수 없다', () => {
    // 한 웨딩에 세 사람이 되는 길을 막는다.
    expect(inviteState({ ...base, partnerAlreadyLinked: true })).toBe('already_linked');
  });

  it('무엇이 공유되고 무엇이 안 되는지 둘 다 적어둔다', () => {
    // 동의는 무엇에 동의하는지 알 때만 동의다.
    expect(PARTNER_SHARED.length).toBeGreaterThan(0);
    expect(PARTNER_NOT_SHARED.length).toBeGreaterThan(0);
  });

  it('원본 파일은 공유하지 않는다고 밝힌다', () => {
    // 이용약관 제5조.
    expect(PARTNER_NOT_SHARED.some((item) => item.includes('원본 문서 파일'))).toBe(true);
  });

  it('초대에 기한이 있다', () => {
    expect(INVITE_TTL_HOURS).toBeGreaterThan(0);
  });
});
