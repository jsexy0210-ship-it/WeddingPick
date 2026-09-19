/** RootLayout의 진입 분기를 실행한다. React/Expo/브리지 대역 검사이며 hydration E2E가 아니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const target = process.argv[2] || path.resolve(__dirname, '../apps/mobile/src/app/_layout.tsx');
const source = fs.readFileSync(target, 'utf8');
const built = ts.transpileModule(source, {
  fileName: '_layout.tsx', reportDiagnostics: true,
  compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  },
});
const errors = (built.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));

function render(route, {
  browser = false,
  os = 'web',
  browserRoute = route,
  forbidLocation = false,
  kakaoReturn = false,
  authPopup = false,
} = {}) {
  const effects = [];
  const counters = {
    bridge: 0, member: 0, redirects: 0, popup: 0,
    popupChecks: 0, kakaoChecks: 0, escapeChecks: 0,
  };
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useState: value => [typeof value === 'function' ? value() : value, () => {}],
      useRef: current => ({ current }), useMemo: fn => fn(),
      useEffect: effect => { effects.push(effect); },
    },
    'react-native': { Platform: { OS: os } },
    'expo-router': {
      usePathname: () => route, DefaultTheme: { colors: {} }, ThemeProvider: 'ThemeProvider',
      Stack: Object.assign(() => null, { Screen: 'Screen' }),
      router: { replace: () => { counters.redirects++; } },
    },
    'expo-splash-screen': { preventAutoHideAsync: () => {}, hideAsync: () => {} },
    '@weddingpick/ui': { useTheme: () => ({}) },
    '@/features/navigation/screen-options': { useStackScreenOptions: () => ({}) },
    '@/components/confirmation-dialog-host': { ConfirmationDialogHost: 'ConfirmationDialogHost' },
    '@/features/navigation/depth-back': { dismissToOrReplace: () => { counters.redirects++; } },
    '@/features/auth/finish-sign-in': { entryAfterSignIn: async () => '/', rememberSignedIn: () => {} },
    '@/features/auth/is-auth-popup': {
      isAuthPopup: () => { counters.popupChecks++; return authPopup; },
      completeAuthPopup: () => { counters.popup++; },
    },
    '@/features/auth/providers': {
      hasKakaoReturn: () => { counters.kakaoChecks++; return kakaoReturn; },
      completeKakaoRedirect: async () => null,
    },
    '@/features/auth/sign-in-handoff': { claimSigningInMessageForBoot: () => {}, setPendingSignInError: () => {} },
    '@/features/auth/signing-in-view': { SigningInView: 'SigningInView' },
    '@/features/capture/capture-draft': { CaptureDraftProvider: 'CaptureDraftProvider' },
    '@/features/documents/document-store': { DocumentStoreProvider: 'DocumentStoreProvider' },
    '@/features/errors/full-screen-error': { FullScreenError: 'FullScreenError' },
    '@/features/inapp-browser/escape': {
      escapeInAppBrowser: () => { counters.escapeChecks++; return { kind: 'none' }; },
    },
    '@/features/in-app-web/in-app-web-shell': { InAppWebShell: 'InAppWebShell' },
    '@/features/inapp-browser/in-app-browser-notice': { InAppBrowserNotice: 'InAppBrowserNotice' },
    '@/features/auth/session-recovery': {
      resolveSessionEntry: async () => { counters.member++; return 'login'; },
      sessionErrorKind: () => 'general',
    },
    '@/api/web-shell-session': {
      initializeWebShellSession: async () => { counters.bridge++; },
      stripLegacyWebShellToken: () => {},
    },
    '@/features/splash/splash-view': { SPLASH_MINIMUM_MS: 0, SplashView: 'SplashView' },
    '@weddingpick/ui/tokens.css': {}, '@/global.css': {},
  };
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, console, setTimeout: () => 1, clearTimeout: () => {},
    require(name) {
      if (!Object.hasOwn(mocks, name)) throw new Error(`검사 대역이 없는 의존성: ${name}`);
      return mocks[name];
    },
  };
  if (browser) {
    context.window = {};
    Object.defineProperty(context.window, 'location', { get() {
      if (forbidLocation) throw new Error('초기 진입 분기가 window.location을 읽었습니다.');
      return { pathname: browserRoute };
    } });
    context.document = { activeElement: null, body: {} };
    context.HTMLElement = class {};
  }
  vm.runInNewContext(built.outputText, context, { filename: '_layout.tsx' });
  const root = module.exports.default();
  assert.equal(typeof root.type, 'function');
  const view = root.type(root.props);
  return { view, counters, async runEffects() {
    const firstEffects = effects.slice();
    const cleanups = firstEffects.map(effect => effect());
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    /*
     * 브라우저 정상 창은 RootLayout effect 뒤 browserReady=true로 한 번 더 렌더된다.
     * 이 대역은 React state를 구현하지 않으므로 그 두 번째 child render만 명시적으로
     * 재현한다. auth popup은 부모가 null로 전환되므로 소비자 child를 다시 돌리지 않는다.
     */
    if (browser && os === 'web' && !authPopup) {
      const before = effects.length;
      root.type({ ...root.props, browserReady: true });
      const readyEffects = effects.slice(before);
      cleanups.push(...readyEffects.map(effect => effect()));
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    }

    for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup();
  } };
}

