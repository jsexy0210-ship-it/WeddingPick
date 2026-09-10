import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

const LOGIN = join(ROOT, 'apps/mobile/src/app/admin/login.tsx');
const LAYOUT = join(ROOT, 'apps/mobile/src/app/admin/_layout.tsx');
const SESSION = join(ROOT, 'apps/mobile/src/app/admin/_session.ts');

/**
 * 로그인에 성공하고도 로그인 화면으로 돌아오던 것을 막는다.
 *
 * 2026-09-10 사용자 보고. 아이디·비밀번호도 맞고 운영 권한도 켜져 있는데 들어가지지
 * 않았다. 원인은 서버가 아니라 화면 세 자리가 서로 어긋난 것이었다.
 *
 * **1. 레이아웃이 토큰을 마운트에서 한 번만 읽었다.** 이 레이아웃은 로그인 화면까지
 * 감싸고 있어서, 로그인하는 시점에 이미 「토큰 없음」으로 굳어 있다. 방금 저장한
 * 토큰을 모른 채 로그인으로 되돌린다 — **로그인할수록 로그인 화면으로 온다.**
 *
 * **2. `AsyncStorage`의 웹 구현이 실제 쓰기를 미룬다.** `await saveAdminToken()`이
 * 끝난 뒤에 곧바로 읽어도 아직 없다. 그래서 곧바로 쓰기(`writeThrough`)를 함께 한다.
 *
 * **3. 렌더 안에서 `localStorage`를 읽으면 React Compiler가 값을 기억한다.** 순수한
 * 호출로 보기 때문이다. 저장소에는 값이 있는데 읽은 값만 `null`로 얼어붙었다:
 *
 *   layout 렌더 /admin/queue  sync=null  raw=["weddingpick.adminToken.v1"]
 *
 * 그래서 `useSyncExternalStore`로 읽는다 — 그 자리를 위해 있는 것이라 컴파일러가
 * 건너뛰지 않는다.
 *
 * **왜 전체 새로고침을 걷어냈나.** 처음에는 로그인이
 * `window.location.assign('/admin/queue')`로 들어가게 해서 1번을 덮었다. 그것이
 * 느림의 원인이 됐다 — 웹 번들이 한 덩어리로 3.2MB(gzip 0.8MB)라 새로고침이 그것을
 * 다시 파싱한다. 캐시가 있어도 파싱은 다시 하고, 로그인 직후 몇 초가 거기서
 * 나왔다(2026-09-10 대표 「관리자 로딩도 왜 이리 느리냐」). 걷어낸 뒤 실제 브라우저로
 * 재어 209ms다.
 *
 * 이 시험은 **레이아웃이 토큰 변화를 볼 수 있어야 한다**를 지킨다. 볼 수 없게
 * 되돌리면 로그인은 다시 전체 새로고침이어야 하고, 둘 다 아니면 증상이 돌아온다.
 * 그 증상은 화면에 오류가 아니라 로그인 화면으로 보여서 「비밀번호가 틀렸나」로
 * 오해하게 된다 — 실제로 해시를 두 번 새로 만들고 나서야 화면 쪽을 봤다.
 */
describe('관리자 로그인 — 들어간 뒤 다시 로그인으로 오지 않는다', () => {
  const login = readFileSync(LOGIN, 'utf8');
  const layout = readFileSync(LAYOUT, 'utf8');
  const session = readFileSync(SESSION, 'utf8');

  /** 주석은 빼고 본다 — 왜 그렇게 했는지 적은 글에 같은 낱말이 그대로 들어간다. */
  const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  /** 레이아웃이 토큰이 바뀌는 것을 볼 수 있는가. */
  const watchesToken = /useSyncExternalStore\(\s*subscribeAdminToken/.test(code(layout));

  it('레이아웃이 토큰 변화를 보거나, 로그인이 전체 새로고침으로 들어간다', () => {
    const fullReload = code(login).includes("window.location.assign('/admin/queue')");

    expect(watchesToken || fullReload).toBe(true);
  });

  it('토큰 변화를 본다면 새로고침은 걷어낸다 — 그것이 느림의 원인이었다', () => {
    if (!watchesToken) return;

    expect(code(login)).not.toContain('window.location.assign');
    expect(code(login)).toContain("router.replace('/admin/queue'");
  });

  it('저장은 곧바로도 쓴다 — AsyncStorage 웹 구현이 쓰기를 미룬다', () => {
    if (!watchesToken) return;

    /*
     * 이것이 없으면 구독이 있어도 소용없다. 알릴 값 자체가 아직 저장소에 없다.
     * 실제로 그 상태로 한 판을 빌드해서 같은 증상을 다시 봤다.
     *
     * **함수가 있는지가 아니라 불리는지를 본다.** 처음에는 파일 안에
     * `localStorage.setItem`이 있는지만 봤는데, 호출을 주석으로 지워도 함수 본문은
     * 남아 있어서 그대로 통과했다 — 가드가 실제로 잡는지 확인하다가 걸렸다.
     */
    const saves = /export async function saveAdminToken\([\s\S]*?\n\}/.exec(code(session))?.[0] ?? '';
    const clears = /export async function clearAdminToken\([\s\S]*?\n\}/.exec(code(session))?.[0] ?? '';

    expect(saves).toContain('writeThrough(');
    expect(clears).toContain('writeThrough(');

    /* 곧바로 쓰고, 같은 탭에도 알린다 — `storage`는 다른 탭에만 간다. */
    expect(code(session)).toMatch(/localStorage\.setItem/);
    expect(code(session)).toMatch(/dispatchEvent/);
  });

  it('레이아웃이 토큰 없으면 로그인으로 돌려보낸다 — 그래서 이 짝이 중요하다', () => {
    /* 이 전제가 사라지면 위 시험들이 지키는 것도 사라진다. 함께 본다. */
    expect(layout).toContain('LOGIN_PATH');
    expect(layout).toMatch(/if \(!token\) return <Redirect/);
  });
});
