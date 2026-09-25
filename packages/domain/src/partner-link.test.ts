import {
  INVITE_TTL_HOURS,
  inviteCodeFromLink,
  inviteShareUrl,
  isInviteCode,
  normalizeInviteCode,
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

describe('초대 링크', () => {
  it('링크에서 코드를 꺼낸다', () => {
    expect(inviteCodeFromLink('weddingpick://join?code=ABCD-1234')).toBe('ABCD-1234');
  });

  it('공유 주소에는 초대 코드가 없다 — 안내 주소 하나뿐이다(2026-09-25 대표 지시)', () => {
    const url = inviteShareUrl('https://example.test/');

    expect(url).toBe('https://example.test/invite');
    expect(url).not.toMatch(/\d{6}/);
    expect(url).not.toContain('code');
  });

  it('우리 스킴이 아니면 받지 않는다', () => {
    expect(inviteCodeFromLink('https://example.com/join?code=ABCD-1234')).toBeNull();
    expect(inviteCodeFromLink('weddingpick://settings?code=ABCD-1234')).toBeNull();
  });

  it('코드가 없으면 받지 않는다', () => {
    expect(inviteCodeFromLink('weddingpick://join')).toBeNull();
    expect(inviteCodeFromLink('weddingpick://join?code=')).toBeNull();
  });

  it('링크가 아니어도 터지지 않는다', () => {
    expect(inviteCodeFromLink('그냥 문자열')).toBeNull();
  });
});

describe('초대 코드 형식', () => {
  it('6자리 숫자만 코드다', () => {
    expect(isInviteCode('012345')).toBe(true);
    expect(isInviteCode('12345')).toBe(false);
    expect(isInviteCode('1234567')).toBe(false);
    expect(isInviteCode('12a456')).toBe(false);
  });

  it('붙여 넣은 글에서 숫자 6자리만 남긴다', () => {
    expect(normalizeInviteCode('123 456')).toBe('123456');
    expect(normalizeInviteCode('123-4567')).toBe('123456');
  });
});