(async () => {
  const results = [];
  async function check(name, fn) {
    try { await fn(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.message }); }
  }
  for (const [route, expected] of [
    ['/admin', 'ThemeProvider'], ['/admin/login', 'ThemeProvider'], ['/admin/home', 'ThemeProvider'],
    ['/', 'SplashView'], ['/login', 'SplashView'], ['/administrator', 'SplashView'], ['/my/admin', 'SplashView'],
  ]) {
    await check(`서버·브라우저의 최초 진입 분기 일치: ${route}`, () => {
      assert.equal(render(route).view.type, expected);
      assert.equal(render(route, { browser: true }).view.type, expected);
    });
  }
  for (const os of ['ios', 'android']) {
    await check(`네이티브 ${os}는 웹 관리자 예외를 적용하지 않음`, () => {
      assert.equal(render('/admin/home', { os }).view.type, 'SplashView');
    });
  }
  await check('관리자 판정은 라우터 경로를 사용함', () => {
    assert.equal(render('/admin/home', { browser: true, browserRoute: '/' }).view.type, 'ThemeProvider');
  });
  await check('브라우저의 오래된 관리자 주소로 사용자 경로를 우회하지 않음', () => {
    assert.equal(render('/my', { browser: true, browserRoute: '/admin/home' }).view.type, 'SplashView');
  });
  await check('최초 진입 판정은 window.location을 읽지 않음', () => {
    assert.equal(render('/admin/home', { browser: true, forbidLocation: true }).view.type, 'ThemeProvider');
  });
  await check('카카오 callback도 최초 hydration에서는 서버와 같은 스플래시를 그림', () => {
    const app = render('/login', { browser: true, kakaoReturn: true });
    assert.equal(app.view.type, 'SplashView');
    assert.equal(app.counters.kakaoChecks, 0);
    assert.equal(app.counters.popupChecks, 0);
    assert.equal(app.counters.escapeChecks, 0);
  });
  await check('인증 팝업 판정도 hydration 뒤 effect로 미룸', async () => {
    const app = render('/login', { browser: true, authPopup: true });
    assert.equal(app.view.type, 'SplashView');
    await app.runEffects();
    assert.equal(app.counters.popup, 1);
    assert.equal(app.counters.bridge, 0);
    assert.equal(app.counters.member, 0);
  });
  await check('관리자 부팅은 소비자 세션 조회·웹뷰 초기화를 시작하지 않음', async () => {
    const app = render('/admin/home', { browser: true }); await app.runEffects();
    assert.equal(app.counters.bridge, 0); assert.equal(app.counters.member, 0); assert.equal(app.counters.redirects, 0);
  });
  await check('사용자 부팅은 기존 세션 복구 경로를 유지함', async () => {
    const app = render('/my', { browser: true }); await app.runEffects();
    assert.equal(app.counters.bridge, 1); assert.equal(app.counters.member, 1);
  });
  const report = {
    passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length,
    scope: '실제 RootLayout TSX 진입 분기 실행. React/Expo/브리지 대역, 실제 hydration/빌드/전체 회귀 미검증.',
    results,
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
