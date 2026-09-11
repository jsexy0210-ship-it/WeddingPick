import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminSpacing as A, Colors, FontSize, LineHeight, Radius, Spacing, WeddingMark } from '@weddingpick/ui';

import { clearAdminToken, loadAdminToken, readAdminTokenSync, subscribeAdminToken } from './_session';

/**
 * 관리자 콘솔 좌측 사이드바.
 *
 * **묶음이 2026-09-11에 다시 짜였다**(대표 지시). 예전에는 시안 `22-admin-ops.dc.html`의
 * 여섯 묶음(보고 · 데이터 · 사용자 · 성장 · 운영 · 시스템)을 그대로 따랐는데, 그것은
 * **무엇에 관한 화면인지**로 가른 것이라 **지금 쓸 수 있는 화면인지**를 말해주지 못했다.
 * 운영자는 동작하는 메뉴와 껍데기만 있는 메뉴를 하나씩 눌러 보고서야 구분했다.
 *
 * 그래서 순서를 이렇게 정했다.
 *
 *   1. 대시보드      한 화면에서 상태를 먼저 본다
 *   2. 운영          운영자가 값을 바꿀 수 있고 그것이 실제로 저장되는 화면
 *   3. 조회          보기만 되는 화면 — 그것이 그 화면의 목적이라 고장이 아니다
 *   4. 서버 연결 전  확인 불가 · 동작 불가 — 한 묶음으로 맨 아래
 *
 * **4번을 「기타」로 부르지 않는다.** 이름이 상태를 감추면 최하단으로 내린 뜻이 사라진다.
 *
 * 어느 화면이 어느 묶음인지는 전수 조사로 갈랐다 — 부르는 경로 · 서버에 그 경로가
 * 있는지 · 그 핸들러가 실제로 DB를 건드리는지. 근거는 `docs/admin-screen-inventory.md`에
 * 화면마다 한 줄로 적혀 있다.
 *
 * **메뉴를 지우지 않는다.** 4번의 화면도 조회는 되는 곳이 있어서, 눌리지 않게 막으면
 * 되는 것까지 못 보게 된다(2026-09-10 대표 지시).
 *
 * **사이드바 이름과 화면 이름은 다를 수 있다.** 240 폭에서 긴 이름은 잘리고, 잘린
 * 이름은 어느 화면인지 말해주지 못한다.
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
 * **메뉴를 죽이지는 않는다.** 여기 적힌 곳도 조회는 전부 된다 — 목록 · 지표 · 상태가
 * 실제 서버 값으로 나온다(`revenue`는 예외다. 서버가 0을 고정으로 준다). 눌리지 않게
 * 막으면 되는 것까지 못 보게 된다.
 *
 * **둘에서 다섯으로 늘었다**(2026-09-11 전수 조사). 나머지 셋은 잠긴 화면이었는데
 * 사이드바에 표시가 없었다 —
 *
 *   email-matching  회신을 담는 표가 DB에 없어 수신함이 늘 비어 있다
 *   revenue         구독 · 결제 표가 없어 서버가 0을 고정으로 돌려준다
 *   price-stats     목록은 실제 값이지만 「재계산」이 아무것도 하지 않는다
 *
 * 서버 동작이 붙으면 그 화면의 `BACKEND_PENDING`과 여기 이름을 **함께** 지운다.
 * 한쪽만 지우면 말이 어긋난다 — `test/admin-read-only-pairing.test.ts`가 그것을 잡는다.
 */
const READ_ONLY = new Set(['biz-queue', 'email-matching', 'price-stats', 'revenue', 'terms']);

/**
 * ADMIN.md 26화면 목록에 아직 없는 라우트. 지우면 기능이 사라지므로 남기되
 * 어느 것이 목록 밖인지 한 곳에 적어 둔다 — `docs/admin-screen-audit.md` 참고.
 */
const OUTSIDE_ADMIN_MD = new Set(['decisions', 'objections', 'pii-reviews', 'og-card']);

