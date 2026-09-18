from pathlib import Path
import hashlib,json,shutil
root=Path.cwd()
bundle=root/'.design-validation'
manifest=json.loads((bundle/'manifest.json').read_text())
def blob(path):
    data=path.read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
for entry in manifest:
    path=root/entry['path']
    actual=blob(path) if path.exists() else None
    if actual!=entry['before']: raise SystemExit(f"Base content changed: {entry['path']} {actual}")
for entry in manifest:
    if entry['before'] is None:
        path=root/entry['path'];path.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(bundle/'files'/entry['path'],path)

from pathlib import Path
import json,re
root=Path.cwd()
def update_json(path,changes):
 p=root/path; text=p.read_text(); dec=json.JSONDecoder()
 def spans():
  found={}
  def skip(i):
   while i<len(text) and text[i].isspace():i+=1
   return i
  def parse(i,trail):
   i=skip(i); start=i
   if text[i]=='{':
    i=skip(i+1)
    while text[i]!='}':
     key,n=dec.raw_decode(text,i);i=skip(n);assert text[i]==':';i=parse(i+1,trail+(key,));i=skip(i)
     if text[i]==',':i=skip(i+1)
     else:break
    assert text[i]=='}';i+=1
   elif text[i]=='[':
    i=skip(i+1);n=0
    while text[i]!=']':
     i=parse(i,trail+(n,));i=skip(i);n+=1
     if text[i]==',':i=skip(i+1)
     else:break
    assert text[i]==']';i+=1
   else:_,i=dec.raw_decode(text,i)
   found[trail]=(start,i);return i
  parse(0,());return found
 for trail,value in changes:
  start,end=spans()[trail];text=text[:start]+json.dumps(value,ensure_ascii=False)+text[end:]
 p.write_text(text)
update_json(Path('spec/tokens.json'),[
 (('$meta','handoff'),'docs/design/handoff/tokens.json 및 docs/design/README.md의 2026-09-17 결정. Pretendard·카카오+Apple 예외를 유지한다.'),
 (('spacing','gutter','use'),'좌우 여백 24. 전체 폭 이미지와 가로 캐러셀도 첫 콘텐츠 시작선은 24에 맞춘다.'),
 (('spacing','pageX','value'),24),
 (('grid','gutter'),24),
 (('grid','$note'),'docs/design/handoff/tokens.json spacing.gutter=24. spacing.pageX와 Layout.gutter/pageX도 같은 값을 사용한다.'),
 (('grid','col2'),'(390 - 48 - 11) / 2 = 165.5'),
 (('grid','col3'),'(390 - 48 - 20) / 3 = 107.3333'),
 (('radius','control'),6),
 (('radius','$note'),'docs/design/handoff/tokens.json의 수치를 따른다. control 6 · card 10 · pick 14 · sheet 20. 구형 cardLarge/thumb/hero/panel/callout 별칭은 기존 화면 호환용이며 최신 화면의 기준이 아니다.'),
])
p=root/'packages/ui/src/theme.ts';s=p.read_text();s=s.replace('  control: 16,','  control: 6,',1)
s=s.replace(' * `docs/design-handoff/current/tokens.json`을 그대로 옮긴 것이다.**',' * `docs/design/handoff/tokens.json`과 상위 README의 확정 예외를 반영한다.**',1)
a=s.index('  /**\n   * 버튼과 입력 필드. radius.control.')
b=s.index('  control: 6,',a)
s=s[:a]+'  /** 버튼과 입력 필드. docs/design/handoff/tokens.json radius.control=6. */\n'+s[b:]
p.write_text(s)
p=root/'spec/strings.ko.json';s=json.loads(p.read_text())
s['home'].update({
 'section.pending':'남은 스케줄','section.budget':'예산현황','section.news':'웨딩 소식',
 'more':'자세히','lounge':'라운지','pending.count':'후보 {n}곳 담김','pending.before':'아직 안 봤어요',
 'pending.done':'정할 준비를 다 끝냈어요','done.body':'정한 곳은 웨딩노트에서 볼 수 있어요',
 'note.open':'웨딩노트 보기','budget.total':'예산 {amount}',
 'budget.note':'Pick 인증하면 낸 금액이 자동으로 들어가요','budget.exceeded':'예산을 넘었어요',
 'budget.empty':'예산 금액을 정하면 여기에 보여요','budget.set':'예산 정하기',
 'budget.progress':'예산의 {n}% 사용','recommend.error':'추천을 불러오지 못했어요',
 'recommend.empty':'정보 수집 중','recommend.done':'정할 준비를 다 끝냈어요',
 'recommend.more':'더 찾아보기','recommend.title':'웨딩픽 추천',
 'pick.failed':'Pick하지 못했어요. 잠시 후 다시 시도해주세요.',
 'unpick.failed':'후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.'})
