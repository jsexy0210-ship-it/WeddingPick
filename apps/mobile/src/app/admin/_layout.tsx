import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminSpacing as A, Colors, FontSize, LineHeight, Radius, Spacing, WeddingMark } from '@weddingpick/ui';

import { clearAdminToken, loadAdminToken, readAdminTokenSync, subscribeAdminToken } from './_session';

/**
 * 관리자 콘솔 좌측 사이드바.
 *
 * 메뉴 이름과 묶음은 `docs/design-handoff/current/ADMIN.md`와 v3.27 시안
 * `html/22-admin-ops.dc.html`의 NAV를 그대로 따른다 — 여섯 묶음(보고 · 데이터 · 사용자 ·
 * 성장 · 운영 · 시스템)이고, 이름은 ADMIN.md의 화면 이름이다. 코드가 따로 부르던
 * 이름(Kill Switch · Policy Engine · Revenue · 롤백 관리)은 md 쪽으로 맞췄다.
 */
type NavEntry = { group: string } | { key: string; label: string; href: string; readOnly?: boolean };

/**
 * **「조회만」은 「이 화면은 지금 조작이 안 된다」는 표시다**(2026-09-10 대표 지시 —
 * 「서버에 없는 동작들 화면에도 목록 디스에이블 처리해」).
 *
 * 화면 안쪽은 이미 잠겨 있다(`BACKEND_PENDING`). 그런데 그것은 **들어가 봐야** 보인다.
 * 메뉴만 보고는 어느 것이 실제로 일을 하는지 알 수 없어서, 운영자는 하나씩 눌러
 * 보고서야 알게 된다.
 *
 * **메뉴를 죽이지는 않는다.** 이 아홉 곳도 조회는 전부 된다 — 목록 · 지표 · 상태가
 * 실제 서버 값으로 나온다. 눌리지 않게 막으면 되는 것까지 못 보게 된다.
 *
 * 서버 동작이 붙으면 그 화면의 `BACKEND_PENDING`과 여기 이름을 **함께** 지운다.
 * 한쪽만 지우면 말이 어긋난다.
 */
const READ_ONLY = new Set([
  'ads',
  'ads-gate',
  'biz-queue',
  'campaigns',
  'data-pipeline',
  'objections',
  'policy-engine',
  'terms',
  'vendors',
]);

/**
 * ADMIN.md 26화면 목록에 아직 없는 라우트. 지우면 기능이 사라지므로 남기되
 * 어느 것이 목록 밖인지 한 곳에 적어 둔다 — `docs/admin-screen-audit.md` 참고.
 */
const OUTSIDE_ADMIN_MD = new Set(['decisions', 'objections', 'pii-reviews', 'og-card']);

