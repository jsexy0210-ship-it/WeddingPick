import { hashAdminPassword, sameId, verifyAdminPassword } from './admin-password';

describe('관리자 비밀번호', () => {
  it('해시는 원문을 담지 않고 올바른 비밀번호만 허용한다', async () => {
    const password = 'test-password-not-a-real-secret';
    const stored = hashAdminPassword(password);
    expect(stored).not.toContain(password);
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verifyAdminPassword(password, stored)).resolves.toBe(true);
    await expect(verifyAdminPassword('wrong', stored)).resolves.toBe(false);
    await expect(verifyAdminPassword('', stored)).resolves.toBe(false);
  });
  it('같은 비밀번호도 무작위 소금으로 다르게 저장한다', () => {
    expect(hashAdminPassword('test-password')).not.toBe(hashAdminPassword('test-password'));
  });
  it.each([undefined, '', 'not-a-hash', 'scrypt$only-two', 'bcrypt$c2FsdA==$aGFzaA=='])(
    '설정 %p를 유효한 비밀번호로 취급하지 않는다', async (stored) => {
      await expect(verifyAdminPassword('test-password', stored)).resolves.toBe(false);
      await expect(verifyAdminPassword('', stored)).resolves.toBe(false);
    }
  );
  it('명시한 부트스트랩 원문만 허용하며 옛 해시로 우회할 수 없다', async () => {
    const stored = hashAdminPassword('old-test-password');
    await expect(verifyAdminPassword('new-test-password', stored, 'new-test-password')).resolves.toBe(true);
    await expect(verifyAdminPassword('old-test-password', stored, 'new-test-password')).resolves.toBe(false);
    await expect(verifyAdminPassword('wrong', stored, 'new-test-password')).resolves.toBe(false);
  });
  it('원문만 설정한 기존 부트스트랩과 해시 전용 전환을 지원한다', async () => {
    await expect(verifyAdminPassword('test-password', undefined, 'test-password')).resolves.toBe(true);
    await expect(verifyAdminPassword('wrong', undefined, 'test-password')).resolves.toBe(false);
    const stored = hashAdminPassword('test-password');
    await expect(verifyAdminPassword('test-password', stored, '   ')).resolves.toBe(true);
    await expect(verifyAdminPassword('', undefined, '   ')).resolves.toBe(false);
  });
  it('내용이 변조된 해시는 차단한다', async () => {
    const [prefix, salt, hash] = hashAdminPassword('test-password').split('$');
    const flipped = Buffer.from(hash!, 'base64');
    flipped[0] = flipped[0]! ^ 0xff;
    await expect(verifyAdminPassword('test-password', `${prefix}$${salt}$${flipped.toString('base64')}`)).resolves.toBe(false);
  });
});

describe('관리자 아이디', () => {
  it('대소문자를 포함해 일치해야 한다', () => {
    expect(sameId('test-admin', 'test-admin')).toBe(true);
    expect(sameId('Test-admin', 'test-admin')).toBe(false);
    expect(sameId('test', 'test-admin')).toBe(false);
  });
  it.each([undefined, ''])('설정 %p는 차단한다', (expected) => {
    expect(sameId('test-admin', expected)).toBe(false);
    expect(sameId('', expected)).toBe(false);
  });
});