update_json(Path('spec/strings.ko.json'),[(('home',),s['home'])])
p=root/'spec/strings.ko.json';t=p.read_text();old=json.dumps(s['home'],ensure_ascii=False)
new=json.dumps(s['home'],ensure_ascii=False,indent=2).replace('\n','\n  ')
p.write_text(t.replace(old,new,1))

r=Path.cwd()
def edit(path, fn):
 p=r/path;s=p.read_text();t=fn(s);assert t!=s,path;p.write_text(t)
def recs(s):
 s=s.replace("import { router } from 'expo-router';", "import { router, useFocusEffect } from 'expo-router';")
 s=s.replace('useCallback, useEffect, useState','useCallback, useRef, useState')
 s=s.replace("import { BackBar } from '@/components/back-bar';", "import { BackBar } from '@/components/back-bar';\nimport { useDepthBack } from '@/features/navigation/depth-back';\nimport { recommendationsAreComplete } from '@/features/home/canon-state';\nimport strings from '../../../../../../spec/strings.ko.json';\n\nconst S = strings.home;")
 start=s.index('/**\n * 웨딩픽 추천 전체')
 end=s.index('/** 아직 못 받았을 때',start)
 s=s[:start]+'''/**
 * 추천 전체: docs/design/figma-export/08-recommendations.dc.html.
 * 미결정 업종만 조회하며 완료·정보 부족·조회 실패를 구분한다.
 * 홈과 같은 API와 카드를 사용하고 다른 화면에서 돌아오면 다시 조회한다.
 */
'''+s[end:]
 s=s.replace("  const [state, setState]", "  const back = useDepthBack();\n  const version = useRef(0);\n  const [state, setState]",1)
 start=s.index('  const load = useCallback(')
 end=s.index('\n  async function onPressPick',start)
 s=s[:start]+'''  const load = useCallback(() => {
    const request = ++version.current;
    setError(null);
    setState(null);
    void getCategoryRecommendations()
      .then((response) => {
        if (request === version.current) setState(response);
      })
      .catch(() => {
        if (request === version.current) setError(S['recommend.error']);
      });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => { version.current += 1; };
  }, [load]));
'''+s[end:]
 s=s.replace("if (result === 'picked') setPickDoneOpen(true);", "if (result === 'picked') { setPickDoneOpen(true); load(); }")
 s=s.replace("setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.')", "setToast(S['pick.failed'])")
 s=s.replace("if (!ok) setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');", "if (!ok) setToast(S['unpick.failed']);\n    else load();")
 s=s.replace("onBack={() => router.back()}", "onBack={back}")
 s=s.replace('              웨딩픽 추천',"              {S['recommend.title']}")
 s=s.replace('              아직 남은 준비를 한눈에 확인해보세요', "              {S['recommend.body']}")
 s=s.replace('<EmptyView title="정할 준비를 다 끝냈어요." />', '''<EmptyView
              title={recommendationsAreComplete(state) ? S['recommend.done'] : S['recommend.empty']}
              description={recommendationsAreComplete(state) ? S['done.body'] : undefined}
              actionLabel={recommendationsAreComplete(state) ? S['note.open'] : S['recommend.more']}
              onAction={() => router.push(recommendationsAreComplete(state) ? '/wedding' : '/search')}
            />''')
 return s
