import { Link, Redirect, Slot, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AdminSpacing as A, Colors, FontSize, LineHeight, Radius, Spacing, WeddingMark } from '@weddingpick/ui';

import { apiFetch } from './_api';
import { AdminRoleProvider, AdminRoleSettledProvider, useAdminRole, type AdminRole } from './_role';
import { loadAdminToken, readAdminTokenSync, subscribeAdminToken } from './_session';

/**
 * 관리자 콘솔 좌측 사이드바.
 *
 * **2026-09-15에 다시 짜였다**(대표 확정, 두 단계). 2026-09-11판은 시안의 여섯
 * 묶음(보고 · 데이터 · 사용자 · 성장 · 운영 · 시스템) 대신 **지금 쓸 수 있는
 * 화면인지**(운영 · 조회 · 서버 연결 전)로 갈랐는데, 「운영」 한 묶음에 19개가
 * 몰렸다. 처음엔 아홉 주제 묶음(그룹 헤더 + 그 아래 여러 줄)으로 다시 짰는데,
 * 대표님이 「비슷한 유형끼리 탭 메뉴로 구성해도 된다」고 한 번 더 넓히면서
 * **그룹 하나 = 사이드바 줄 하나 + 그 화면 안의 탭**으로 바뀌었다. 웨딩피드는
 * 현재 사용자 홈에 바로 나가는 콘텐츠라 별도 줄로 다시 올렸다. 그래서 지금
 * 사이드바는 **열 줄이다** —
 *
 *   대시보드 · 앱 회원 · 관리자 계정 · 웨딩피드 콘텐츠 · 확인 필요 · 업체·행사 ·
 *   후기·신고 · 광고·보상 · 자동화 · 통계·분석 · 사이트·기록
 *
 * 옛 화면 34개(로그인 제외 33개)는 사라지지 않았다 — 각 그룹의 대표 화면 파일이
 * `AdminTabShell`로 나머지를 탭으로 불러 그린다(예: `automation.tsx`가 「자동화」
 * 화면이고 그 안에 처리 상태 · 처리 내역 · 정책 규칙 · 긴급 중지 · 변경 복구 다섯
 * 탭을 그린다). **탭은 껍데기다** — 화면 컴포넌트는 원래 파일에 그대로 두고 이름만
 * `XxxPanel`로 바꿔 가져다 쓴다. PR 본문의 주소 매핑표에 옛 주소 34개가 지금 어느
 * 화면·탭인지 전부 적혀 있다 — 저장된 링크는 각 옛 파일의 `Redirect`가 받는다.
 *
 * **박람회 관리 · 웨딩피드 관리 둘은 2026-09-15에 뒤늦게 합류했다.** 이 재편이
 * 시작된 뒤 다른 두 세션이 각자 `/admin/expos`(PR #254) · `/admin/wedding-feed`를
 * `main`에 올렸다 — 처음 32개(31개 + 로그인) 셀 때는 없던 화면이라 뒤따라 자리를
 * 정했다(박람회는 「업체·행사」, 웨딩피드는 「사이트·기록」).
 *
 * **「지금 쓸 수 있는 화면인지」 표시는 버리지 않았다.** 「서버 연결 전」 그룹이
 * 없어진 자리는 각 `AdminTabShell`의 `AdminTabDef.readOnly`가 대신한다 — 그 탭에만
 * 「조회만」 딱지가 붙는다(`_ui.tsx`의 `AdminTabShell` 주석 참고). **2026-09-16에
 * 약관·방침이 그 목록에서 빠져 넷이 됐다** — 편집·공개가 열렸다(0422).
 *
 * **사이드바 이름과 화면 이름은 다를 수 있다.** 240 폭에서 긴 이름은 잘리고, 잘린
 * 이름은 어느 화면인지 말해주지 못한다.
 */
type NavEntry = { key: string; label: string; href: string };

/**
 * **열 줄.** 기존 아홉 그룹에 현재 사용자 홈과 직접 연결되는 웨딩피드 콘텐츠를
 * 독립 메뉴로 올렸다. 계정 메뉴는 2026-09-24 요청대로 대시보드 바로 아래에 둔다.
 * 각 `href`는 그 그룹의 **대표 화면**(첫 탭)이고, 나머지는 그 화면
 * 안의 탭이다 — 예를 들어 「자동화」를 누르면 `/admin/automation`이 열리고
 * 안에서 처리 상태 탭이 기본으로 선택된다.
 *
 * 박람회 관리는 `vendors.tsx`의 탭에 남고, 웨딩피드 관리는 현재 프론트 콘텐츠와
 * 바로 대응하도록 독립 메뉴가 됐다.
 */
