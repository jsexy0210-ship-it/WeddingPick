import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * 비밀번호 해시. Node 내장 scrypt — 의존성 없이 메모리 비용이 붙는 해시다.
 *
 * 저장 형식 `scrypt$<salt>$<key>`(base64url). 형식에 알고리즘 이름을 남겨두면
 * 나중에 바꿀 때 옛 해시를 구분해 재해시할 수 있다.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltEncoded, keyEncoded] = stored.split('$');

  if (scheme !== 'scrypt' || !saltEncoded || !keyEncoded) return false;

  const expected = Buffer.from(keyEncoded, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltEncoded, 'base64url'), expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