edit('apps/mobile/src/app/(tabs)/(home)/recommendations.tsx',recs)
def pick(s):
 i=s.index("import { VendorCard }")
 s=s[:i]+"import strings from '../../../../../spec/strings.ko.json';\n\nconst S = strings.home;\n\n"+s[i:]
 s=s.replace('            Pick 추천', "            {S['recommend.title']}")
 s=s.replace('              정할 준비를 다 끝냈어요', "              {remaining === 0 ? S['recommend.done'] : S['recommend.empty']}")
 s=s.replace("{!expanded ? null : group.vendors.length === 0 ? (", "{!expanded ? null : (\n        <>\n        {group.vendors.length === 0 ? (")
 marker='''          {/*
           * 아래 단추 줄.'''
 idx=s.index(marker)
 s=s[:idx]+"        </>\n      )}\n\n"+s[idx:]
 s=s.replace('                    더 찾아보기', "                    {S['recommend.more']}")
 return s
edit('apps/mobile/src/features/home/pick-recommend.tsx',pick)
def vendor(s):
 s=s.replace('formatCount, priceLine','priceLine')
 start=s.index('/**\n * 추천 업체 카드')
 end=s.index('export type VendorCardProps',start)
 s=s[:start]+'''/**
 * 홈·추천이 공유하는 카드. docs/design/figma-export/01-home, 08-recommendations 기준.
 * 별점 대신 실제 제보 건수/기준을 표시하고 서버가 제공한 추천 이유만 쓴다.
 * 제보 부족 시 업체 안내 금액으로 대체하지 않는다.
 */
'''+s[end:]
 s=s.replace('priceLine(vendor.paidPrice, vendor.guidePrice)', 'priceLine(vendor.paidPrice, null)')
 s=s.replace('onPress={onPressPick}', 'onPress={(event) => { event.stopPropagation(); onPressPick(); }}')
 start=s.index('          {/* 별점이 없으면')
 end=s.index('\n        </View>',start)
 s=s[:start]+s[end:]
 marker='''        </View>
      </View>
    </Pressable>'''
 s=s.replace(marker,'''        </View>
        <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.proof}>
          {price.caption}
        </ThemedText>
        {vendor.reasons?.[0] ? (
          <ThemedText type="f12" themeColor="tint" numberOfLines={2} style={styles.reason}>
            {vendor.reasons[0]}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>''')
 s=s.replace("  rating: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, flexShrink: 0 },", "  proof: { marginTop: Spacing.one },\n  reason: { marginTop: Spacing.two },")
 return s
edit('apps/mobile/src/features/home/vendor-card.tsx',vendor)
def hero(s):
 s=s.replace('  partnerInvitePending: boolean;', '  partnerInvitePending: boolean;\n  /** 최신 홈은 별도 예산현황을 사용한다. */\n  showBudget?: boolean;')
 s=s.replace('  partnerInvitePending,','  partnerInvitePending,\n  showBudget = true,',1)
 s=s.replace(" * **예산 카드를 홈에 따로 두지 않는다**(§3) — 예산은 이 한 줄이 전부다."," * 최신 docs/design/01-home의 예산현황 사용 시 showBudget=false로 중복을 없앤다.")
 start=s.index('      {/* 예산.')
 end=s.index('\n      {/* 커플 연결',start)
 chunk=s[start:end]
 chunk=chunk.replace('      <Pressable','      {showBudget ? <Pressable',1).replace('      </Pressable>','      </Pressable> : null}')
 s=s[:start]+chunk+s[end:]
 s=s.replace('          D-{formatCount(daysLeft)}', "          {daysLeft === 0 ? 'D-DAY' : `D${daysLeft > 0 ? '-' : '+'}${formatCount(Math.abs(daysLeft))}`}" )
 return s
edit('apps/mobile/src/features/home/hero.tsx',hero)

