/**
 * 세션·관리자 로그아웃·부팅 인증 회귀 검사. 실제 TS 모듈을 실행한다.
 * SDK/스토리지/React는 대역이며 실기기 검증은 아니다.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const results = [];
async function check(name, test) {
  try { await test(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
}
function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  assert.equal(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  const context = { module, exports: module.exports, console, URL, URLSearchParams,
    setTimeout, clearTimeout, Event, ...globals,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('node:')) return require(name);
      throw new Error(`Unmocked dependency: ${name}`);
    },
  };
  vm.runInNewContext(compiled.outputText, context, { filename: file });
  return module.exports;
}
const sessionPath = 'apps/mobile/src/api/session.ts';
const origin = 'https://app.example.test';
const token = 'A'.repeat(43), otherToken = 'B'.repeat(43);
function storage() {
  const values = new Map();
  return { values, get length() { return values.size; }, key: n => [...values.keys()][n] ?? null,
    getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k),
    getAllKeys: async () => [...values.keys()] };
}
function secureStorage() {
  const values = new Map();
  return {
    values,
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  };
}
function browser(href = `${origin}/`, bridge = false) {
  const win = { location: new URL(href), localStorage: storage(), sessionStorage: storage(),
    dispatchEvent() {}, history: { replaceState(_a, _b, value) { win.location = new URL(value, origin); } } };
  win.top = win;
  if (bridge) win.ReactNativeWebView = { postMessage() {} };
  return { win, globals: { window: win } };
}
function session(os, c = browser()) {
  const secure = secureStorage();
  const api = load(sessionPath, {
    '@react-native-async-storage/async-storage': c.win.localStorage,
    'expo-secure-store': secure,
    'react-native': { Platform: { OS: os } },
  }, os === 'web' ? c.globals : {});
  return { api, secure, local: c.win.localStorage, win: c.win };
}
(async () => {
  await check('legacy wp_token is removed from the URL and never stored', async () => {
    const c = browser(`${origin}/pick?wp_token=${token}&keep=1#item`);
    const s = session('web', c);
    s.api.stripLegacyUrlToken();
    assert.equal(c.win.location.href, `${origin}/pick?keep=1#item`);
    assert.equal(s.local.getItem('weddingpick.sessionToken.v1'), null);
    assert.equal(await s.api.loadToken(), null);
  });
  await check('URL without legacy token is left untouched', () => {
    const c = browser(`${origin}/pick?keep=1#item`);
    let replaced = 0; c.win.history.replaceState = () => { replaced++; };
    session('web', c).api.stripLegacyUrlToken();
    assert.equal(replaced, 0); assert.equal(c.win.location.href, `${origin}/pick?keep=1#item`);
  });
  await check('web session keeps the AsyncStorage path and never touches SecureStore', async () => {
    const s = session('web');
    await s.api.saveToken(token); assert.equal(await s.api.loadToken(), token);
    assert.equal(s.local.getItem('weddingpick.sessionToken.v1'), token); assert.equal(s.secure.values.size, 0);
    await s.api.clearToken(); assert.equal(await s.api.loadToken(), null);
  });
  await check('web page inside a WebView bridge no longer takes a separate session path', async () => {
    const s = session('web', browser(`${origin}/?wp_shell=1`, true));
    await s.api.saveToken(token); assert.equal(await s.api.loadToken(), token);
    assert.equal(s.local.getItem('weddingpick.sessionToken.v1'), token);
  });
  await check('native storage writes and clears are ordered', async () => {
    const s = session('ios');
    let notifications = 0; const unsubscribe = s.api.subscribeToken(() => notifications++);
    await s.api.saveToken(token); assert.equal(await s.api.loadToken(), token);
    await s.api.saveToken(otherToken); assert.equal(await s.api.loadToken(), otherToken);
    assert.equal(s.secure.values.get('weddingpick.sessionToken.v1'), otherToken);
    assert.equal(s.local.getItem('weddingpick.sessionToken.v1'), null);
    await s.api.clearToken(); assert.equal(await s.api.loadToken(), null);
    assert.equal(notifications, 3); unsubscribe(); await s.api.saveToken(token); assert.equal(notifications, 3);
  });
  await check('withdrawal clears only WeddingPick persistent and tab keys', async () => {
    const c = browser(); const s = session('web', c);
    s.local.setItem('weddingpick.sessionToken.v1', token); s.local.setItem('other', 'keep');
    c.win.sessionStorage.setItem('weddingpick.kakaoAuthRequest.v1', 'pending'); c.win.sessionStorage.setItem('other', 'keep');
    await s.api.wipeDevice(); assert.equal(s.local.getItem('weddingpick.sessionToken.v1'), null); assert.equal(s.local.getItem('other'), 'keep');
    assert.equal(c.win.sessionStorage.getItem('weddingpick.kakaoAuthRequest.v1'), null); assert.equal(c.win.sessionStorage.getItem('other'), 'keep');
  });

  function adminSession({ fails=false, status=204, apiUrl='https://api.example.test/', pending }={}) {
    const local=storage(), calls=[], warnings=[];
    const win={localStorage:local,dispatchEvent(){},addEventListener(){},removeEventListener(){}};
    const api=load('apps/mobile/src/app/admin/_session.ts',{
      '@react-native-async-storage/async-storage':local,'@/api/config':{API_URL:apiUrl},
    },{window:win,AbortSignal,console:{warn:message=>warnings.push(message)},fetch:async(url,options)=>{
      calls.push({url,options});if(fails)throw new Error('failure');if(pending)await pending;
      return{ok:status>=200&&status<300};
    }});
    return{api,local,calls,warnings};
  }
  await check('admin logout revokes captured server session without JSON body',async()=>{
    const c=adminSession();await c.api.saveAdminToken(token);await c.api.clearAdminToken();
    assert.equal(await c.api.loadAdminToken(),null);assert.equal(c.calls.length,1);
    assert.equal(c.calls[0].url,'https://api.example.test/v1/auth/sessions');
    assert.equal(c.calls[0].options.headers.Authorization,`Bearer ${token}`);
    assert.equal(c.calls[0].options.method,'DELETE');assert.equal(c.calls[0].options.body,undefined);
    assert.equal(c.calls[0].options.redirect,'error');assert.equal(c.calls[0].options.keepalive,true);
  });
  await check('failed admin revocation never restores local token or logs secrets',async()=>{
    const c=adminSession({fails:true});await c.api.saveAdminToken(token);await c.api.clearAdminToken();
    assert.equal(await c.api.loadAdminToken(),null);assert.equal(c.warnings.length,1);
    assert.ok(!c.warnings.join().includes(token));
  });
  await check('admin logout never removes ordinary user session',async()=>{
    const c=adminSession();c.local.setItem('weddingpick.sessionToken.v1',otherToken);
    await c.api.saveAdminToken(token);await c.api.clearAdminToken();
    assert.equal(c.local.getItem('weddingpick.sessionToken.v1'),otherToken);
  });
  await check('old admin revocation response cannot erase a new login',async()=>{
    let finish;const pending=new Promise(resolve=>finish=resolve);const c=adminSession({pending});
    await c.api.saveAdminToken(token);const clearing=c.api.clearAdminToken();await Promise.resolve();
    await c.api.saveAdminToken(otherToken);finish();await clearing;
    assert.equal(await c.api.loadAdminToken(),otherToken);assert.equal(c.calls[0].options.headers.Authorization,`Bearer ${token}`);
  });
  await check('empty admin logout does not send request',async()=>{const c=adminSession();await c.api.clearAdminToken();assert.equal(c.calls.length,0);});
  await check('admin HTTP failure is not reported as server revocation success',async()=>{
    const c=adminSession({status:500});await c.api.saveAdminToken(token);await c.api.clearAdminToken();assert.equal(c.warnings.length,1);
  });
  for(const [name,url,bridge] of [['new marker',`${origin}/?wp_shell=1`,false],['bridge after navigation',`${origin}/pick`,true],['old marker',`${origin}/?wp_token=legacy`,false]]){
    await check(`native WebView does not escape: ${name}`,()=>{
      const c=browser(url,bridge);let planned=false;
      const api=load('apps/mobile/src/features/inapp-browser/escape.ts',{
        'react-native':{Platform:{OS:'web'}},'@/features/auth/providers':{hasKakaoReturn:()=>false},
        './detect':{planInAppEscape:()=>{planned=true;return{kind:'stay'};}},
      },{window:c.win});
      assert.equal(api.escapeInAppBrowser().kind,'none');assert.equal(planned,false);
    });
  }
  function rootBoot({admin=false}={}){
    const effects=[],states=[],refs=[];let oauth=0,resolutions=0,finish;
    const wait=new Promise(resolve=>finish=resolve);let hasCode=true;
    const win={location:new URL(`${origin}/${admin?'admin/queue':'setup?code=test'}`)};
    const nothing=()=>{};
    const api=load('apps/mobile/src/app/_layout.tsx',{
      '@weddingpick/ui/tokens.css':{},'@/global.css':{},
      react:{useState(initial){const box={value:typeof initial==='function'?initial():initial};states.push(box);return[box.value,v=>box.value=typeof v==='function'?v(box.value):v];},
        useRef(initial){const box={current:initial};refs.push(box);return box;},useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)},
      'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
      'expo-router':{DefaultTheme:{colors:{}},Stack:'Stack',ThemeProvider:'Theme',router:{replace:nothing},usePathname:()=>win.location.pathname},
      'expo-splash-screen':{preventAutoHideAsync:nothing,hideAsync:nothing},'react-native':{Platform:{OS:'web'}},
      '@weddingpick/ui':{useTheme:()=>({})},'@/features/navigation/screen-options':{useStackScreenOptions:()=>({})},
      '@/components/confirmation-dialog-host': { ConfirmationDialogHost: 'ConfirmationDialogHost' },
      '@/features/navigation/result-toast-host': { ResultToastHost: 'ResultToastHost' },
      '@/features/home/home-handoff': { HomeHandoffHost: 'HomeHandoffHost' },
    '@/features/navigation/depth-back':{dismissToOrReplace:nothing},
      '@/features/auth/finish-sign-in':{entryAfterSignIn:async()=> '/',rememberSignedIn:nothing},
      '@/features/auth/is-auth-popup':{isAuthPopup:()=>false,completeAuthPopup:nothing},
      '@/features/auth/providers':{hasKakaoReturn:()=>hasCode,completeKakaoRedirect:async()=>{oauth++;hasCode=false;await wait;return{activated:true};}},
      '@/features/auth/sign-in-handoff':{claimSigningInMessageForBoot:nothing,setPendingSignInError:nothing},
      '@/features/auth/signing-in-view':{SigningInView:'SigningIn'},
      '@/features/errors/full-screen-error':{FullScreenError:'Error'},'@/features/inapp-browser/escape':{escapeInAppBrowser:()=>({kind:'none'})},
      '@/features/in-app-web/in-app-web-shell':{InAppWebShell:'Shell'},'@/features/inapp-browser/in-app-browser-notice':{InAppBrowserNotice:'Notice'},
      '@/features/auth/session-recovery':{resolveSessionEntry:async()=>{resolutions++;return'app';},sessionErrorKind:()=> 'general'},
      '@/api/session':{stripLegacyUrlToken:nothing},
      '@/features/splash/splash-view':{SPLASH_MINIMUM_MS:1,SplashView:'Splash'},
    },{window:win});
    const root=api.default();
    // hydration gate 자체는 verify-root-entry.cjs가 검증한다. 여기서는 hydration 이후
    // browserReady=true가 된 소비자 부팅의 single-flight 의미만 고정한다.
    root.type({...root.props,browserReady:true});
    const entryState=states[2],errorState=states[3],bootEffect=effects[3];
    return{effects,states,entryState,errorState,bootEffect,finish,get oauth(){return oauth;},get resolutions(){return resolutions;}};
  }
  await check('StrictMode effect replay exchanges OAuth code only once',async()=>{
    const c=rootBoot();const cleanup=c.bootEffect();cleanup();c.bootEffect();
    for(let i=0;i<5;i++)await Promise.resolve();assert.equal(c.oauth,1);c.finish();
    for(let i=0;i<10;i++)await Promise.resolve();assert.equal(c.entryState.value,'app');assert.equal(c.resolutions,0);
  });
  await check('admin entry never starts consumer authentication bootstrap',async()=>{
    const c=rootBoot({admin:true});c.bootEffect();for(let i=0;i<5;i++)await Promise.resolve();
    assert.equal(c.resolutions,0);assert.equal(c.oauth,0);
  });
})().then(()=>{
  console.log(JSON.stringify({passed:results.length,failed:0,tests:results},null,2));
}).catch(error=>{console.error(error);console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:1,tests:results},null,2));process.exitCode=1;});
