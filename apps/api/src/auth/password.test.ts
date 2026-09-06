import { hashPassword, verifyPassword } from './password';

test('맞는 비밀번호는 통과하고 틀린 비밀번호는 막는다', async () => {
  const hash = await hashPassword('correct-horse-battery-staple');

  await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
  await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
});

test('원문을 저장하지 않는다', async () => {
  const hash = await hashPassword('my-secret-password');

  expect(hash).not.toContain('my-secret-password');
  expect(hash.startsWith('scrypt$')).toBe(true);
});

test('형식이 아닌 값은 안전하게 실패한다', async () => {
  await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  await expect(verifyPassword('anything', '')).resolves.toBe(false);
});