p=r/'apps/mobile/src/app/(tabs)/index.tsx';s=p.read_text()
s=s.replace("import { router } from 'expo-router';", "import { router, useFocusEffect } from 'expo-router';")
s=s.replace('  Layout,\n','  ActionButton,\n  ErrorView,\n  Layout,\n',1)
s=s.replace("import { Hero }", "import { HomeBudget, PendingPreparation } from '@/features/home/home-summary';\nimport strings from '../../../../../spec/strings.ko.json';\n\nconst S = strings.home;\n\nimport { Hero }")
a=s.index('/**\n * 홈 —');b=s.index('/** 홈이 웨딩피드',a)
s=s[:a]+'''/**
 * 최신 홈의 준비현황·예산현황·라운지 진입을 docs/design/01-home과 README에 맞춘다.
 * API 실패는 빈 상태나 완료로 바꾸지 않는다. 추가 데이터/API를 만들지 않고
 * bootstrap과 추천의 실제 값을 사용한다.
 */
'''+s[b:]
s=s.replace('  const [data, setData]', '''  const loadVersion = useRef(0);
  const [bootError, setBootError] = useState(false);
  const [recommendationStatus, setRecommendationStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [contentStatus, setContentStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData]''',1)
a=s.index('  const load = useCallback(');b=s.index('\n  useEffect(() => {',a)
s=s[:a]+'''  const load = useCallback(() => {
    if (isWebShellScreen('home')) return;
    const version = ++loadVersion.current;
    const current = () => version === loadVersion.current;
    setBootError(false);
    setRecommendationStatus('loading');
    setContentStatus('loading');

    void listWeddingContent(HOME_FEED_PREVIEW_COUNT)
      .then((content) => {
        if (!current()) return;
        setData((previous) => ({ ...previous, content }));
        setContentStatus('ready');
      })
      .catch(() => { if (current()) setContentStatus('error'); });

    void listExpos({ sort: 'date' })
      .then(({ items }) => {
        if (current()) setData((previous) => ({
          ...previous,
          expos: items.filter((expo) => expo.status !== 'closed').slice(0, HOME_EXPO_COUNT),
        }));
      })
      .catch(() => { if (current()) setData((previous) => ({ ...previous, expos: [] })); });

    void getAppBootstrap()
      .then((boot) => {
        if (current()) setData((previous) => ({
          ...previous, me: boot.member, candidates: boot.candidates, budget: boot.budget,
          bracketAnswered: boot.bracketAnswered, partnerInvitePending: boot.partnerInvitePending,
          unread: boot.notifications?.unread ?? 0,
        }));
      })
      .catch(() => { if (current()) setBootError(true); })
      .finally(() => { if (current()) setSettled(true); });

    void getCategoryRecommendations(HOME_RECOMMEND_CATEGORIES)
      .then((response) => {
        if (!current()) return;
        setData((previous) => ({ ...previous, groups: response.groups, remaining: response.remaining,
          remainingCategories: response.remainingCategories }));
        setRecommendationStatus('ready');
      })
      .catch(() => { if (current()) setRecommendationStatus('error'); });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => { loadVersion.current += 1; };
  }, [load]));
'''+s[b:]
s=s.replace("if (result === 'picked') setPickDoneOpen(true);", "if (result === 'picked') { setPickDoneOpen(true); load(); }")
s=s.replace("setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.')", "setToast(S['pick.failed'])")
s=s.replace("if (!ok) setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');", "if (!ok) setToast(S['unpick.failed']);\n    else load();")
a=s.index('  const daysLeft =');s=s[:a]+"  if (bootError) return <ErrorView message={strings.journey.loadFailed} onRetry={load} />;\n\n"+s[a:]
s=s.replace('            budget={data.budget}', '            showBudget={false}\n            budget={data.budget}',1)
s=s.replace('''          <PickRecommend
''','''          <PendingPreparation
            statuses={categoryStatuses({ candidates: data.candidates, preparedCategories: data.me?.preparedCategories ?? [] })}
            onOpen={(category) => router.push(`/search?category=${category}`)}
            onMore={() => router.push('/progress')}
            onComplete={() => router.push('/wedding')}
          />

          {recommendationStatus === 'error' ? (
            <View style={styles.block}>
              <ThemedText type="f14">{S['recommend.error']}</ThemedText>
              <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={load} />
            </View>
          ) : recommendationStatus === 'loading' ? (
            <View style={styles.block}><DelayedLoader size={28} /></View>
          ) : <PickRecommend
''',1)
s=s.replace('''            onPressMore={() => router.push('/recommendations')}
          />''','''            onPressSearchMore={(category) => router.push(`/search?category=${category}`)}
            onPressMore={() => router.push('/recommendations')}
          />}

          <HomeBudget
            budget={data.budget}
            onOpen={() => router.push(data.me?.weddingId == null ? '/my/wedding-settings' : `/wedding/${data.me.weddingId}/expenses`)}
          />''',1)