/**
 * **2번 묶음의 순서는 운영자가 자주 여는 순이다.** 시안의 계열 순서가 아니다.
 *
 * 기준은 「그 일이 얼마나 자주 들어오는가」다. 제보 심사와 업체 정리는 매일 들어오고,
 * 관리자 계정과 정책 규칙은 한 달에 한 번도 열지 않는다. 자주 여는 것을 아래에 두면
 * 매일 스크롤을 내리게 된다.
 *
 * 이 순서는 내 판단이다 — 실제 사용 기록으로 확인한 것이 아니다. 대표님이 다르게
 * 보시면 여기 배열 순서만 고치면 된다.
 */
const NAV: NavEntry[] = [
  { group: '대시보드' },
  { key: 'home', label: '대시보드', href: '/admin/home' },

  { group: '운영' },
  /* 매일 — 제보 심사 · 제보 처리 · 업체 · 이미지 */
  { key: 'queue', label: '확인 필요', href: '/admin/queue' },
  { key: 'data-pipeline', label: '제보 처리', href: '/admin/data-pipeline' },
  { key: 'vendors', label: '업체 관리', href: '/admin/vendors' },
  { key: 'images', label: '이미지 관리', href: '/admin/images' },
  /* 들어올 때마다 — 후기 · 이의제기 · 개인정보 · 계정 */
  { key: 'rebuttal', label: '후기 · 반론', href: '/admin/rebuttal' },
  { key: 'objections', label: '후기 이의제기', href: '/admin/objections' },
  { key: 'pii-reviews', label: '개인정보 검토', href: '/admin/pii-reviews' },
  { key: 'users', label: '계정 관리', href: '/admin/users' },
  /* 문구 · 카드 — 자주 손대지만 급하지 않다 */
  { key: 'faq', label: 'FAQ 관리', href: '/admin/faq' },
  { key: 'og-card', label: '링크 미리보기', href: '/admin/og-card' },
  /* 성장 — 회차마다 */
  { key: 'campaigns', label: '캠페인 · 보상', href: '/admin/campaigns' },
  { key: 'marketing', label: '마케팅 발송', href: '/admin/marketing' },
  { key: 'ads', label: '광고 집행', href: '/admin/ads' },
  { key: 'ads-gate', label: '광고 전환 승인', href: '/admin/ads-gate' },
  /* 손댈 일이 없어야 정상인 것들. 필요할 때 바로 찾을 수 있게 붙여 둔다 */
  { key: 'automation', label: '처리 상태', href: '/admin/automation' },
  { key: 'kill-switch', label: '긴급 중지', href: '/admin/kill-switch' },
  { key: 'rollback', label: '변경 복구', href: '/admin/rollback' },
  { key: 'policy-engine', label: '정책 규칙', href: '/admin/policy-engine' },
  { key: 'admins', label: '관리자 계정', href: '/admin/admins' },

  { group: '조회' },
  { key: 'briefing', label: '일일 브리핑', href: '/admin/briefing' },
  { key: 'decisions', label: '자동 처리 내역', href: '/admin/decisions' },
  { key: 'report', label: '신고 접수', href: '/admin/report' },
  { key: 'stats', label: '이상 거래', href: '/admin/stats' },
  { key: 'price-stats', label: '가격 통계', href: '/admin/price-stats' },
  { key: 'ai-usage', label: '분석 비용', href: '/admin/ai-usage' },
  { key: 'audit-log', label: '감사 기록', href: '/admin/audit-log' },

  /*
   * 확인 불가 · 동작 불가 · 안 쓰는 메뉴. **왜 여기 있는지는 화면마다 다르다** —
   * 근거는 `docs/admin-screen-inventory.md`에 한 줄로 적혀 있다.
   */
  { group: '서버 연결 전' },
  { key: 'biz-queue', label: '업체 문의', href: '/admin/biz-queue' },
  { key: 'email-matching', label: '이메일 회신', href: '/admin/email-matching' },
  { key: 'revenue', label: '수익 현황', href: '/admin/revenue' },
  { key: 'terms', label: '약관 · 방침', href: '/admin/terms' },
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