const NAV: NavEntry[] = [
  { group: '보고' },
  { key: 'home', label: 'AI 운영현황', href: '/admin/home' },
  { key: 'briefing', label: '일일 브리핑', href: '/admin/briefing' },
  { key: 'decisions', label: '자동 결정 현황', href: '/admin/decisions' },
  { group: '데이터' },
  { key: 'data-pipeline', label: '제보 처리 현황', href: '/admin/data-pipeline' },
  { key: 'queue', label: '확인 필요 목록', href: '/admin/queue' },
  { key: 'price-stats', label: '가격 통계', href: '/admin/price-stats' },
  { key: 'stats', label: '이상치 · 조작 탐지', href: '/admin/stats' },
  { key: 'vendors', label: '업체 관리', href: '/admin/vendors' },
  { key: 'images', label: '이미지 자동 수급', href: '/admin/images' },
  { key: 'email-matching', label: '이메일 회신 자동 매칭', href: '/admin/email-matching' },
  { group: '사용자' },
  { key: 'users', label: '사용자 계정 관리', href: '/admin/users' },
  { key: 'report', label: '고객 의견 · 문의 관리', href: '/admin/report' },
  { key: 'rebuttal', label: '후기 · 반론 관리', href: '/admin/rebuttal' },
  { key: 'biz-queue', label: '업체 문의 처리 목록', href: '/admin/biz-queue' },
  { key: 'objections', label: '후기 이의제기', href: '/admin/objections' },
  { key: 'pii-reviews', label: '개인정보 검토', href: '/admin/pii-reviews' },
  { group: '성장' },
  { key: 'marketing', label: '마케팅 자동화', href: '/admin/marketing' },
  { key: 'campaigns', label: '캠페인 · 보상 관리', href: '/admin/campaigns' },
  { key: 'revenue', label: '수익 현황', href: '/admin/revenue' },
  { key: 'ads', label: '광고 집행 관리', href: '/admin/ads' },
  { key: 'ads-gate', label: '광고 실운영 전환 조건 관리', href: '/admin/ads-gate' },
  { group: '운영' },
  { key: 'automation', label: '자동화 상태', href: '/admin/automation' },
  { key: 'kill-switch', label: '긴급 중지', href: '/admin/kill-switch' },
  { key: 'rollback', label: '변경 복구 관리', href: '/admin/rollback' },
  { group: '시스템' },
  { key: 'faq', label: '자주 묻는 질문 관리', href: '/admin/faq' },
  { key: 'terms', label: '약관 · 방침 관리', href: '/admin/terms' },
  { key: 'og-card', label: '링크 미리보기', href: '/admin/og-card' },
  { key: 'ai-usage', label: 'AI 사용량 · 비용', href: '/admin/ai-usage' },
  /* 이름은 v3.27 시안 것을 쓴다(#172). 관리자 계정은 이 브랜치가 새로 더한 화면이다. */
  { key: 'policy-engine', label: '정책 규칙 관리', href: '/admin/policy-engine' },
  { key: 'audit-log', label: '감사 기록', href: '/admin/audit-log' },
  { key: 'admins', label: '관리자 계정', href: '/admin/admins' },
];