s=s.replace('''          {/* 웨딩피드 — 콘텐츠가 없으면 섹션째 접는다. 빈 자리를 제목으로 알리지 않는다. */}
          {data.content.length === 0 ? null : (''', '''          {/* 콘텐츠가 없어도 라운지 진입은 유지한다. */}
          {(''')
s=s.replace('                    웨딩피드', "                    {S['section.news']}")
s=s.replace('                    지금 알아두면 좋은 것만 모았어요', "                    {S['news.body']}")
s=s.replace('accessibilityLabel="웨딩피드 전체 보기"', "accessibilityLabel={S.lounge}")
s=s.replace("onPress={() => router.push('/feed')}","onPress={() => router.push('/community')}")
s=s.replace('                    더보기', '                    {S.lounge}')
s=s.replace('''              <WeddingContent items={data.content} onPressItem={(id) => router.push(`/feed/${id}`)} />''','''              {contentStatus === 'loading' ? <DelayedLoader size={28} /> : contentStatus === 'error' ? (
                <View>
                  <ThemedText type="f13" themeColor="textAssistive">{strings.journey.loadFailed}</ThemedText>
                  <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={load} />
                </View>
              ) : data.content.length === 0 ? (
                <ThemedText type="f13" themeColor="textAssistive">{strings.community['feed.empty.body']}</ThemedText>
              ) : <WeddingContent items={data.content} onPressItem={(id) => router.push(`/feed/${encodeURIComponent(id)}`)} />}''')
p.write_text(s)
p=r/'apps/mobile/src/features/home/home-summary.tsx';p.write_text(p.read_text().replace("? 'danger' :", "? 'negative' :"))
p=r/'spec/strings.ko.json';t=p.read_text();data=json.loads(t)
old=json.dumps(data['home'],ensure_ascii=False,indent=2).replace('\n','\n  ')
data['home']['recommend.body']='아직 남은 준비를 한눈에 확인해보세요'
data['home']['news.body']='지금 알아두면 좋은 것만 모았어요'
new=json.dumps(data['home'],ensure_ascii=False,indent=2).replace('\n','\n  ')
assert old in t;p.write_text(t.replace(old,new,1))

for file in ['apps/mobile/src/features/home/pick-recommend.tsx','apps/mobile/src/app/(tabs)/index.tsx','apps/mobile/src/app/(tabs)/(home)/recommendations.tsx']:
    p=root/file;s=p.read_text();s=s.replace('\nconst S = strings.home;\n','');idx=s.index('/**');s=s[:idx]+'const S = strings.home;\n\n'+s[idx:];p.write_text(s)
for name in ['apps/mobile/src/app/(tabs)/index.tsx','apps/mobile/src/app/(tabs)/(home)/recommendations.tsx']:
    p=root/name;s=p.read_text();s=s.replace('  const candidates = useMyCandidates();','  const candidates = useMyCandidates();\n  const reloadCandidates = candidates.reload;')
    s=s.replace('  useFocusEffect(useCallback(() => {\n    load();','  useFocusEffect(useCallback(() => {\n    load();\n    void reloadCandidates().catch(() => undefined);')
    s=s.replace('  }, [load]));','  }, [load, reloadCandidates]));',1);p.write_text(s)
for entry in manifest:
    actual=blob(root/entry['path'])
    if actual!=entry['after']: raise SystemExit(f"Output mismatch: {entry['path']} {actual}")
print(json.dumps({'verifiedFiles':len(manifest),'allBlobHashesMatch':True}))
