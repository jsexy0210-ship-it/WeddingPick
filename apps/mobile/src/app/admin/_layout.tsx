import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminSpacing as A, Colors, FontSize, LineHeight, Radius, Spacing, WeddingMark } from '@weddingpick/ui';

import { clearAdminToken, loadAdminToken } from './_session';

/**
 * 관리자 콘솔 좌측 사이드바.
 *
 * 묶음도 이름도 v3.27 시안 `html/22-admin-ops.dc.html`의 `NAV`를 그대로 따른다 —
 * 여섯 묶음(보고 · 데이터 · 사용자 · 성장 · 운영 · 시스템)이다.
 *
 * **사이드바 이름과 화면 이름은 다르다.** 시안이 그렇게 그린다 — WP-ADM-013은
 * 상단바 제목이 「이상치 · 조작 탐지」이고 사이드바는 「이상치 탐지」다. ADMIN.md의
 * 긴 화면 이름을 사이드바에 그대로 넣으면 240 폭에서 잘려 「광고 실운영 전환 조건…」이
 * 된다. 잘린 이름은 어느 화면인지 말해주지 못한다.
 *
 * SPEC 본문과 목업이 어긋나면 목업이 이긴다(CLAUDE.md) — 여기서는 목업 쪽이다.
 */
type NavEntry = { group: string } | { key: string; label: string; href: string };

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
  { key: 'data-pipeline', label: '제보 처리', href: '/admin/data-pipeline' },
  { key: 'queue', label: '확인 필요', href: '/admin/queue' },
  { key: 'price-stats', label: '가격 통계', href: '/admin/price-stats' },
  { key: 'stats', label: '이상치 탐지', href: '/admin/stats' },
  { key: 'vendors', label: '업체 관리', href: '/admin/vendors' },
  { key: 'images', label: '이미지 수급', href: '/admin/images' },
  { key: 'email-matching', label: '이메일 매칭', href: '/admin/email-matching' },
  { group: '사용자' },
  { key: 'users', label: '계정 관리', href: '/admin/users' },
  { key: 'report', label: '고객 문의', href: '/admin/report' },
  { key: 'rebuttal', label: '후기 · 반론', href: '/admin/rebuttal' },
  { key: 'biz-queue', label: '업체 문의', href: '/admin/biz-queue' },
  { key: 'objections', label: '후기 이의제기', href: '/admin/objections' },
  { key: 'pii-reviews', label: '개인정보 검토', href: '/admin/pii-reviews' },
  { group: '성장' },
  { key: 'marketing', label: '마케팅 자동화', href: '/admin/marketing' },
  { key: 'campaigns', label: '캠페인 · 보상', href: '/admin/campaigns' },
  { key: 'revenue', label: '수익 현황', href: '/admin/revenue' },
  { key: 'ads', label: '광고 집행', href: '/admin/ads' },
  { key: 'ads-gate', label: '광고 전환 게이트', href: '/admin/ads-gate' },
  { group: '운영' },
  { key: 'automation', label: '자동화 상태', href: '/admin/automation' },
  { key: 'kill-switch', label: '긴급 중지', href: '/admin/kill-switch' },
  { key: 'rollback', label: '변경 복구', href: '/admin/rollback' },
  { group: '시스템' },
  { key: 'faq', label: 'FAQ 관리', href: '/admin/faq' },
  { key: 'terms', label: '약관 · 방침', href: '/admin/terms' },
  { key: 'og-card', label: '링크 미리보기', href: '/admin/og-card' },
  { key: 'ai-usage', label: 'AI 비용', href: '/admin/ai-usage' },
  /* 이름은 v3.27 시안 것을 쓴다(#172). 관리자 계정은 이 브랜치가 새로 더한 화면이다. */
  { key: 'policy-engine', label: '정책 규칙', href: '/admin/policy-engine' },
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
      <ScrollView
        style={styles.sidebarScroll}
        contentContainerStyle={styles.sidebarScrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                    active && styles.navLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
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
function useAdminToken(): { token: string | null; checked: boolean } {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadAdminToken().then((value) => {
      if (cancelled) return;
      setToken(value);
      setChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { token, checked };
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
    /* 시안 side «padding:20px 12px». 메뉴 자체의 좌우 12와 합쳐 글자가 24에서 시작한다. */
    paddingVertical: A.sidebarPaddingY,
    paddingHorizontal: A.sidebarPaddingX,
  },
  sidebarLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    /* 시안 brandRow «padding:0 12px 18px;gap:9px». 좌우는 사이드바 패딩 안쪽으로 한 겹 더. */
    gap: A.iconTextGap,
    paddingHorizontal: A.btnPaddingX,
    paddingBottom: A.brandPaddingBottom,
  },
  sidebarTitle: {
    /* 시안 brandName «font-size:15px». 본문 sub(16)이 아니다. */
    fontSize: FontSize.adminBanner,
    lineHeight: LineHeight.adminBanner,
    fontWeight: '700',
    color: C.onTint,
  },
  sidebarScroll: {
    flex: 1,
  },
  /* 시안 side «gap:3px» — 메뉴 사이. */
  sidebarScrollContent: {
    gap: A.stackGap,
  },
  signOut: {
    paddingHorizontal: A.btnPaddingX,
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
    /* 시안 navGroup «padding:16px 12px 6px». */
    paddingHorizontal: A.btnPaddingX,
    paddingTop: Spacing.three,
    paddingBottom: A.navGroupPaddingBottom,
    fontSize: FontSize.adminNavGroup,
    lineHeight: LineHeight.adminNavGroup,
    fontWeight: '700',
    color: C.adminSidebarGroup,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: A.navItemHeight,
    /* 시안 «height:34px;padding:0 12px;border-radius:6px». */
    paddingHorizontal: A.btnPaddingX,
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
