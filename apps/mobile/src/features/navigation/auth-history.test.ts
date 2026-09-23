/** Auth 완료 뒤 /login·/setup이 Android Back history로 다시 노출되지 않는 계약. */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const finishSignIn = readFileSync(join(__dirname, '..', 'auth', 'finish-sign-in.ts'), 'utf8');
const setup = readFileSync(join(__dirname, '..', '..', 'app', 'setup.tsx'), 'utf8');
const rootLayout = readFileSync(join(__dirname, '..', '..', 'app', '_layout.tsx'), 'utf8');

describe('auth history isolation', () => {
  it('로그인 성공은 replace 단독 대신 dismissTo fallback 경로로 제품 화면에 진입한다', () => {
    expect(finishSignIn).toContain('dismissToOrReplace(next);');
    /*
     * v3.29 — 가입이 안 끝난 계정은 온보딩(`/setup`)이 아니라 약관 동의 · 권한 안내
     * (WP-AUTH-010, `/login/consent`)로 먼저 간다(CHANGELOG v3.29). 그 화면이 동의를
     * 받은 뒤 `/setup`으로 넘긴다 — auth history를 접는 방식(`dismissToOrReplace`)은
     * 그대로다.
     */
    expect(finishSignIn).toContain("dismissToOrReplace('/login/consent');");
    expect(finishSignIn).not.toContain('router.replace(next);');
  });

  it('온보딩 완료는 auth stack을 접고 홈으로 끝낸다', () => {
    expect(setup).toContain("dismissToOrReplace('/');");
    // 세션 만료/첫 단계 이전은 명시적으로 로그인으로 돌아갈 수 있어야 한다.
    expect(setup).toContain("router.replace('/login');");
  });

  it('웹 OAuth 복귀도 pending 제품 화면과 홈 진입에서 auth history를 접는다', () => {
    expect(rootLayout).toContain('dismissToOrReplace(pendingRoute);');
    expect(rootLayout).toContain("dismissToOrReplace('/');");
    // 비로그인/가입 미완료 진입 자체는 기존 replace 정책을 유지한다.
    expect(rootLayout).toContain('router.replace(ENTRY_ROUTE[entry]);');
  });
});
