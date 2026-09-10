import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const ADMIN_DIR = join(ROOT, 'apps/mobile/src/app/admin');

/**
 * 「조회만」 배지와 화면 안쪽 잠금은 **짝이다.**
 *
 * 사이드바의 `READ_ONLY`(`app/admin/_layout.tsx`)와 화면의 `BACKEND_PENDING`은 같은
 * 사실을 두 자리에서 말한다 — 「이 화면은 지금 조작이 안 된다」. 서버 동작이 붙으면
 * 둘을 함께 지워야 하는데, **2026-09-10에 한쪽만 지워졌다.** 검토 · 데이터 · 운영
 * 계열 세 갈래가 각자 자기 화면의 `BACKEND_PENDING`을 걷어냈고, 사이드바는 아무도
 * 건드리지 않아서 이제는 작동하는 메뉴 여덟 곳에 「조회만」이 그대로 남을 뻔했다.
 *
 * 어긋나도 화면은 멀쩡히 그려진다. 배지가 하나 더 붙어 있을 뿐이라 눈에 띄지 않고,
 * 운영자는 그 메뉴가 안 된다고 믿고 들어가지 않는다 — **되는 것을 못 쓰게 된다.**
 * 그래서 사람 눈이 아니라 시험이 지킨다.
 *
 * 화면 파일을 읽는 시험이라 api 쪽에 둔다. mobile의 tsconfig에는 node 타입이 없어서
 * `node:fs`를 부르지 못한다 — 같은 이유로 로그인 이동 가드도 이 자리에 있다.
 */
function readOnlyKeys(): string[] {
  const source = readFileSync(join(ADMIN_DIR, '_layout.tsx'), 'utf8');
  const block = /const READ_ONLY = new Set\(\[([\s\S]*?)\]\)/.exec(source);

  if (!block) throw new Error('_layout.tsx에서 READ_ONLY를 찾지 못했다.');

  return [...block[1]!.matchAll(/'([^']+)'/g)].map((match) => match[1]!).sort();
}

function pendingScreens(): string[] {
  return readdirSync(ADMIN_DIR)
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
    .filter((file) => readFileSync(join(ADMIN_DIR, file), 'utf8').includes('BACKEND_PENDING'))
    .map((file) => file.replace(/\.tsx$/, ''))
    .sort();
}

describe('「조회만」 배지와 화면 잠금', () => {
  it('사이드바가 적은 것과 화면이 잠근 것이 같다', () => {
    expect(readOnlyKeys()).toEqual(pendingScreens());
  });

  it('둘 다 비어 있지 않다 — 규칙이 사라진 것을 통과로 읽지 않는다', () => {
    /*
     * 서버 동작이 전부 붙어 잠긴 화면이 하나도 없게 되는 날이 오면 이 줄을 지우고
     * 위의 대조만 남긴다. 그때까지는 둘이 함께 비는 것이 **짝이 맞아서**가 아니라
     * **한쪽을 통째로 지워서**일 수 있어서 확인한다.
     */
    expect(pendingScreens().length).toBeGreaterThan(0);
  });
});
