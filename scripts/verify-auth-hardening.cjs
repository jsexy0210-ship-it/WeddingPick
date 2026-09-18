const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let count = 0;
const results = [];
async function check(name, fn) {
  try { await fn(); count++; results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw new Error(`${name}: ${error.stack}`); }
}
function load(rel, mocks = {}, globals = {}) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const built = ts.transpileModule(text, {
    reportDiagnostics: true,
    fileName: rel,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const errors = built.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  const module = { exports: {} };
  const context = { module, exports: module.exports, console, Buffer, URL, URLSearchParams, Headers, Response, process,
    Date, setTimeout, clearTimeout, ...globals,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('node:')) return require(name);
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(built.outputText, context, { filename: rel });
  return module.exports;
}
const storage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
class ApiError extends Error { constructor(code, message) { super(message); this.code = code; } }
function reply() {
  return { headers: {}, code: 200, header(k,v) { this.headers[k] = v; return this; },
    status(c) { this.code = c; return this; }, send(data) { this.data = data; return this; },
    redirect(url) { this.url = url; return this; } };
}
const log = { warn() {}, info() {}, error() {} };
(async () => {
  const validator = load('apps/mobile/src/features/auth/kakao-redirect-state.ts');
  const now = 1000000, redirect = 'https://app.example.test/setup';
  const good = { state: 'expected-state', codeVerifier: 'v'.repeat(43), redirectUri: redirect, startedAt: now - 1 };
  const validate = (data, state = good.state, code = 'code') => validator.validateKakaoRedirect(JSON.stringify(data), state, code, redirect, now);
  await check('valid OAuth request preserves PKCE', () => assert.equal(validate(good).codeVerifier, good.codeVerifier));
  const invalid = [null, [], 2, 'text', {}, { ...good, state: '' }, { ...good, state: 's'.repeat(513) },
    { ...good, codeVerifier: undefined }, { ...good, codeVerifier: 'short' }, { ...good, codeVerifier: 'v'.repeat(129) },
    { ...good, codeVerifier: '!'.repeat(43) }, { ...good, redirectUri: 'https://evil.example/setup' },
    { ...good, startedAt: '999999' }, { ...good, ageAcknowledged: 'true' },
    { ...good, startedAt: now + 1 }, { ...good, startedAt: now - validator.KAKAO_AUTH_REQUEST_TTL_MS }];
  for (let i = 0; i < invalid.length; i++) await check(`reject malformed OAuth request ${i+1}`, () => assert.throws(() => validate(invalid[i])));
  await check('reject malformed JSON', () => assert.throws(() => validator.validateKakaoRedirect('{', good.state, 'code', redirect, now)));
  await check('reject absent request', () => assert.throws(() => validator.validateKakaoRedirect(null, good.state, 'code', redirect, now)));
  await check('accept just before TTL', () => assert.ok(validate({ ...good, startedAt: now - validator.KAKAO_AUTH_REQUEST_TTL_MS + 1 })));
  for (const state of [null, '', 'different']) await check(`reject state ${JSON.stringify(state)}`, () => assert.throws(() => validate(good, state)));
  for (const code of [null, '', ' ']) await check(`reject code ${JSON.stringify(code)}`, () => assert.throws(() => validate(good, good.state, code)));
  await check('never invent age acknowledgement', () => assert.equal(validate(good).ageAcknowledged, undefined));
  await check('preserve explicit age acknowledgement', () => assert.equal(validate({ ...good, ageAcknowledged: true }).ageAcknowledged, true));

  const passwords = load('apps/api/src/auth/admin-password.ts');
  const hash = passwords.hashAdminPassword('test-secret-only');
  await check('scrypt accepts correct password', async () => assert.equal(await passwords.verifyAdminPassword('test-secret-only', hash), true));
  await check('scrypt rejects incorrect password', async () => assert.equal(await passwords.verifyAdminPassword('wrong', hash), false));
  await check('salt is randomized', () => assert.notEqual(hash, passwords.hashAdminPassword('test-secret-only')));
  await check('hash excludes plaintext', () => assert.ok(!hash.includes('test-secret-only')));
  await check('explicit new bootstrap password works', async () => assert.equal(await passwords.verifyAdminPassword('new', hash, 'new'), true));
  await check('old hash cannot bypass new bootstrap password', async () => assert.equal(await passwords.verifyAdminPassword('test-secret-only', hash, 'new'), false));
  await check('plain-only bootstrap remains compatible', async () => assert.equal(await passwords.verifyAdminPassword('new', undefined, 'new'), true));
  await check('hash-only migration works after clearing plain', async () => assert.equal(await passwords.verifyAdminPassword('test-secret-only', hash, ' '), true));
  for (const invalid of [undefined, '', 'not-a-hash', 'scrypt$one', 'bcrypt$a$b']) {
    await check(`reject invalid hash ${invalid}`, async () => assert.equal(await passwords.verifyAdminPassword('anything', invalid), false));
  }
  await check('empty credentials fail closed', async () => assert.equal(await passwords.verifyAdminPassword('', undefined, ' '), false));
  await check('ID exact match only', () => { assert.equal(passwords.sameId('user', 'user'), true); assert.equal(passwords.sameId('User', 'user'), false); });

  function adminClient(status, body, sequence = ['token'], jsonHook) {
    let at = 0, clears = 0, redirected = 0, sent;
    const api = load('apps/mobile/src/app/admin/_api.ts', {
      '@/api/config': { API_URL: 'https://api.example.test' },
      './_session': { loadAdminToken: async () => sequence[Math.min(at++, sequence.length-1)], clearAdminToken: async () => { clears++; } },
    }, {
      window: { location: { pathname: '/admin/queue', assign: () => { redirected++; } } },
      fetch: async (_url, options) => { sent = options; return { status, ok: status >= 200 && status < 300, json: jsonHook ?? (async () => body) }; },
    });
    return { api, get clears() { return clears; }, get redirected() { return redirected; }, get sent() { return sent; } };
  }
  await check('403 preserves token and server message', async () => {
    const c=adminClient(403, { error: { message: 'viewer read only' } });
    await assert.rejects(c.api.apiFetch('/v1/admin/test'), e => e instanceof c.api.AdminForbidden && e.message==='viewer read only');
    assert.equal(c.clears,0); assert.equal(c.redirected,0);
  });
  await check('401 clears token and redirects', async () => {
    const c=adminClient(401); await assert.rejects(c.api.apiFetch('/v1/admin/test'), e=>e instanceof c.api.AdminUnauthorized);
    assert.equal(c.clears,1); assert.equal(c.redirected,1);
  });
  for(const status of [200,401,403]) await check(`ignore stale ${status} response`, async()=>{
    const c=adminClient(status, {}, ['old','new']); await assert.rejects(c.api.apiFetch('/v1/admin/test'), /계정이 변경/);
    assert.equal(c.clears,0);assert.equal(c.redirected,0);
  });
  await check('ignore stale response after JSON parse', async()=>{
    const c=adminClient(200, {}, ['old','old','new']);await assert.rejects(c.api.apiFetch('/v1/admin/test'), /계정이 변경/);
  });
  await check('403 invalid JSON still preserves token',async()=>{
    const c=adminClient(403, null, ['token'], async()=>{throw new Error('html');});
    await assert.rejects(c.api.apiFetch('/v1/admin/test'), e=>e instanceof c.api.AdminForbidden);assert.equal(c.clears,0);
  });
  await check('204 does not parse JSON or add body Content-Type',async()=>{
    const c=adminClient(204);assert.equal(await c.api.apiFetch('/v1/admin/test'),null);
    assert.equal(c.sent.headers.has('Content-Type'),false);assert.equal(c.sent.headers.get('Authorization'),'Bearer token');
  });
  await check('write request gets JSON Content-Type',async()=>{
    const c=adminClient(200,{});await c.api.apiFetch('/v1/admin/test',{method:'POST',body:'{}'});
    assert.equal(c.sent.headers.get('Content-Type'),'application/json');
  });

  function providerClient({ legacy = false, expired = false, mismatch = false, error = null, invalid = false } = {}) {
    let exchanged=0, input;
    const tab=storage(),old=storage();
    const key=validator.KAKAO_AUTH_REQUEST_KEY;
    const data={...good,startedAt:Date.now()-(expired?validator.KAKAO_AUTH_REQUEST_TTL_MS:1)};
    (legacy?old:tab).setItem(key,invalid?'{':JSON.stringify(data));
    let href=`${redirect}?${error?'error='+error:'code=code&state='+(mismatch?'wrong':good.state)}&keep=yes#section`;
    const win={sessionStorage:tab,location:new URL(href),history:{replaceState(_a,_b,p){href=new URL(p,redirect).href;win.location=new URL(href);}}};
    const platform={OS:'web'};
    const api=load('apps/mobile/src/features/auth/providers.ts', {
      '@react-native-async-storage/async-storage':old,
      '@weddingpick/ui':{SocialColors:{apple:'apple',kakao:'kakao'}},
      'expo-auth-session':{AuthRequest:class{},ResponseType:{Code:'code'},makeRedirectUri:()=>''},
      'expo-crypto':{getRandomBytesAsync:async(size)=>new Uint8Array(size)},
      'expo-web-browser':{maybeCompleteAuthSession(){}},'react':{},'react-native':{Platform:platform},
      '@/api/client':{ApiError,listAuthProviders:async()=>({providers:[]}),signIn:async()=>{},signInWithAuthorizationCode:async(data)=>{exchanged++;input=data;return{activated:true};}},
      '@/api/config':{isServerConfigured:true},'@/features/auth/dev-login':{DEV_LOGIN_SECRET:undefined,devIdToken:()=>''},
      '@/features/auth/sign-in-handoff':{AGE_UNVERIFIED_SIGN_IN_MESSAGE:'age unknown',UNDER_AGE_SIGN_IN_MESSAGE:'underage'},
      './kakao-redirect-state':validator,
    },{window:win});
    return{api,platform,tab,old,key,get href(){return href;},get exchanged(){return exchanged;},get input(){return input;}};
  }
  await check('web callback consumes request and removes only auth URL params',async()=>{
    const c=providerClient();await c.api.completeKakaoRedirect();assert.equal(c.exchanged,1);
    assert.equal(c.tab.getItem(c.key),null);assert.equal(c.old.getItem(c.key),null);
    assert.equal(c.href,redirect+'?keep=yes#section');assert.equal(c.input.codeVerifier,good.codeVerifier);
  });
  await check('legacy in-flight request remains compatible but is consumed',async()=>{
    const c=providerClient({legacy:true});await c.api.completeKakaoRedirect();assert.equal(c.exchanged,1);assert.equal(c.old.getItem(c.key),null);
  });
  for(const opts of [{expired:true},{mismatch:true},{invalid:true}])await check(`callback blocks before API ${JSON.stringify(opts)}`,async()=>{
    const c=providerClient(opts);await assert.rejects(c.api.completeKakaoRedirect());assert.equal(c.exchanged,0);assert.equal(c.tab.getItem(c.key),null);
  });
  await check('callback cancellation clears state without API call',async()=>{
    const c=providerClient({error:'access_denied'});assert.equal(await c.api.completeKakaoRedirect(),null);assert.equal(c.exchanged,0);assert.equal(c.tab.getItem(c.key),null);
  });
  await check('same callback cannot be exchanged twice',async()=>{
    const c=providerClient();await c.api.completeKakaoRedirect();assert.equal(await c.api.completeKakaoRedirect(),null);assert.equal(c.exchanged,1);
  });
  await check('Apple stays iOS-only and Google remains hidden',()=>{
    const c=providerClient();const list=[{provider:'google'},{provider:'apple'},{provider:'kakao'}];
    assert.equal(c.api.usableProviders(list).length,1);c.platform.OS='ios';assert.equal(c.api.usableProviders(list).map(p=>p.provider).join(','),'kakao,apple');
  });

  function adminRoute({ dbAccount, supers='0', plain='test-bootstrap', storedHash, role={role:'super'}, updateFails=false, cleanupFails=false }={}){
    let handler,issued=0,revoked=0,queries=0,accountQueries=0,superQueries=0;
    const chain={min(){return this;},max(){return this;}};
    const sessions={signIn:async()=>{issued++;return{token:'ephemeral-test-token',userId:'test-user',expiresAt:new Date()};},signOut:async()=>{revoked++;if(cleanupFails)throw new Error('cleanup failed');}};
    const api=load('apps/api/src/routes/admin-login.ts',{
      zod:{z:{string:()=>chain,object:()=>({safeParse:value=>({success:true,data:value})})}},
      '../auth/admin-password':passwords,
      '../auth/admin-role':{bootstrapLoginId:()=> 'test-admin',bootstrapPassword:()=>plain,bootstrapPasswordHash:()=>storedHash,resolveAdmin:async()=>role},
      '../auth/sessions':sessions,'../errors':{ApiError},
    });
    const context={config:{sessionTtlDays:30},pool:{query:async(sql)=>{queries++;
      if(sql.includes('SELECT failure_count') && sql.includes('structured.admin_login_attempts'))return{rows:[]};
      if(sql.includes('INSERT INTO structured.admin_login_attempts'))return{rows:[]};
      if(sql.includes('SELECT login_id')){accountQueries++;return{rows:dbAccount?[dbAccount]:[]};}
      if(sql.includes('count(*)')){superQueries++;return{rows:supers===undefined?[]:[{supers}]};}
      if(updateFails && sql.includes('UPDATE structured.users'))throw new Error('update failed');
      return{rows:[]};
    }}};
    api.registerAdminLoginRoutes({post(_path,fn){handler=fn;}},context);
    return{run:async(password=plain)=>handler({body:{id:'test-admin',password},ip:'test-ip',headers:{},log},reply()),get issued(){return issued;},get revoked(){return revoked;},get queries(){return queries;},get accountQueries(){return accountQueries;},get superQueries(){return superQueries;}};
  }
  await check('plain-only bootstrap can sign in',async()=>{const c=adminRoute();const r=await c.run();assert.equal(r.code,201);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(c.issued,1);});
  await check('active super blocks environment bootstrap',async()=>{const c=adminRoute({supers:'1'});await assert.rejects(c.run());assert.equal(c.issued,0);});
  await check('unrecognized super count fails closed',async()=>{const c=adminRoute({supers:'not-a-count'});await assert.rejects(c.run());assert.equal(c.issued,0);});
  await check('disabled DB account cannot fall through to environment',async()=>{const c=adminRoute({dbAccount:{login_id:'test-admin',password_hash:hash,disabled:true}});await assert.rejects(c.run('test-secret-only'));assert.equal(c.issued,0);assert.equal(c.accountQueries,1);assert.equal(c.superQueries,0);});
  await check('DB account never uses bootstrap plain',async()=>{const c=adminRoute({dbAccount:{login_id:'test-admin',password_hash:hash,disabled:false}});await assert.rejects(c.run('test-bootstrap'));assert.equal(c.issued,0);});
  await check('role failure revokes unreturned session',async()=>{const c=adminRoute({role:null});await assert.rejects(c.run(),e=>e.code==='forbidden');assert.equal(c.revoked,1);});
  await check('activation failure revokes unreturned session',async()=>{const c=adminRoute({updateFails:true});await assert.rejects(c.run(),/update failed/);assert.equal(c.revoked,1);});
  await check('cleanup failure does not hide original error',async()=>{const c=adminRoute({updateFails:true,cleanupFails:true});await assert.rejects(c.run(),/update failed/);assert.equal(c.revoked,1);});

  function socialRoute({markFails=false,entryFails=false,verdict='verified',ageAcknowledged,verifyFails=false}={}){
    const handlers={},response=reply();let issued=0,revoked=0,storedIdentity;
    const sessions={signIn:async(_pool,identity)=>{storedIdentity=identity;issued++;return{token:'test-token',userId:'test-id',expiresAt:new Date()};},signOut:async()=>{revoked++;},markAgeVerified:async()=>{if(markFails)throw new Error('mark failed');},sessionEntry:async()=>{if(entryFails)throw new Error('entry failed');return{activated:false,setupComplete:false,ageVerified:true};}};
    const api=load('apps/api/src/routes/auth.ts',{
      '@weddingpick/api-contract':{createSessionRequestSchema:{parse:v=>v}},
      '@weddingpick/domain':{AGE_BLOCKED_NOTICE:'underage',AGE_UNVERIFIED_NOTICE:'unverified'},
      '../auth/age-range':{ageVerdictFromRange:()=>verdict},'../auth/sessions':sessions,'../errors':{ApiError},
    });
    const context={pool:{},config:{sessionTtlDays:30},providers:{kakao:{flow:'authorization_code',verify:async()=>{if(verifyFails)throw new Error('provider failed');return{provider:'kakao',subject:'test-sub',profile:{ageRange:'20~29',nickname:'test'}};}}}};
    api.registerAuthRoutes({get(p,fn){handlers[p]=fn;},post(p,fn){handlers[p]=fn;},delete(p,fn){handlers['DELETE '+p]=fn;}},context);
    return{run:async()=>handlers['/v1/auth/sessions']({body:{provider:'kakao',authorizationCode:'code',state:'state',redirectUri:redirect,codeVerifier:'v'.repeat(43),ageAcknowledged},log},response),handlers,response,get issued(){return issued;},get revoked(){return revoked;},get storedIdentity(){return storedIdentity;}};
  }
  await check('social login response is no-store and drops ageRange',async()=>{const c=socialRoute();await c.run();assert.equal(c.response.headers['Cache-Control'],'no-store');assert.equal(c.storedIdentity.profile.ageRange,undefined);});
  await check('age update failure revokes unreturned social session',async()=>{const c=socialRoute({markFails:true});await assert.rejects(c.run(),/mark failed/);assert.equal(c.revoked,1);});
  await check('entry lookup failure revokes unreturned social session',async()=>{const c=socialRoute({entryFails:true});await assert.rejects(c.run(),/entry failed/);assert.equal(c.revoked,1);});
  await check('underage cannot override provider verdict',async()=>{const c=socialRoute({verdict:'under_age',ageAcknowledged:true});await assert.rejects(c.run(),e=>e.code==='under_age');assert.equal(c.issued,0);});
  await check('unknown age without acknowledgement never creates session',async()=>{const c=socialRoute({verdict:'unknown'});await assert.rejects(c.run(),e=>e.code==='age_unverified');assert.equal(c.issued,0);});
  await check('provider failure stays unauthenticated',async()=>{const c=socialRoute({verifyFails:true});await assert.rejects(c.run(),e=>e.code==='unauthenticated');assert.equal(c.issued,0);});
  await check('Naver callback forwards only approved fields',async()=>{const c=socialRoute();const r=reply();await c.handlers['/v1/auth/naver/callback']({query:{code:'c',state:'s',unexpected:'secret'}},r);assert.equal(r.url,'weddingpick://auth/naver?code=c&state=s');assert.equal(r.headers['Referrer-Policy'],'no-referrer');});
  if (process.env.AUTH_VERIFICATION_RESULTS_PATH) {
    fs.writeFileSync(process.env.AUTH_VERIFICATION_RESULTS_PATH, JSON.stringify({passed:count,failed:0,scope:'Isolated TypeScript execution with mocked SDK/network/DB boundaries, not full Jest or live login.',results},null,2));
  }
  console.log(`PASS: ${count} isolated regression checks. External SDK/network/DB boundaries are mocked.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
