import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';

import { clearAdminToken, loadAdminToken, readAdminTokenSync, subscribeAdminToken } from './_session';

/**
 * 사이드바.
 *
 * **`readOnly`는 「이 화면은 지금 조회만 된다」는 표시다**(2026-09-10 대표 지시 —
 * 「서버에 없는 동작들 화면에도 목록 디스에이블 처리해」).
 *
 * 화면 안쪽은 이미 잠겨 있다(`BACKEND_PENDING`). 그런데 그것은 **들어가 봐야**
 * 보인다. 메뉴만 보고는 어느 것이 실제로 일을 하는지 알 수 없어서, 운영자는
 * 열세 곳을 하나씩 눌러 보고서야 「조작이 안 되는 곳」을 알게 된다.
 *
 * **메뉴를 죽이지는 않는다.** 이 열세 곳도 조회는 전부 된다 — 목록 · 지표 · 상태가
 * 실제 서버 값으로 나온다. 눌리지 않게 막으면 되는 것까지 못 보게 된다. 눌러서
 * 들어가되, 무엇을 기대하면 되는지 목록에서 미리 알려준다.
 *
 * 서버 동작이 붙으면 그 줄의 `readOnly`를 지운다. 화면 안의 `BACKEND_PENDING`과
 * 짝이라, 한쪽만 지우면 말이 어긋난다.
 */
const NAV_GROUPS: {
  group?: string;
  key?: string;
  label?: string;
  href?: string;
  readOnly?: boolean;
}[] = [
  { group: '대시보드' },
  { key: 'home', label: '관리자 홈', href: '/admin/home' },
  { key: 'briefing', label: '일일 브리핑', href: '/admin/briefing' },
  { key: 'decisions', label: '자동 결정 현황', href: '/admin/decisions' },
  { group: '검토해요' },
  { key: 'queue', label: '확인 필요 큐', href: '/admin/queue' },
  { key: 'rebuttal', label: '후기 · 반론', href: '/admin/rebuttal' },
  { key: 'objections', label: '후기 이의제기', href: '/admin/objections', readOnly: true },
  { key: 'pii-reviews', label: '개인정보 검토', href: '/admin/pii-reviews' },
  { group: '데이터' },
  { key: 'data-pipeline', label: '제보 처리 현황', href: '/admin/data-pipeline', readOnly: true },
  { key: 'price-stats', label: '가격 통계', href: '/admin/price-stats' },
  { key: 'vendors', label: '업체 관리', href: '/admin/vendors', readOnly: true },
  { key: 'images', label: '이미지 자동수급', href: '/admin/images', readOnly: true },
  { key: 'email-matching', label: '이메일 자동매칭', href: '/admin/email-matching', readOnly: true },
  { group: '지표를 봐요' },
  { key: 'stats', label: '이상치 · 조작 탐지', href: '/admin/stats' },
  { group: '사용자' },
  { key: 'users', label: '계정 관리', href: '/admin/users' },
  { key: 'biz-queue', label: '업체 문의 큐', href: '/admin/biz-queue', readOnly: true },
  { key: 'report', label: 'VOC', href: '/admin/report' },
  { group: '성장 · 광고' },
  { key: 'marketing', label: '마케팅 자동화', href: '/admin/marketing' },
  { key: 'campaigns', label: '캠페인 · 보상', href: '/admin/campaigns', readOnly: true },
  { key: 'revenue', label: 'Revenue', href: '/admin/revenue' },
  { key: 'ads', label: '광고 집행 관리', href: '/admin/ads', readOnly: true },
  { key: 'ads-gate', label: '광고 실운영 게이트', href: '/admin/ads-gate', readOnly: true },
  { group: '콘텐츠' },
  { key: 'faq', label: 'FAQ 관리', href: '/admin/faq' },
  { key: 'terms', label: '약관 · 방침', href: '/admin/terms', readOnly: true },
  { key: 'og-card', label: '링크 미리보기', href: '/admin/og-card' },
  { group: '운영' },
  { key: 'automation', label: '자동화 상태', href: '/admin/automation', readOnly: true },
  { key: 'kill-switch', label: 'Kill Switch', href: '/admin/kill-switch' },
  { key: 'rollback', label: '롤백 관리', href: '/admin/rollback', readOnly: true },
  { group: '시스템' },
  { key: 'ai-usage', label: 'AI 사용량 · 비용', href: '/admin/ai-usage' },
  { key: 'policy-engine', label: 'Policy Engine', href: '/admin/policy-engine', readOnly: true },
  { key: 'audit-log', label: '감사 로그', href: '/admin/audit-log' },
];

