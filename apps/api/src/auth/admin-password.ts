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
 *
 * **원문 비밀번호도 받는다**(2026-09-10 대표 지시). `ADMIN_PASSWORD`에 원문을 넣어
 * 두면 그것으로 대조한다. 해시를 만들어 환경변수에 옮기는 두 단계가 없어져서
 * 「비밀번호를 바꾸고 바로 들어간다」가 한 번에 끝난다.
 *
 * **대신 원문이 Render 환경변수에 남는다.** 대시보드를 볼 수 있는 사람은 그대로
 * 읽는다. 해시는 읽어도 원문을 되돌릴 수 없으니 그만큼 약해진다. 해시 쪽을 없애지는
 * 않았으므로 `ADMIN_PASSWORD`를 지우면 곧바로 예전 방식으로 돌아간다.
 *
 * 둘 다 있으면 **하나만 맞아도 통과한다.** 해시를 이기게 두면 원문을 넣어도
 * 아무 일이 일어나지 않고, 들어가려면 해시를 먼저 지워야 한다 — 없애려던 단계가
 * 그대로 남는다. 대신 **잊고 둔 옛 원문이 계속 통한다**는 것이 이 선택의 값이다.
 * 비밀번호를 바꿀 때는 두 환경변수를 함께 손봐야 한다.
 *
 * 맞는 쪽을 찾아도 나머지를 건너뛰지 않는다. 먼저 맞았을 때만 빨리 돌아오면 응답
 * 시간으로 「어느 쪽이 설정돼 있는가」를 알 수 있다.
 *
 * 비교는 여기서도 `timingSafeEqual`이다. 원문이라고 `===`로 두면 응답 시간으로
 * 한 글자씩 맞춰볼 수 있다.
 */
export async function verifyAdminPassword(
  password: string,
  stored: string | undefined,
  plain?: string | undefined
): Promise<boolean> {
  const expectedPlain = plain?.trim();
  const plainOk = expectedPlain ? sameSecret(password, expectedPlain) : false;

  if (!stored) return plainOk;

  return (await verifyHashedPassword(password, stored)) || plainOk;
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

/**
 * 원문끼리 대조. 길이가 다르면 어차피 다르므로 그때만 빠르게 끝낸다.
 *
 * 길이가 새는 것은 감수한다 — `timingSafeEqual`이 같은 길이를 요구하고, 비밀번호
 * 길이 하나로 좁혀지는 폭은 글자를 한 자씩 맞추는 것에 비하면 없는 것과 같다.
 */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
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
