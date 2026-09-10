import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

/**
 * 관리자 비밀번호 대조.
 *
 * **원문은 어디에도 두지 않는다.** 서버가 아는 것은 `ADMIN_PASSWORD_HASH` 하나이고,
 * 그 값은 소금과 해시만 담는다. 저장소·로그·커밋에 원문이 남을 자리가 없다.
 *
 * 꼴은 `scrypt$<소금 base64>$<해시 base64>`다. 알고리즘 이름을 앞에 적어 두면
 * 나중에 바꿀 때 옛 해시를 그대로 두고 새 꼴을 더할 수 있다 — 이름이 없으면
 * 전부 다시 만들어야 한다.
 *
 * **비교는 `timingSafeEqual`로 한다.** `===`는 다른 첫 글자에서 바로 끝나서, 응답
 * 시간을 재면 앞에서부터 한 글자씩 맞춰볼 수 있다.
 */
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);

  /* 만드는 쪽은 동기로 충분하다 — 도구가 한 번 부르고 끝난다. */
  const derived = scryptSync(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/**
 * 맞는가.
 *
 * 꼴이 아니거나 해시가 없으면 `false`다 — 설정이 빠진 것을 「통과」로 읽지 않는다.
 */
export async function verifyAdminPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;

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

/**
 * 아이디 대조도 시간을 흘리지 않는다.
 *
 * 아이디가 틀렸을 때만 즉시 돌아오면, 응답 시간만으로 「이 아이디는 있다」를 알 수
 * 있다. 길이가 다르면 어차피 다르므로 그때만 빠르게 끝낸다.
 */
export function sameId(given: string, expected: string | undefined): boolean {
  if (!expected) return false;

  const a = Buffer.from(given);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