const LOGIN_PATH = '/admin/login';

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarLogo}>
        <Text style={styles.sidebarTitle}>웨딩픽 관리자</Text>
      </View>
      <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
        {NAV_GROUPS.map((item, i) => {
          if (item.group) {
            return (
              <Text key={i} style={styles.navGroup}>
                {item.group}
              </Text>
            );
          }
          const active = item.href ? pathname.startsWith(item.href) : false;
          return (
            <Link key={item.key} href={item.href as never} asChild>
              {/*
                * **스타일을 평탄화해서 넘긴다.** `asChild`는 자식 요소를 복제해 자기 props와
                * 합치는데, 그 과정을 거친 스타일이 배열이면 평탄화 없이 DOM까지 내려간다.
                * react-dom은 `for (name in styles) node.style[name] = ...`로 도므로 배열의
                * 키 `"0"`이 들어가고, 거기서 죽는다.
                *
                *   TypeError: Failed to set an indexed property [0] on 'CSSStyleDeclaration'
                *
                * 관리자 사이드바는 로그인한 뒤에만 그려져서, 로그인이 막혀 있던 동안에는
                * 이 자리에 닿은 적이 없었다. 로그인을 고치자 바로 드러났다(2026-09-10).
                * 개발 모드는 같은 것을 말로 알려준다 — 「You are passing an array of styles
                * to a child of <Slot>」.
                */}
              <Pressable style={StyleSheet.flatten([styles.navItem, active && styles.navItemActive])}>
                <Text
                  style={[
                    styles.navLabel,
                    active && styles.navLabelActive,
                    item.readOnly && !active && styles.navLabelReadOnly,
                  ]}
                >
                  {item.label}
                </Text>
                {/*
                  * 조회만 되는 곳은 목록에서 미리 말한다. 들어가 봐야 아는 것을
                  * 열세 곳이나 두면 운영자가 하나씩 눌러 보게 된다.
                  */}
                {item.readOnly && (
                  <Text style={[styles.navChip, active && styles.navChipActive]}>조회만</Text>
                )}
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
      <Pressable
        style={styles.signOut}
        onPress={() => {
          void clearAdminToken().then(() => {
            /* 화면 상태를 되돌리는 가장 단순한 길. 관리자 콘솔은 웹 전용이다. */
            window.location.assign(LOGIN_PATH);
          });
        }}
      >
        <Text style={styles.signOutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

/**
 * 관리자 콘솔의 관문.
 *
 * 2026-09-10까지 이 자리에 아무것도 없었다. `/admin`을 열면 확인 없이 내부 화면으로
 * 들어가고, 서버가 403을 주지만 그 뜻을 말해 줄 자리가 없어 화면에는
 * «잠시 문제가 생겼어요»만 떴다(사용자 보고).
 *
 * **토큰이 있는지만 본다.** 그 토큰이 진짜인지는 서버가 판단한다 — 화면이 판단하면
 * 만료된 토큰을 들고 들어가 모든 화면이 같은 오류를 내게 된다. 서버가 401·403을
 * 주면 `_api`가 토큰을 지우므로, 다음 이동에서 여기로 걸린다.
 */
/**
 * 저장된 관리자 토큰. **화면이 바뀔 때마다 다시 읽는다.**
 *
 * 예전에는 마운트에서 한 번만 읽었다(의존성이 빈 `useEffect`). 그런데 이 레이아웃은
 * 로그인 화면까지 감싸고 있어서, 로그인하는 시점에 이미 마운트가 끝나 있다. 방금
 * 저장한 토큰을 레이아웃은 모른 채 「토큰 없음」으로 굳어 있고 곧바로 로그인으로
 * 되돌렸다 — **로그인할수록 로그인 화면으로 왔다.**
 *
 * 그때는 로그인 쪽을 전체 새로고침으로 바꿔서 막았다. 그것이 지금은 **느림의 원인**
 * 이다. 웹 번들이 한 덩어리로 3.2MB(gzip 0.8MB)라, 새로고침은 그것을 다시 파싱하고
 * 실행한다. 캐시가 있어도 파싱은 다시 한다 — 로그인 직후 몇 초가 거기서 나온다
 * (2026-09-10 대표 「관리자 로딩도 왜 이리 느리냐」).
 *
 * 그래서 미뤄뒀던 쪽을 한다. 경로가 바뀔 때마다 다시 읽으면 `router.replace` 한 번으로
 * 들어가고, 번들을 다시 파싱할 일이 없다.
 *
 * **`checked`는 한 번 참이 되면 그대로 둔다.** 다시 읽을 때마다 거짓으로 되돌리면
 * 화면을 옮길 때마다 빈 화면이 한 번씩 스친다 — 고치려던 것보다 더 자주 깜빡인다.
 */
function useAdminToken(): { token: string | null; checked: boolean } {
  /*
   * **`useSyncExternalStore`로 읽는다.**
   *
   * 그냥 렌더 안에서 `readAdminTokenSync()`를 부르면 안 된다. React Compiler가 그
   * 호출을 순수한 것으로 보고 **값을 기억해 버린다** — 로그인해서 토큰이 생겨도
   * 레이아웃은 계속 `null`을 보고 로그인으로 되돌린다. 실제로 그렇게 막혔다:
   *
   *   layout 렌더 /admin/queue  sync=null  raw=["weddingpick.adminToken.v1"]
   *
   * 저장소에는 있는데 읽은 값만 `null`이다. `useSyncExternalStore`는 그 자리를 위해
   * 있는 것이라 컴파일러도 건너뛰지 않고, 값이 바뀌면 다시 그린다.
   *
   * 서버에서 그리는 동안(정적 내보내기)에는 `null`이다 — 그때는 브라우저가 없다.
   */
  const token = useSyncExternalStore(subscribeAdminToken, readAdminTokenSync, () => null);

  /*
   * 네이티브에는 `localStorage`가 없어 위가 늘 `null`이다. 관리자 콘솔은 웹 전용이라
   * 그 자리에 닿지 않지만, 「없다」와 「아직 모른다」를 가르는 것은 남겨 둔다 —
   * 확인이 끝나기 전에 그리면 로그인한 사람에게도 로그인 화면이 한 번 스친다.
   */
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadAdminToken().then(() => {
      if (!cancelled) setChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { token, checked: token !== null || checked };
}

export default function AdminLayout() {
  const pathname = usePathname();
  const { token, checked } = useAdminToken();

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.notWeb}>
        <Text style={styles.notWebText}>관리자 콘솔은 웹에서만 사용할 수 있어요.</Text>
      </View>
    );
  }

  /* 로그인 화면은 사이드바 없이 홀로 선다 — 아직 들어온 것이 아니다. */
  if (pathname === LOGIN_PATH) return <Slot />;

  /*
   * 확인이 끝나기 전에는 아무것도 그리지 않는다. 저장소를 읽는 것은 한 번의
   * 비동기라, 그 사이에 화면을 그리면 로그인한 사람에게도 로그인 화면이 한 번
   * 스쳤다 사라진다.
   */
  if (!checked) return <View style={styles.root} />;

  if (!token) return <Redirect href={LOGIN_PATH as never} />;

  return (
    <View style={styles.root}>
      <Sidebar pathname={pathname} />
      <View style={styles.main}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.light.backgroundSelected,
    minHeight: '100vh' as unknown as number,
  },
  sidebar: {
    /*
     * 240 — 핸드오프 v3.27이 관리자 콘솔 기준을 1920×1080으로 올리면서 사이드바도
     * 216에서 240으로 넓혔다. 감사 기록처럼 컬럼이 여덟 개인 표가 1440에서는 가로
     * 스크롤 없이 들어가지 않았던 것이 폭을 올린 이유다.
     */
    width: 240,
    /*
     * 사이드바 바탕은 시안의 #17181c다. 잠깐 `Colors.light.text`(#212124)로 바뀌어
     * 있었는데, 하드코딩을 없애려다 **다른 색이 됐다** — 토큰으로 바꾸는 것과
     * 아무 토큰이나 갖다 쓰는 것은 다른 일이다. 시안 값으로 토큰을 새로 만들었다.
     */
    backgroundColor: Colors.light.adminChrome,
    flexShrink: 0,
    flexDirection: 'column',
  },
  sidebarLogo: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
  },
  sidebarTitle: {
    fontSize: FontSize.t6,
    fontWeight: '700',
    color: Colors.light.background,
  },
  sidebarScroll: {
    flex: 1,
  },
  signOut: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#26272c',
  },
  signOutText: {
    fontSize: FontSize.t7,
    color: '#868b94',
  },
  navGroup: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 5,
    fontSize: FontSize.tab,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.light.textStrong,
    textTransform: 'uppercase' as const,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 0,
    borderRadius: 6,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,111,97,0.22)',
  },
  navLabel: {
    flex: 1,
    fontSize: FontSize.t7,
    color: Colors.light.textAssistive,
  },
  navLabelActive: {
    color: Colors.light.background,
    fontWeight: '700',
  },
  /*
   * 조회만 되는 곳은 한 단계 흐리게 둔다. 지우지는 않는다 — 조회는 실제로 되고,
   * 못 쓰는 것처럼 보이면 열어보지 않게 된다.
   *
   * 지금 보고 있는 화면(active)에는 흐림을 걸지 않는다. 선택된 줄은 코랄 위의
   * 흰 글자라, 거기에 흐림까지 얹으면 어느 화면에 있는지가 안 읽힌다.
   */
  navLabelReadOnly: {
    opacity: 0.55,
  },
  navChip: {
    flexShrink: 0,
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: FontSize.tab,
    fontWeight: '700',
    color: Colors.light.cautionary,
    backgroundColor: Colors.light.cautionaryBackground,
  },
  navChipActive: {
    color: Colors.light.background,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  main: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
  },
  notWeb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  notWebText: {
    fontSize: FontSize.t6,
    color: Colors.light.textAssistive,
  },
  errorRoot: {
    flex: 1,
    padding: 32,
    gap: 16,
    backgroundColor: Colors.light.background,
    minHeight: '100vh' as unknown as number,
  },
  errorTitle: {
    fontSize: FontSize.t3,
    lineHeight: LineHeight.t3,
    fontWeight: '700',
    color: Colors.light.negative,
  },
  errorLead: {
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7Loose,
    color: Colors.light.textSecondary,
  },
  errorBox: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.negativeBorder,
    backgroundColor: Colors.light.negativeBackground,
  },
  errorText: {
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7Loose,
    color: Colors.light.negative,
  },
  errorRetry: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
  },
  errorRetryText: {
    fontSize: FontSize.t6,
    fontWeight: '700',
    color: Colors.light.background,
  },
});

