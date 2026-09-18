/** 실제 변경 모듈 실행 검사. React/Expo/API는 대역이며 화면·실기기 검증이 아니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (e) { results.push({ name, passed: false, error: e.message }); throw e; }
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function load(relative, mocks = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const built = ts.transpileModule(source, { fileName: relative, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const errors = built.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  const module = { exports: {} };
  const context = { module, exports: module.exports, console, Date, encodeURIComponent,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      throw new Error(`Unmocked dependency: ${name} in ${relative}`);
    } };
  vm.runInNewContext(built.outputText, context, { filename: relative });
  return module.exports;
}
const ui = new Proxy({
  useTheme: () => ({ text: 'text', textAssistive: 'muted', background: 'background',
    border: 'border', tint: 'brand', track: 'track' }),
  Layout: new Proxy({}, { get: () => 24 }), Spacing: new Proxy({}, { get: () => 4 }),
  Radius: { pill: 9999, medium: 10 }, Border: { hairline: 1 }, LetterSpacing: { p025: .25 },
}, { get(target, key) { return target[key] ?? key; } });
const native = { Platform: { OS: 'web' }, View: 'View', ScrollView: 'ScrollView',
  Pressable: 'Pressable', StyleSheet: { create: x => x } };
const strings = {
  weddingFeed: { 'detail.error': '글을 불러오지 못했어요', 'detail.back': '돌아가기', 'detail.emptyBody': '본문이 아직 없어요' },
  community: { title: '라운지', 'tab.review': '후기', 'tab.feed': '웨딩정보', 'tab.expo': '박람회',
    write: '글쓰기', 'review.empty.title': '후기', 'review.empty.body': '아직 없어요', 'review.empty.cta': 'Pick 인증하기',
    'feed.empty.title': '웨딩정보', 'feed.empty.body': '아직 없어요', 'expo.empty.title': '박람회',
    'expo.empty.body': '아직 없어요', 'expo.note': '출처 안내', 'expo.closedDate': '{date} 종료',
    'expo.closed': '종료', 'expo.ongoing': '진행 중', 'expo.today': '오늘', 'expo.dday': 'D-{n}' },
  journey: { loadFailed: '불러오지 못했어요' }, common: { 'cta.retry': '다시 시도' },
};
function nodes(tree) {
  if (tree == null || typeof tree === 'boolean') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree !== 'object') return [tree];
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props.children)];
}
const find = (tree, type) => nodes(tree).filter(n => n && n.type === type);
const text = tree => nodes(tree).filter(n => typeof n === 'string').join('|');
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
function hooks() {
  const slots = []; let cursor = 0, pending = [], writes = 0;
  const same = (a,b) => a && b && a.length === b.length && a.every((x,i) => Object.is(x,b[i]));
  const api = {
    useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]={value:typeof initial==='function'?initial():initial};
      return [slots[i].value, value => { slots[i].value=typeof value==='function'?value(slots[i].value):value; writes++; }]; },
    useRef(initial) { const i=cursor++; if (!(i in slots)) slots[i]={value:{current:initial}}; return slots[i].value; },
    useCallback(fn,deps) { const i=cursor++; if (!same(slots[i]?.deps,deps)) slots[i]={value:fn,deps}; return slots[i].value; },
    useEffect(fn,deps) { const i=cursor++; const prior=slots[i]; if (same(prior?.deps,deps)) return;
      slots[i]={deps,cleanup:prior?.cleanup}; pending.push(()=>{prior?.cleanup?.();slots[i].cleanup=fn();}); },
  };
  return { api, render(fn) { cursor=0;return fn(); }, commit() { const tasks=pending;pending=[];tasks.forEach(f=>f()); },
    unmount() { slots.forEach(s=>s.cleanup?.());pending=[]; }, get writes(){return writes;} };
}
function detailHarness(initialId='a') {
  let id=initialId, backs=0; const h=hooks(), calls=[];
  const back=()=>{backs++;};
  const screen=load('apps/mobile/src/app/(tabs)/(home)/feed/[id].tsx',{
    'expo-router':{useLocalSearchParams:()=>({id})},react:h.api,'react-native':native,
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@weddingpick/ui':ui,
    '@/components/back-bar':{BackBar:'BackBar'},'@/features/home/category-image':{CategoryImage:'CategoryImage'},
    '@/features/home/content':{getWeddingFeedDetail:key=>{const d=deferred();calls.push({key,...d});return d.promise;}},
    '@/features/common/format-date':{formatDateDot:x=>x},'@/features/loading/delayed-loader':{DelayedLoadingView:'Loading'},
    '@/features/navigation/depth-back':{useDepthBack:()=>back},'../../../../../../../spec/strings.ko.json':strings,
  }).default;
  return { h,calls,render:()=>h.render(screen),setId:value=>{id=value;},get backs(){return backs;} };
}
const post = (id, body='body') => ({ id, title:`title-${id}`, categoryLabel:'예산', summary:'summary', body, imageUri:null,publishedAt:null });
function loungeHarness() {
  const h=hooks();const pushed=[];const replaced=[];
  const items=[{id:'post/a?b',title:'첫 글',summary:'summary',imageUrl:null,categoryLabel:'예산'},
    {id:'second',title:'둘째 글',summary:'summary',imageUrl:null,categoryLabel:'체크리스트'}];
  const feed={tabs:[{key:'all',label:'전체',categories:[]},{key:'budget',label:'예산',categories:['예산']}],items};
  const screen=load('apps/mobile/src/app/(tabs)/community/index.tsx',{
    '@weddingpick/domain':{daysUntil:()=>2,VENDOR_CATEGORY_LABEL:{}},'expo-router':{Redirect:'Redirect',router:{push:x=>pushed.push(x),replace:x=>replaced.push(x)},
      useFocusEffect:fn=>h.api.useEffect(fn,[fn]),useLocalSearchParams:()=>({})},react:h.api,'react-native':native,
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@weddingpick/ui':ui,
    '@/api/client':{listLoungeReviews:async()=>({reviews:[],caveat:''}),
      getWeddingFeed:async()=>feed,listExpos:async()=>({items:[]})},
    '@/features/auth/use-session':{useSession:()=>({state:{status:'signedIn'},refresh:()=>{}})},
    '@/features/errors/full-screen-error':{FullScreenError:'FullScreenError'},
    '@/features/home/category-image':{CategoryImage:'CategoryImage'},
    '@/features/loading/delayed-loader':{DelayedLoader:'Loader',DelayedLoadingView:'Loading'},
    '@/features/wedding/screen-kit':{NavBar:'NavBar'},'../../../../../../spec/strings.ko.json':strings,
  }).default;
  return{h,pushed,replaced,render:()=>h.render(screen)};
}
function splitFixture(script,role,missingAdmin=false) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wp-design-test-'));
  fs.mkdirSync(path.join(dir,'scripts'),{recursive:true});
  fs.writeFileSync(path.join(dir,'scripts/split-admin-dist.mjs'),script);
  const dist=path.join(dir,'apps/mobile/dist');
  for(const name of ['fonts/PretendardVariable.woff2','assets/image.jpg','_expo/app.js','my/profile.html','index.html',
    ...(missingAdmin?[]:['admin/login.html','admin/home.html'])]){
    fs.mkdirSync(path.dirname(path.join(dist,name)),{recursive:true});
    fs.writeFileSync(path.join(dist,name),'synthetic-fixture-not-a-real-font');
  }
  // 테스트는 명시한 임시 폴더만 정리한다. 상속된 배포 경로를 사용하지 않는다.
  const env={...process.env,WEDDINGPICK_DIST_DIR:dist,ADMIN_ORIGIN:'https://admin.example.test'};
  const run=spawnSync(process.execPath,[path.join(dir,'scripts/split-admin-dist.mjs'),role],{encoding:'utf8',timeout:5000,env});
  return{dir,dist,run,exists:name=>fs.existsSync(path.join(dist,name)),read:name=>fs.readFileSync(path.join(dist,name),'utf8'),
    cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
(async()=>{
  const tabs=load('apps/mobile/src/features/navigation/root-tabs.ts');
  const visible=load('apps/mobile/src/features/navigation/root-tab-visibility.ts',{'./root-tabs':tabs}).isRootTabPath;
  for(const [route,url] of [['index','/'],['search','/search'],['pick','/pick'],['wedding','/wedding'],['my','/my']]) {
    await check(`root visible: ${url}`,()=>assert.equal(visible(url,route),true));
    if(url!=='/')await check(`trailing slash: ${url}`,()=>assert.equal(visible(url+'/',route),true));
  }
  for(const [route,url] of [['my','/my/profile'],['my','/my/reports'],['search','/search/vendor-id'],
    ['search','/search/expo'],['pick','/pick/history'],['wedding','/wedding/id/events/new'],
    ['community','/community'],['capture','/capture'],['(home)','/feed/id'],['my','/myth'],
    ['my','/search'],[undefined,'/'],['index','/feed/id']])
    await check(`non-root hidden: ${url}`,()=>assert.equal(visible(url,route),false));
  const barMocks={'react-native':native,'@weddingpick/ui':ui,'./root-tabs':tabs,'./root-tab-visibility':{isRootTabPath:visible}};
  function renderBar(url,route,index=0){
    const bar=load('apps/mobile/src/features/navigation/tab-bar.tsx',{...barMocks,'expo-router':{usePathname:()=>url}}).RootTabBar;
    return bar({state:{index:0,routes:[{key:'r',name:route,state:{index}}]},descriptors:{r:{options:{}}},navigation:{},insets:{bottom:0}});
  }
  await check('actual tab bar hides deep link with stack index zero',()=>assert.equal(renderBar('/my/profile','my',0),null));
  await check('actual tab bar shows root independently of old stack index',()=>assert.notEqual(renderBar('/my','my',1),null));
  await check('actual tab bar handles absent focused route',()=>{
    const bar=load('apps/mobile/src/features/navigation/tab-bar.tsx',{...barMocks,'expo-router':{usePathname:()=>'/my'}}).RootTabBar;
    assert.equal(bar({state:{index:0,routes:[]},descriptors:{},navigation:{},insets:{bottom:0}}),null);
  });
  for(const id of [undefined,[],['a','b'],'','   '])await check(`missing or invalid detail route: ${JSON.stringify(id)}`,async()=>{
    const d=detailHarness(id===undefined?'temporary':id);if(id===undefined)d.setId(undefined);
    d.render();d.h.commit();assert.equal(d.calls.length,0);assert.equal(d.render().type,'ErrorView');
  });
  await check('detail success, empty body and shared back action',async()=>{
    const d=detailHarness();assert.equal(d.render().type,'Loading');d.h.commit();d.calls[0].resolve(post('a',''));await flush();
    const tree=d.render();assert.ok(text(tree).includes('title-a'));assert.ok(text(tree).includes('본문이 아직 없어요'));
    find(tree,'ActionButton')[0].props.onPress();assert.equal(d.backs,1);
  });
  await check('id transition never renders previous ready post',async()=>{
    const d=detailHarness();d.render();d.h.commit();d.calls[0].resolve(post('a'));await flush();assert.ok(text(d.render()).includes('title-a'));
    d.setId('b');assert.equal(d.render().type,'Loading');
  });
  for(const stale of ['success','failure'])await check(`ignore previous id ${stale}`,async()=>{
    const d=detailHarness();d.render();d.h.commit();d.setId('b');d.render();d.h.commit();
    d.calls[1].resolve(post('b'));await flush();
    stale==='success'?d.calls[0].resolve(post('a')):d.calls[0].reject(Error('old error'));await flush();
    assert.ok(text(d.render()).includes('title-b'));assert.ok(!text(d.render()).includes('title-a'));
  });
  await check('unmounted detail discards eventual response',async()=>{
    const d=detailHarness();d.render();d.h.commit();d.h.unmount();const before=d.h.writes;
    d.calls[0].resolve(post('a'));await flush();assert.equal(d.h.writes,before);
  });
  await check('error back and retry use shared back and fresh request',async()=>{
    const d=detailHarness();d.render();d.h.commit();d.calls[0].reject(Error('network'));await flush();
    const err=d.render();assert.equal(err.type,'ErrorView');err.props.onBack();assert.equal(d.backs,1);
    err.props.onRetry();assert.equal(d.calls.length,2);assert.equal(d.render().type,'Loading');
    d.calls[1].resolve(post('a'));await flush();assert.ok(text(d.render()).includes('title-a'));
  });
  await check('lounge feed row opens matching detail with escaped id',async()=>{
    const l=loungeHarness();l.render();l.h.commit();await flush();
    find(l.render(),'SegmentedTabs')[0].props.onChange('feed');
    const tree=l.render(),buttons=find(tree,'Pressable');assert.equal(buttons.length,2);
    assert.equal(buttons[0].props.accessibilityLabel,'첫 글');buttons[0].props.onPress();
    assert.equal(l.pushed[0],'/feed/post%2Fa%3Fb');
    assert.equal(find(tree,'NavBar')[0].props.right,null);
  });
  await check('lounge category filters preserve clickable detail',async()=>{
    const l=loungeHarness();l.render();l.h.commit();await flush();find(l.render(),'SegmentedTabs')[0].props.onChange('feed');
    find(l.render(),'FilterChip')[1].props.onPress();const buttons=find(l.render(),'Pressable');
    assert.equal(buttons.length,1);assert.equal(buttons[0].props.accessibilityLabel,'첫 글');
  });
  await check('lounge verified review action is restricted to review tab',async()=>{
    const l=loungeHarness();l.render();l.h.commit();await flush();const action=find(l.render(),'NavBar')[0].props.right;
    assert.equal(action.label,'글쓰기');action.onPress();assert.equal(l.pushed[0],'/my/reviews');
  });
  await check('lounge back defaults to home',async()=>{
    const l=loungeHarness();l.render();l.h.commit();await flush();
    find(l.render(),'NavBar')[0].props.onBack();assert.equal(l.replaced[0],'/');
  });
  const script=fs.readFileSync(path.join(root,'scripts/split-admin-dist.mjs'),'utf8');
  const legacy=script.replace(/^[ \t]*['"]fonts['"],[^\n]*\n/m,'');
  await check('negative control reproduces original font deletion',()=>{
    assert.notEqual(legacy,script,'Font-retention negative control must remove the allowlist entry');
    const f=splitFixture(legacy,'admin');try{assert.equal(f.run.status,0);assert.equal(f.exists('fonts/PretendardVariable.woff2'),false);}finally{f.cleanup();}
  });
  await check('admin distribution retains fonts and assets, prunes user routes',()=>{
    const f=splitFixture(script,'admin');try{assert.equal(f.run.status,0);for(const p of ['fonts/PretendardVariable.woff2','assets/image.jpg','_expo/app.js','admin/login.html'])assert.equal(f.exists(p),true);
      assert.equal(f.exists('my/profile.html'),false);assert.ok(f.read('index.html').includes('/admin/home'));}finally{f.cleanup();}
  });
  await check('app distribution retains fonts and redirects admin routes',()=>{
    const f=splitFixture(script,'app');try{assert.equal(f.run.status,0);assert.equal(f.exists('fonts/PretendardVariable.woff2'),true);
      assert.equal(f.exists('my/profile.html'),true);assert.ok(f.read('admin/login.html').includes('/admin/login'));}finally{f.cleanup();}
  });
  for(const [role,missing]of [['bad-role',false],['admin',true]])await check(`distribution fails safely: ${role}, missing-admin=${missing}`,()=>{
    const f=splitFixture(script,role,missing);try{assert.notEqual(f.run.status,0);assert.equal(f.exists('my/profile.html'),true);assert.equal(f.exists('fonts/PretendardVariable.woff2'),true);}finally{f.cleanup();}
  });
})().then(()=>{
  const summary={passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,
    node:process.version,typescript:ts.version,scope:'isolated-module-and-real-filesystem-regressions',
    limits:['React/Expo/API test doubles','No real browser/native rendering','Not full workspace typecheck/Jest/DB/CI'],results};
  if(process.env.DESIGN_REPORT_PATH)fs.writeFileSync(process.env.DESIGN_REPORT_PATH,JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
}).catch(error=>{console.error(error);process.exitCode=1;});