const NAV: NavEntry[] = [
  { key: 'home', label: '대시보드', href: '/admin/home' },
  { key: 'users', label: '앱 회원 · 관리자 계정', href: '/admin/users' },
  { key: 'wedding-feed', label: '웨딩피드 콘텐츠', href: '/admin/wedding-feed' },
  { key: 'queue', label: '확인 필요', href: '/admin/queue' },
  { key: 'vendors', label: '업체·행사', href: '/admin/vendors' },
  { key: 'rebuttal', label: '후기·신고', href: '/admin/rebuttal' },
  { key: 'ads', label: '광고·보상', href: '/admin/ads' },
  { key: 'automation', label: '자동화', href: '/admin/automation' },
  { key: 'stats', label: '통계·분석', href: '/admin/stats' },
  { key: 'faq', label: '사이트·기록', href: '/admin/faq' },
];

const LOGIN_PATH = '/admin/login';
const COMPACT_WIDTH = 900;

/** 사이드바 맨 위 이름 — 문서 제목의 뒤쪽에도 같은 이름을 쓴다. */
const CONSOLE_NAME = '웨딩픽 관리자';

/**
 * 뷰어에게 보이는 줄 이름(2026-09-25 대표 지시 — 「뷰어에게 관리자 계정 목록은 열지
 * 마」 · 「메뉴에서도 빼」). 뷰어의 계정·권한 화면에는 관리자 계정 탭이 없으므로
 * (`users.tsx` `UsersShell`) 줄 이름에서도 뺀다. 슈퍼 · 운영자는 그대로다.
 *
 * 목록을 막는 것은 여전히 서버다 — `GET /v1/admin/accounts`는 슈퍼 전용이다
 * (`apps/api/src/routes/admin-accounts.ts` `requireSuperAdmin`).
 */
const VIEWER_LABEL: Partial<Record<string, string>> = { users: '앱 회원' };

/** 그 등급이 사이드바에서 읽는 줄 이름. 등급을 아직 모르면 기본 이름이다. */
function adminNavLabel(item: NavEntry, role: AdminRole | null): string {
  return (role === 'viewer' && VIEWER_LABEL[item.key]) || item.label;
}

/**
 * 브라우저 탭 · 방문 기록 · 스크린리더가 읽는 문서 제목(2026-09-26 감사 8b).
 *
 * 전에는 관리자 화면이 문서 제목을 비워 두었다 — 정적 껍데기(`+html.tsx`)의 공유용
 * 제목이 들어 있다가, 앱이 뜨면 expo-router가 라우트 옵션의 빈 제목으로 덮어썼다.
 * 이름은 새로 짓지 않고 **사이드바에 이미 적힌 메뉴 이름**을 쓴다 — 같은 화면을 두
 * 이름으로 부르지 않는다(CLAUDE.md). 메뉴에 없는 주소는 콘솔 이름만 둔다.
 *
 * 등급도 받는다 — 뷰어의 사이드바가 「앱 회원」이면 문서 제목도 「앱 회원」이다.
 */
export function adminDocumentTitle(pathname: string, role: AdminRole | null = null): string {
  const entry = NAV.find((item) => pathname.startsWith(item.href));
  return entry ? `${adminNavLabel(entry, role)} — ${CONSOLE_NAME}` : CONSOLE_NAME;
}