/**
 * 관리자 콘솔 전용 오류 경계.
 *
 * expo-router는 라우트 파일이 `ErrorBoundary`를 내보내면 그 구간의 실패를 여기서
 * 받는다. 뿌리 경계(`app/_layout.tsx`)는 «잠시 문제가 생겼어요»만 띄우고 내용을
 * 숨긴다 — 사용자 화면에서는 맞는 판단이다. 스택에는 파일 경로가 들어 있고
 * 사용자가 그걸로 할 수 있는 일이 없다.
 *
 * **관리자에서는 반대다.** 여기서 화면이 죽으면 고칠 사람이 그 화면을 보고 있다.
 * 내용을 숨기면 진단하려고 개발자 도구를 열어야 하는데, 콘솔은 운영자가 폰으로
 * 열 수 있는 것이 아니다(2026-09-10 사용자 보고 — 「폰이라 보기 힘들다」).
 * 그래서 오류 이름 · 메시지 · 스택 앞부분을 화면에 그대로 적는다.
 *
 * 콘솔에도 계속 남긴다. 화면은 지나가지만 로그는 남는다.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  console.error('관리자 화면을 그리다 죽었다.', error);

  /* 스택 전체는 화면을 덮는다. 죽은 자리를 찾는 데는 앞부분이면 된다. */
  const stack = (error.stack ?? '').split('\n').slice(0, 12).join('\n');

  return (
    <View style={styles.errorRoot}>
      <Text style={styles.errorTitle}>화면을 그리다 멈췄어요</Text>
      <Text style={styles.errorLead}>
        아래 내용을 그대로 전달해주세요. 이 글이 어디가 왜 멈췄는지 말해줘요.
      </Text>
      <ScrollView style={styles.errorBox}>
        <Text style={styles.errorText} selectable>
          {error.name}: {error.message}
          {stack ? `\n\n${stack}` : ''}
        </Text>
      </ScrollView>
      <Pressable style={styles.errorRetry} onPress={() => void retry()}>
        <Text style={styles.errorRetryText}>다시 시도</Text>
      </Pressable>
    </View>
  );
}
