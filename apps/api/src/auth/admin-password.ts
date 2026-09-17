import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** DB 계정은 무작위 소금과 scrypt 해시만 보관한다. 원문 비밀번호를 저장하지 않는다. */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/**
 * DB 계정은 해시로만 대조한다. plain은 환경변수 부트스트랩에만 전달한다.
 *
 * 부트스트랩 원문을 명시했다면 그 값만 유효하다. 원문과 해시 중 하나만 맞으면
 * 통과하던 OR 판정을 제거하여, 원문을 바꾼 뒤 옛 해시의 비밀번호가 계속 통하지
 * 않게 한다. 해시 전용 운영으로 바꿀 때는 ADMIN_PASSWORD를 제거한다.
 * 원문 환경변수 지원은 기존 운영 계정의 호환성을 위해 유지하며 권장 방식은 아니다.
 */
export async function verifyAdminPassword(
  password: string,
  stored: string | undefined,
  plain?: string | undefined
): Promise<boolean> {
  const expectedPlain = plain?.trim();
  if (expectedPlain) return sameSecret(password, expectedPlain);
  if (!stored) return false;
  return verifyHashedPassword(password, stored);
}

async function verifyHashedPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1]!, 'base64');
    expected = Buffer.from(parts[2]!, 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

  const derived = await scrypt(password, salt, KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

/** timingSafeEqual은 같은 길이에만 적용한다. 길이 차이까지 숨기는 구현은 아니다. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sameId(given: string, expected: string | undefined): boolean {
  return expected ? sameSecret(given, expected) : false;
}