export function Sidebar({ pathname, compact }: { pathname: string; compact: boolean }) {
  const role = useAdminRole();
  return (
    <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
      <View style={[styles.sidebarLogo, compact && styles.sidebarLogoCompact]}>
        {/* Pick Mark. spec/tokens.json symbol — 적용처에 관리자 사이드바가 들어 있다. */}
        <WeddingMark size={20} color={Colors.light.tint} />
        <Text style={styles.sidebarTitle}>{CONSOLE_NAME}</Text>
      </View>
      <ScrollView
        horizontal={compact}
        style={[styles.sidebarScroll, compact && styles.sidebarScrollCompact]}
        contentContainerStyle={[styles.sidebarScrollContent, compact && styles.sidebarScrollContentCompact]}
        showsHorizontalScrollIndicator={compact}
        showsVerticalScrollIndicator={!compact}
      >
        {NAV.map((item) => {
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
              <Pressable style={StyleSheet.flatten([styles.navItem, compact && styles.navItemCompact, active && styles.navItemActive])}>
                <Text
                  style={[styles.navLabel, compact && styles.navLabelCompact, active && styles.navLabelActive]}
                  numberOfLines={1}
                >
                  {adminNavLabel(item, role)}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
      {/*
        로그아웃은 2026-09-15에 여기(사이드바 맨 아래)에서 상단 바 우측 고정
        영역(`_ui.tsx`의 `Page`)으로 옮겨갔다 — 대표 지시. 이 자리는 비워 둔다,
        메뉴 영역에 별도 동작을 채우지 않는다.
      */}
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

/**
 * 로그인한 관리자의 등급. 토큰이 바뀔 때마다 다시 읽는다 — 다른 계정으로 다시
 * 로그인하면 등급도 바뀐다. 읽기에 실패하면 `null`(모름)로 두고 화면은 평소대로
 * 그린다. 쓰기를 막는 것은 서버다(`_role.tsx`).
 *
 * `settled`는 그 토큰으로 읽기가 끝났는가(성공 · 실패 모두)다 — 「읽는 중」과
 * 「모름」을 가르는 자리가 하나 필요하다(`_role.tsx` `useAdminRoleSettled`).
 */
function useAdminRoleFetch(token: string | null): { role: AdminRole | null; settled: boolean } {
  const [result, setResult] = useState<{ token: string; role: AdminRole | null } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch('/v1/admin/me')
      .then((body) => {
        if (cancelled) return;
        const value = (body as { role?: unknown } | null)?.role;
        const role = value === 'super' || value === 'operator' || value === 'viewer' ? value : null;
        setResult({ token, role });
      })
      .catch(() => {
        /* 모르면 모르는 채로 둔다 — 다만 읽기는 끝났다. */
        if (!cancelled) setResult({ token, role: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const current = result && result.token === token ? result : null;
  return { role: current?.role ?? null, settled: current !== null };
}

export default function AdminLayout() {
  const pathname = usePathname();
  const { token, checked } = useAdminToken();
  const { role, settled } = useAdminRoleFetch(pathname === LOGIN_PATH ? null : token);
  const { width, height } = useWindowDimensions();
  const compact = width < COMPACT_WIDTH;

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.notWeb}>
        <Text style={styles.notWebText}>관리자 콘솔은 웹에서만 사용할 수 있어요.</Text>
      </View>
    );
  }

  /* 로그인한 사람이 로그인 주소를 다시 열어도 기본 화면인 대시보드로 돌아간다. */
  if (pathname === LOGIN_PATH) {
    if (!checked) return <View style={styles.root} />;

    return token ? <Redirect href={'/admin/home' as never} /> : <Slot />;
  }

  /*
   * 확인이 끝나기 전에는 아무것도 그리지 않는다. 저장소를 읽는 것은 한 번의
   * 비동기라, 그 사이에 화면을 그리면 로그인한 사람에게도 로그인 화면이 한 번
   * 스쳤다 사라진다.
   */
  if (!checked) return <View style={styles.root} />;

  if (!token) return <Redirect href={LOGIN_PATH as never} />;

  return (
    <AdminRoleProvider value={role}>
      <AdminRoleSettledProvider value={settled}>
        <Head>
          <title>{adminDocumentTitle(pathname, role)}</title>
        </Head>
        <View style={[styles.root, compact && styles.rootCompact, compact && { height }]}>
          <Sidebar pathname={pathname} compact={compact} />
          <View style={[styles.main, compact && styles.mainCompact]}>
            {/*
              * 뷰어는 모든 메뉴를 열어 보되 바꾸지는 못한다(2026-09-25 대표 지시). 단추가
              * 왜 흐린지를 화면마다 적지 않고 여기 한 줄로 알린다.
              */}
            {role === 'viewer' ? (
              <View style={styles.viewerNotice}>
                <Text style={styles.viewerNoticeText} numberOfLines={1}>
                  조회 전용 계정이에요. 등록 · 수정 · 삭제 단추는 잠겨 있어요.
                </Text>
              </View>
            ) : null}
            <Slot />
          </View>
        </View>
      </AdminRoleSettledProvider>
    </AdminRoleProvider>
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
  rootCompact: { flexDirection: 'column' },
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
  sidebarCompact: { width: '100%', paddingVertical: Spacing.one, paddingHorizontal: Spacing.one },
  sidebarLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    /* 시안 brandRow «padding:0 12px 18px;gap:9px». 좌우는 사이드바 패딩 안쪽으로 한 겹 더. */
    gap: A.iconTextGap,
    paddingHorizontal: A.btnPaddingX,
    paddingBottom: A.brandPaddingBottom,
  },
  sidebarLogoCompact: { paddingBottom: Spacing.one },
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
  sidebarScrollCompact: { flex: 0, width: '100%', height: A.navItemHeight },
  /* 시안 side «gap:3px» — 메뉴 사이. */
  sidebarScrollContent: {
    gap: A.stackGap,
  },
  sidebarScrollContentCompact: { flexDirection: 'row', alignItems: 'center' },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: A.navItemHeight,
    /* 시안 «height:34px;padding:0 12px;border-radius:6px». */
    paddingHorizontal: A.btnPaddingX,
    borderRadius: Radius.control,
  },
  navItemCompact: { flexShrink: 0 },
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
  navLabelCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  navLabelActive: {
    color: C.onTint,
    fontWeight: '700',
  },
  main: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
  },
  mainCompact: { width: '100%', minHeight: 0 },
  /* `features/admin/pending-backend`의 안내와 같은 칠 — 「지금 조작이 안 된다」를 말하는 같은 자리다. */
  viewerNotice: {
    backgroundColor: C.cautionaryBackground,
    paddingVertical: Spacing.two,
    paddingHorizontal: A.bodyPaddingX,
  },
  viewerNoticeText: {
    color: C.cautionary,
    fontSize: FontSize.micro,
    lineHeight: LineHeight.micro,
    fontWeight: '600',
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
