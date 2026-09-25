/** 실제 TS 모듈 실행 검사. SDK/스토리지/React는 대역이며 실기기 검증은 아니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
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
  const context = { module, exports: module.exports, console, URL, URLSearchParams, Uint8Array,
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
const protocolPath = 'apps/mobile/src/features/webshell/session-protocol.ts';
const bridgePath = 'apps/mobile/src/api/web-shell-session.ts';
const sessionPath = 'apps/mobile/src/api/session.ts';
const componentPath = 'apps/mobile/src/features/webshell/WebShellView.tsx';
const protocol = load(protocolPath);
const origin = 'https://app.example.test';
const token = 'A'.repeat(43), otherToken = 'B'.repeat(43), channel = 'a'.repeat(64);
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
function browser(href = `${origin}/?wp_shell=1`, bridge = true) {
  const win = { location: new URL(href), localStorage: storage(), sessionStorage: storage(),
    crypto: webcrypto, dispatchEvent() {}, sent: [],
    history: { replaceState(_a, _b, value) { win.location = new URL(value, origin); } } };
  win.top = win;
  if (bridge) win.ReactNativeWebView = { postMessage: m => win.sent.push(JSON.parse(m)) };
  const timers = new Map(); let next = 0;
  const globals = { window: win, setTimeout: fn => { timers.set(++next, fn); return next; },
    clearTimeout: id => timers.delete(id) };
  const api = load(bridgePath, { '../features/webshell/session-protocol': protocol }, globals);
  return { win, api, globals, timers, receive(value = token, key) {
    win.__weddingpickReceiveSession(key ?? win.sent.at(-1).channel, value);
  } };
}
function component(sequence = [token]) {
  const refs = [], effects = []; let at = 0, listener, cleared, route, external, script;
  const api = load(componentPath, {
    react: { useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref; },
      useMemo: fn => fn(), useEffect: fn => effects.push(fn()), useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router: { replace: value => { route = value; } } },
    '@/features/open-external': { openExternal: async value => { external = value; } },
    'react-native': { StyleSheet: { create: value => value } },
    'react-native-webview': { WebView: 'WebView' },
    '@weddingpick/ui': { Layout: {}, MaxContentWidth: 500, Spacing: {}, ThemedText: 'Text', ThemedView: 'View' },
    '@/features/loading/delayed-loader': { DelayedLoader: 'Loader' },
    '@/api/session': { loadToken: async () => sequence[Math.min(at++, sequence.length - 1)],
      clearTokenIfMatches: async value => { cleared = value; return sequence.at(-1) === value; },
      subscribeToken: fn => { listener = fn; return () => {}; } },
    './config': { WEB_SHELL_URL: origin }, './session-protocol': protocol,
  });
  const node = api.WebShellView({ path: '/pick?keep=1' });
  refs[0].current = { injectJavaScript: value => { script = value; } };
  return { node, refs, listener: () => listener(), get script() { return script; }, get route() { return route; },
    get external() { return external; }, get cleared() { return cleared; }, async message(type, url = origin, key = channel) {
      node.props.onMessage({ nativeEvent: { data: JSON.stringify({ type, channel: key }), url } });
      for (let i = 0; i < 10; i++) await Promise.resolve();
    } };
}
(async () => {
  await check('URL preserves route/query without any token', () => {
    const target = protocol.webShellTarget(origin, '/pick?category=hall#saved');
    assert.equal(target.uri, `${origin}/pick?category=hall&wp_shell=1#saved`);
    assert.equal(target.origin, origin); assert.ok(!target.uri.includes(token));
  });
  for (const [base, route] of [
    ['http://app.example.test','/'], ['javascript:alert(1)','/'], ['file:///tmp/app','/'],
    ['https://user:password@app.example.test','/'], [origin,'//evil.example'], [origin,'/\\evil.example'],
    [origin,'https://evil.example'], [origin,'/admin'], [origin,'/admin/users'], [origin,'/?wp_token=x'],
  ]) await check(`reject unsafe initial target ${base} ${route}`, () => assert.throws(() => protocol.webShellTarget(base, route)));
  for (const url of ['https://app.example.test.evil.test/', 'https://app.example.test@evil.test/',
    'https://app.example.test:444/', 'http://app.example.test/', 'data:text/html,x', 'file:///tmp/x',
    `${origin}/admin/login`, `${origin}/?wp_token=x`, 'not a URL']) {
    await check(`reject unsafe navigation ${url}`, () => assert.equal(protocol.isTrustedWebShellUrl(url, origin), false));
  }
  await check('allow same-origin navigation with normalized HTTPS port', () => assert.equal(protocol.isTrustedWebShellUrl(`${origin}:443/pick`, origin), true));
  await check('accept valid message only from trusted origin', () => {
    const parsed = protocol.parseWebShellMessage(JSON.stringify({ type: 'session:ready', channel }), origin, origin);
    assert.equal(parsed.channel, channel); assert.equal(parsed.type, 'session:ready');
  });
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ type: 'session:ready', channel: 'short' }),
    JSON.stringify({ type: 'session:update', channel }), 'x'.repeat(1025)]) {
    await check(`reject malformed bridge message ${raw.slice(0, 60)}`, () => assert.equal(protocol.parseWebShellMessage(raw, origin, origin), null));
  }
  await check('ignore valid message from other origin', () => assert.equal(protocol.parseWebShellMessage(JSON.stringify({ type:'session:ready',channel }), 'https://evil.test', origin), null));
  for (const value of ['bad', '";alert(1)//', 'A'.repeat(44)]) {
    await check(`reject malformed token (${value.length})`, () => assert.throws(() => protocol.sessionInjection(origin, channel, value)));
  }
  for (const mode of ['valid', 'other-origin', 'iframe', 'old-page']) {
    await check(`injection delivery guard ${mode}`, () => {
      let delivered = 0;
      const win = { location: { origin: mode === 'other-origin' ? 'https://evil.test' : origin },
        __weddingpickSessionChannel: mode === 'old-page' ? 'b'.repeat(64) : channel,
        __weddingpickReceiveSession(c,t) { assert.equal(c,channel); assert.equal(t,token); delivered++; } };
      win.top = mode === 'iframe' ? {} : win;
      vm.runInNewContext(protocol.sessionInjection(origin,channel,token), { window: win });
      assert.equal(delivered, mode === 'valid' ? 1 : 0);
    });
  }
  await check('ordinary browser ignores legacy query credential', async () => {
    const c=browser(`${origin}/pick?wp_token=${token}&keep=1#item`,false);
    await c.api.initializeWebShellSession();
    assert.equal(c.win.location.href,`${origin}/pick?keep=1#item`);
    assert.equal(c.api.readWebShellToken(),null); assert.equal(c.api.isWebShellSession(),false);
    assert.equal(c.win.localStorage.getItem('weddingpick.sessionToken.v1'),null);
  });
  await check('bridge handshake is single-flight and removes receiver', async () => {
    const c=browser(); const first=c.api.initializeWebShellSession(), second=c.api.initializeWebShellSession();
    assert.equal(first,second); assert.equal(c.win.sent.length,1);
    assert.match(c.win.sent[0].channel,/^[a-f0-9]{64}$/); assert.equal(c.win.sent[0].type,'session:ready');
    c.win.localStorage.setItem('weddingpick.sessionToken.v1','legacy');
    c.receive(); await first;
    assert.equal(c.api.readWebShellToken(),token);assert.equal(c.win.localStorage.length,0);
    assert.equal(c.win.__weddingpickReceiveSession,undefined);assert.equal(c.win.__weddingpickSessionChannel,undefined);
    assert.equal(c.timers.size,0);assert.ok(!JSON.stringify(c.win.sent).includes(token));
  });
  await check('ready nonce is not reused across pages', () => {
    const a=browser(),b=browser();void a.api.initializeWebShellSession();void b.api.initializeWebShellSession();
    assert.notEqual(a.win.sent[0].channel,b.win.sent[0].channel);
  });
  await check('wrong nonce cannot supply session',async()=>{
    const c=browser();const pending=c.api.initializeWebShellSession();c.receive(otherToken,'b'.repeat(64));
    assert.equal(c.api.readWebShellToken(),null);c.receive(token);await pending;assert.equal(c.api.readWebShellToken(),token);
  });
  await check('invalid token fails closed',async()=>{
    const c=browser();const p=c.api.initializeWebShellSession();c.receive('invalid');await assert.rejects(p);
    assert.equal(c.api.readWebShellToken(),null);assert.equal(c.win.__weddingpickReceiveSession,undefined);
  });
  await check('injection and receiver interoperate without URL credential',async()=>{
    const c=browser();const p=c.api.initializeWebShellSession();const request=c.win.sent[0].channel;
    vm.runInNewContext(protocol.sessionInjection(origin,request,token),{window:c.win});await p;
    assert.equal(c.api.readWebShellToken(),token);assert.equal(c.win.location.search,'?wp_shell=1');
  });
  await check('timeout cleans callbacks and permits a new request',async()=>{
    const c=browser();const first=c.api.initializeWebShellSession();const firstChannel=c.win.sent[0].channel;
    [...c.timers.values()][0]();await assert.rejects(first);await Promise.resolve();
    assert.equal(c.win.__weddingpickReceiveSession,undefined);
    const second=c.api.initializeWebShellSession();assert.notEqual(c.win.sent[1].channel,firstChannel);
    c.receive();await second;
  });
  await check('no bridge with marker does not reuse stored session',async()=>{
    const c=browser(`${origin}/?wp_shell=1`,false);c.win.localStorage.setItem('weddingpick.sessionToken.v1',token);
    await assert.rejects(c.api.initializeWebShellSession());assert.equal(c.api.readWebShellToken(),null);
  });
  await check('iframe cannot initialize native session',async()=>{
    const c=browser();c.win.top={};await assert.rejects(c.api.initializeWebShellSession());assert.equal(c.win.sent.length,0);
  });
  await check('storage cleanup failure fails closed',async()=>{
    const c=browser();c.win.localStorage.removeItem=()=>{throw new Error('blocked');};
    const p=c.api.initializeWebShellSession();c.receive();await assert.rejects(p);assert.equal(c.api.readWebShellToken(),null);
  });
  await check('clear session sends channel but never token',async()=>{
    const c=browser();const p=c.api.initializeWebShellSession();c.receive();await p;
    c.api.clearWebShellToken();assert.equal(c.api.readWebShellToken(),null);
    assert.equal(c.win.sent.at(-1).type,'session:clear');assert.ok(!JSON.stringify(c.win.sent).includes(token));
  });
  await check('loadToken waits for handshake rather than reading old local token',async()=>{
    const c=browser();c.win.localStorage.setItem('weddingpick.sessionToken.v1',otherToken);
    const session=load(sessionPath,{
      '@react-native-async-storage/async-storage':c.win.localStorage,
      'expo-secure-store':secureStorage(),
      'react-native':{Platform:{OS:'web'}},
      './web-shell-session':c.api,
    },c.globals);
    const p=session.loadToken();c.receive();assert.equal(await p,token);
  });
  await check('webview cannot sign into a different account from native',async()=>{
    const c=browser();const p=c.api.initializeWebShellSession();c.receive();await p;
    const session=load(sessionPath,{
      '@react-native-async-storage/async-storage':c.win.localStorage,
      'expo-secure-store':secureStorage(),
      'react-native':{Platform:{OS:'web'}},
      './web-shell-session':c.api,
    },c.globals);
    await assert.rejects(session.saveToken(otherToken),/앱에서/);assert.equal(c.api.readWebShellToken(),null);
  });
  const ordinaryBridge={initializeWebShellSession:async()=>{},isWebShellSession:()=>false};
  await check('native storage writes and conditional clears are ordered',async()=>{
    const s=storage(),secure=secureStorage(),api=load(sessionPath,{
      '@react-native-async-storage/async-storage':s,
      'expo-secure-store':secure,
      'react-native':{Platform:{OS:'ios'}},
      './web-shell-session':ordinaryBridge,
    });
    let notifications=0;const unsubscribe=api.subscribeToken(()=>notifications++);
    await api.saveToken(token);assert.equal(await api.loadToken(),token);
    await api.saveToken(otherToken);assert.equal(await api.clearTokenIfMatches(token),false);assert.equal(await api.loadToken(),otherToken);
    assert.equal(await api.clearTokenIfMatches(otherToken),true);assert.equal(await api.loadToken(),null);
    assert.equal(notifications,3);unsubscribe();await api.saveToken(token);assert.equal(notifications,3);
  });
  await check('withdrawal clears only WeddingPick persistent and tab keys',async()=>{
    const c=browser(`${origin}/`,false);const s=c.win.localStorage;
    s.setItem('weddingpick.sessionToken.v1',token);s.setItem('other','keep');
    c.win.sessionStorage.setItem('weddingpick.kakaoAuthRequest.v1','pending');c.win.sessionStorage.setItem('other','keep');
    const session=load(sessionPath,{
      '@react-native-async-storage/async-storage':s,
      'expo-secure-store':secureStorage(),
      'react-native':{Platform:{OS:'web'}},
      './web-shell-session':c.api,
    },c.globals);
    await session.wipeDevice();assert.equal(s.getItem('weddingpick.sessionToken.v1'),null);assert.equal(s.getItem('other'),'keep');
    assert.equal(c.win.sessionStorage.getItem('weddingpick.kakaoAuthRequest.v1'),null);assert.equal(c.win.sessionStorage.getItem('other'),'keep');
  });
  await check('native component initial source has no credential',()=>{
    const c=component();assert.equal(c.node.props.source.uri,`${origin}/pick?keep=1&wp_shell=1`);
    assert.equal(c.node.props.mixedContentMode,'never');assert.equal(c.node.props.allowFileAccess,false);
  });
  await check('native sends token only to validated ready request',async()=>{
    const c=component();await c.message('session:ready');assert.ok(c.script.includes(token));
  });
  await check('native ignores foreign-origin ready request',async()=>{
    const c=component();await c.message('session:ready','https://evil.test');assert.equal(c.script,undefined);
  });
  await check('native discards reply when account changes during token read',async()=>{
    const c=component([token,otherToken]);await c.message('session:ready');assert.equal(c.script,undefined);
  });
  await check('native clears only the session it supplied',async()=>{
    const c=component();await c.message('session:ready');await c.message('session:clear');
    assert.equal(c.cleared,token);assert.equal(c.route,'/login');
  });
  await check('native ignores clear message from previous page',async()=>{
    const c=component();await c.message('session:ready');c.node.props.onLoadStart();await c.message('session:clear');assert.equal(c.cleared,undefined);
  });
  await check('native rejects another page channel for clear',async()=>{
    const c=component();await c.message('session:ready');await c.message('session:clear',origin,'b'.repeat(64));assert.equal(c.cleared,undefined);
  });
  await check('native invalidates bridge on account change',async()=>{
    const c=component();await c.message('session:ready');c.listener();await c.message('session:clear');assert.equal(c.cleared,undefined);
  });
  await check('native missing session returns to native login',async()=>{
    const c=component([null]);await c.message('session:ready');assert.equal(c.route,'/login');assert.equal(c.script,undefined);
  });
  await check('external HTTP links leave the authenticated WebView',()=>{
    const c=component();assert.equal(c.node.props.onShouldStartLoadWithRequest({url:'https://vendor.example',isTopFrame:true}),false);
    assert.equal(c.external,'https://vendor.example/');
  });
  await check('script links cannot execute or open externally',()=>{
    const c=component();assert.equal(c.node.props.onShouldStartLoadWithRequest({url:'javascript:alert(1)'}),false);assert.equal(c.external,undefined);
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
  function rootBoot({admin=false,bridgeFails=false}={}){
    const effects=[],states=[],refs=[];let oauth=0,resolutions=0,initializations=0,finish;
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
    '@/features/navigation/depth-back':{dismissToOrReplace:nothing},
      '@/features/auth/finish-sign-in':{entryAfterSignIn:async()=> '/',rememberSignedIn:nothing},
      '@/features/auth/is-auth-popup':{isAuthPopup:()=>false,completeAuthPopup:nothing},
      '@/features/auth/providers':{hasKakaoReturn:()=>hasCode,completeKakaoRedirect:async()=>{oauth++;hasCode=false;await wait;return{activated:true};}},
      '@/features/auth/sign-in-handoff':{claimSigningInMessageForBoot:nothing,setPendingSignInError:nothing},
      '@/features/auth/signing-in-view':{SigningInView:'SigningIn'},
      '@/features/capture/capture-draft':{CaptureDraftProvider:'Capture'},'@/features/documents/document-store':{DocumentStoreProvider:'Documents'},
      '@/features/errors/full-screen-error':{FullScreenError:'Error'},'@/features/inapp-browser/escape':{escapeInAppBrowser:()=>({kind:'none'})},
      '@/features/in-app-web/in-app-web-shell':{InAppWebShell:'Shell'},'@/features/inapp-browser/in-app-browser-notice':{InAppBrowserNotice:'Notice'},
      '@/features/auth/session-recovery':{resolveSessionEntry:async()=>{resolutions++;return'app';},sessionErrorKind:()=> 'general'},
      '@/api/web-shell-session':{stripLegacyWebShellToken:nothing,initializeWebShellSession:async()=>{initializations++;if(bridgeFails)throw new Error('bridge timeout');}},
      '@/features/splash/splash-view':{SPLASH_MINIMUM_MS:1,SplashView:'Splash'},
    },{window:win});
    const root=api.default();
    // hydration gate 자체는 verify-root-entry.cjs가 검증한다. 여기서는 hydration 이후
    // browserReady=true가 된 소비자 부팅의 single-flight/bridge 실패 의미만 고정한다.
    root.type({...root.props,browserReady:true});
    const entryState=states[2],errorState=states[3],bootEffect=effects[3];
    return{effects,states,entryState,errorState,bootEffect,finish,get oauth(){return oauth;},get resolutions(){return resolutions;},get initializations(){return initializations;}};
  }
  await check('StrictMode effect replay exchanges OAuth code only once',async()=>{
    const c=rootBoot();const cleanup=c.bootEffect();cleanup();c.bootEffect();
    for(let i=0;i<5;i++)await Promise.resolve();assert.equal(c.oauth,1);c.finish();
    for(let i=0;i<10;i++)await Promise.resolve();assert.equal(c.entryState.value,'app');assert.equal(c.resolutions,0);
  });
  await check('bridge failure does not fall back to old session or protected API',async()=>{
    const c=rootBoot({bridgeFails:true});c.bootEffect();for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(c.oauth,0);assert.equal(c.resolutions,0);assert.equal(c.entryState.value,null);assert.ok(c.errorState.value);
  });
  await check('admin entry never starts consumer authentication bootstrap',async()=>{
    const c=rootBoot({admin:true});c.bootEffect();for(let i=0;i<5;i++)await Promise.resolve();
    assert.equal(c.initializations,0);assert.equal(c.resolutions,0);assert.equal(c.oauth,0);
  });
})().then(()=>{
  console.log(JSON.stringify({passed:results.length,failed:0,tests:results},null,2));
}).catch(error=>{console.error(error);console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:1,tests:results},null,2));process.exitCode=1;});