const LOGIN_PATH = '/admin/login';

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarLogo}>
        {/* Pick Mark. spec/tokens.json symbol — 적용처에 관리자 사이드바가 들어 있다. */}
        <WeddingMark size={20} color={Colors.light.tint} />
        <Text style={styles.sidebarTitle}>웨딩픽 관리자</Text>
      </View>
      <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
        {NAV.map((item, i) => {
          if ('group' in item) {
            return (
              <Text key={`g-${i}`} style={styles.navGroup}>
                {item.group}
              </Text>
            );
          }
          const active = pathname.startsWith(item.href);
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
                *
                * 아래 `Text`의 배열은 그대로 둔다 — 복제되는 것은 `Pressable` 하나뿐이다.
                */}
              <Pressable style={StyleSheet.flatten([styles.navItem, active && styles.navItemActive])}>
                <Text
                  style={[
                    styles.navLabel,
                    OUTSIDE_ADMIN_MD.has(item.key) && styles.navLabelOutside,
                    READ_ONLY.has(item.key) && !active && styles.navLabelReadOnly,
                    active && styles.navLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {/*
                  * 조회만 되는 곳은 목록에서 미리 말한다. 들어가 봐야 아는 것을
                  * 아홉 곳이나 두면 운영자가 하나씩 눌러 보게 된다.
                  */}
                {READ_ONLY.has(item.key) && (
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
 * 저장된 관리자 토큰. **바뀌면 곧바로 안다.**
 *
 * 예전에는 마운트에서 한 번만 읽었다. 그런데 이 레이아웃은 로그인 화면까지 감싸고
 * 있어서 로그인하는 시점에 이미 「토큰 없음」으로 굳어 있고, 방금 저장한 토큰을 모른
 * 채 로그인으로 되돌렸다 — **로그인할수록 로그인 화면으로 왔다.**
 *
 * 그때는 로그인 쪽을 전체 새로고침으로 바꿔 덮었다. 그것이 **느림의 원인**이 됐다 —
 * 웹 번들이 한 덩어리로 3.2MB(gzip 0.8MB)라 새로고침이 그것을 다시 파싱한다. 캐시가
 * 있어도 파싱은 다시 하고, 로그인 직후 몇 초가 거기서 나왔다(2026-09-10 대표
 * 「관리자 로딩도 왜 이리 느리냐」).
 *
 * **`useSyncExternalStore`로 읽는다.** 그냥 렌더 안에서 `localStorage`를 읽으면 안
 * 된다 — React Compiler가 그 호출을 순수한 것으로 보고 값을 기억해 버린다. 저장소에는
 * 값이 있는데 읽은 값만 `null`로 얼어붙는다:
 *
 *   layout 렌더 /admin/queue  sync=null  raw=["weddingpick.adminToken.v1"]
 *
 * 걷어낸 뒤 실제 브라우저로 재어 로그인부터 콘솔 진입까지 209ms다.
 */
function useAdminToken(): { token: string | null; checked: boolean } {
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

const C = Colors.light;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: C.backgroundSelected,
    minHeight: '100vh' as unknown as number,
  },
  sidebar: {
    /*
     * 240 — 핸드오프 v3.27이 관리자 콘솔 기준을 1920×1080으로 올리면서 사이드바도
     * 216에서 240으로 넓혔다. 감사 기록처럼 컬럼이 여덟 개인 표가 1440에서는 가로
     * 스크롤 없이 들어가지 않았던 것이 폭을 올린 이유다.
     */
    width: A.sidebarWidth,
    /*
     * 사이드바 바탕은 시안의 #17181c다. 잠깐 `Colors.light.text`(#212124)로 바뀌어
     * 있었는데, 하드코딩을 없애려다 **다른 색이 됐다** — 토큰으로 바꾸는 것과
     * 아무 토큰이나 갖다 쓰는 것은 다른 일이다. 시안 값으로 만든 토큰이 이것이다.
     */
    backgroundColor: C.adminChrome,
    flexShrink: 0,
    flexDirection: 'column',
  },
  sidebarLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
  },
  sidebarTitle: {
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    fontWeight: '700',
    color: C.onTint,
  },
  sidebarScroll: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  signOut: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: C.adminSidebarLine,
  },
  signOutText: {
    fontSize: FontSize.micro,
    lineHeight: LineHeight.micro,
    color: C.adminSidebarLabel,
  },
  navGroup: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.half,
    fontSize: FontSize.adminNavGroup,
    lineHeight: LineHeight.adminNavGroup,
    fontWeight: '700',
    color: C.adminSidebarGroup,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: A.navItemHeight,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.control,
  },
  /* 활성 메뉴는 코랄 — 화면당 네 곳 이하로 쓰는 강조색의 첫 자리다(ADMIN.md 공통 규칙). */
  navItemActive: {
    backgroundColor: C.tint,
  },
  navLabel: {
    flex: 1,
    fontSize: FontSize.micro,
    lineHeight: LineHeight.micro,
    color: C.adminSidebarLabel,
  },
  /* ADMIN.md 목록 밖의 라우트는 한 단 흐리게 — 지운 것이 아니라 아직 목록에 없는 것이다. */
  navLabelOutside: {
    color: C.adminSidebarGroup,
  },
  /*
   * 조회만 되는 곳은 한 단계 흐리게 둔다. 지우지는 않는다 — 조회는 실제로 되고,
   * 못 쓰는 것처럼 보이면 열어보지 않게 된다.
   *
   * 보고 있는 화면(active)에는 흐림을 걸지 않는다. 선택된 줄은 코랄 위의 흰 글자라,
   * 거기에 흐림까지 얹으면 어느 화면에 있는지가 안 읽힌다.
   */
  navLabelReadOnly: {
    opacity: 0.55,
  },
  navChip: {
    flexShrink: 0,
    marginLeft: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.small,
    fontSize: FontSize.tab,
    fontWeight: '700',
    color: C.cautionary,
    backgroundColor: C.cautionaryBackground,
  },
  navChipActive: {
    color: C.onTint,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  navLabelActive: {
    color: C.onTint,
    fontWeight: '700',
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
    padding: Spacing.four,
  },
  notWebText: {
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    color: C.textAssistive,
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
