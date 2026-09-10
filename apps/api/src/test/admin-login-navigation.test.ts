import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

const LOGIN = join(ROOT, 'apps/mobile/src/app/admin/login.tsx');
const LAYOUT = join(ROOT, 'apps/mobile/src/app/admin/_layout.tsx');

/**
 * 로그인에 성공하고도 로그인 화면으로 돌아오던 것을 막는다.
 *
 * 2026-09-10 사용자 보고. 아이디·비밀번호도 맞고 운영 권한도 켜져 있는데 들어가지지
 * 않았다. 원인은 서버가 아니라 두 파일 사이의 어긋남이었다.
 *
 *   _layout   토큰을 마운트할 때 한 번만 읽는다(useEffect의 의존성이 비어 있다)
 *   _layout   로그인 화면까지 감싼다 — 로그인하는 시점에 이미 마운트가 끝나 있다
 *   login     router.replace로 옮긴다 — 화면만 갈아끼우고 레이아웃은 그대로 산다
 *
 * 그래서 방금 저장한 토큰을 레이아웃은 모른 채 「토큰 없음」으로 굳어 있고,
 * 곧바로 로그인으로 되돌린다. **로그인할수록 로그인 화면으로 온다.**
 *
 * 고치는 길은 둘이다. 레이아웃이 토큰을 다시 읽게 만들거나, 로그인이 전체
 * 새로고침으로 들어가거나. 뒤를 골랐다 — 로그아웃이 이미 그 길을 쓰고 있고
 * 콘솔은 웹 전용이다.
 *
 * 이 시험은 **둘 중 하나는 반드시 성립한다**를 지킨다. 나중에 레이아웃을 반응형으로
 * 바꾸면 그때는 앞의 조건으로 통과한다. 한쪽만 고치고 다른 쪽을 되돌리는 순간
 * 같은 증상이 돌아오는데, 그 증상은 화면에 오류가 아니라 로그인 화면으로 보여서
 * 「비밀번호가 틀렸나」로 오해하게 된다.
 */
describe('관리자 로그인 — 들어간 뒤 다시 로그인으로 오지 않는다', () => {
  const login = readFileSync(LOGIN, 'utf8');
  const layout = readFileSync(LAYOUT, 'utf8');

  it('레이아웃이 토큰을 한 번만 읽는다면, 로그인은 전체 새로고침으로 들어간다', () => {
    /*
     * 마운트에서 한 번만 읽는 꼴: loadAdminToken을 부르는 useEffect의 의존성이
     * 비어 있다. 그러면 로그인 뒤에 다시 읽을 기회가 없다.
     */
    const readsOnce = /useEffect\(\(\) => \{[\s\S]*?loadAdminToken\(\)[\s\S]*?\}, \[\]\);/.test(layout);

    if (!readsOnce) return;

    expect(login).toContain("window.location.assign('/admin/queue')");
  });

  it('레이아웃이 토큰 없으면 로그인으로 돌려보낸다 — 그래서 이 짝이 중요하다', () => {
    /* 이 전제가 사라지면 위 시험이 지키는 것도 사라진다. 함께 본다. */
    expect(layout).toContain('LOGIN_PATH');
    expect(layout).toMatch(/if \(!token\) return <Redirect/);
  });
});
