import { hashAdminPassword, sameId, verifyAdminPassword } from './admin-password';

describe('관리자 비밀번호', () => {
  it('만든 해시로 원문을 되찾을 수 없고, 같은 원문은 통과한다', async () => {
    const stored = hashAdminPassword('열글자넘는비밀번호');

    expect(stored).not.toContain('열글자넘는비밀번호');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verifyAdminPassword('열글자넘는비밀번호', stored)).resolves.toBe(true);
  });

  it('한 글자만 달라도 막는다', async () => {
    const stored = hashAdminPassword('열글자넘는비밀번호');

    await expect(verifyAdminPassword('열글자넘는비밀번혼', stored)).resolves.toBe(false);
    await expect(verifyAdminPassword('', stored)).resolves.toBe(false);
  });

  it('같은 원문이라도 소금이 달라 해시가 매번 다르다', () => {
    expect(hashAdminPassword('열글자넘는비밀번호')).not.toBe(hashAdminPassword('열글자넘는비밀번호'));
  });

  /*
   * 설정이 빠진 것을 「통과」로 읽으면 안 된다. 환경변수를 넣지 않은 서버가 아무
   * 비밀번호나 받아들이는 것이 가장 나쁜 실패다.
   */
  it.each([undefined, '', 'not-a-hash', 'scrypt$only-two', 'bcrypt$c2FsdA==$aGFzaA=='])(
    '해시가 %p면 무엇을 넣어도 막는다',
    async (stored) => {
      await expect(verifyAdminPassword('아무거나', stored)).resolves.toBe(false);
      await expect(verifyAdminPassword('', stored)).resolves.toBe(false);
    }
  );

  /**
   * 원문 비밀번호(2026-09-10 대표 지시).
   *
   * 해시를 만들어 옮기는 두 단계 없이 `ADMIN_PASSWORD`에 원문을 넣으면 통과한다.
   * 열어 준 만큼 **열리지 말아야 할 자리**를 같이 못박는다 — 둘 다 비어 있는 서버가
   * 아무 비밀번호나 받아들이는 것이 여전히 가장 나쁜 실패다.
   */
  describe('원문 비밀번호', () => {
    it('해시가 없으면 원문으로 대조한다', async () => {
      await expect(verifyAdminPassword('열글자넘는비밀번호', undefined, '열글자넘는비밀번호')).resolves.toBe(true);
      await expect(verifyAdminPassword('열글자넘는비밀번혼', undefined, '열글자넘는비밀번호')).resolves.toBe(false);
      await expect(verifyAdminPassword('', undefined, '열글자넘는비밀번호')).resolves.toBe(false);
    });

    it('둘 다 비어 있으면 무엇을 넣어도 막는다', async () => {
      await expect(verifyAdminPassword('아무거나', undefined, undefined)).resolves.toBe(false);
      await expect(verifyAdminPassword('아무거나', undefined, '')).resolves.toBe(false);
      await expect(verifyAdminPassword('', undefined, '   ')).resolves.toBe(false);
    });

    it('둘 다 있으면 하나만 맞아도 통과한다', async () => {
      const stored = hashAdminPassword('해시쪽비밀번호입니다');

      await expect(verifyAdminPassword('해시쪽비밀번호입니다', stored, '원문쪽비밀번호입니다')).resolves.toBe(true);
      await expect(verifyAdminPassword('원문쪽비밀번호입니다', stored, '원문쪽비밀번호입니다')).resolves.toBe(true);
      await expect(verifyAdminPassword('어느쪽도아닌비밀번호', stored, '원문쪽비밀번호입니다')).resolves.toBe(false);
    });
  });

  it('길이가 맞아도 내용이 다른 해시는 막는다', async () => {
    const stored = hashAdminPassword('열글자넘는비밀번호');
    const [prefix, salt, hash] = stored.split('$');
    const flipped = Buffer.from(hash!, 'base64');

    flipped[0] = flipped[0]! ^ 0xff;

    await expect(
      verifyAdminPassword('열글자넘는비밀번호', `${prefix}$${salt}$${flipped.toString('base64')}`)
    ).resolves.toBe(false);
  });
});

describe('관리자 아이디', () => {
  it('정확히 같을 때만 통과한다', () => {
    expect(sameId('jsexy0210', 'jsexy0210')).toBe(true);
    expect(sameId('jsexy0211', 'jsexy0210')).toBe(false);
    expect(sameId('jsexy021', 'jsexy0210')).toBe(false);
    expect(sameId('JSEXY0210', 'jsexy0210')).toBe(false);
  });

  /** 설정이 없으면 아무 아이디도 통과하지 않는다. */
  it.each([undefined, ''])('기대값이 %p면 막는다', (expected) => {
    expect(sameId('jsexy0210', expected)).toBe(false);
    expect(sameId('', expected)).toBe(false);
  });
});
