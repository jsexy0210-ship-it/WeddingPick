import { Link, Slot, usePathname } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight, Radius, Spacing, WeddingMark } from '@weddingpick/ui';

/**
 * 관리자 콘솔 좌측 사이드바.
 *
 * 메뉴 이름과 묶음은 `docs/design-handoff/current/ADMIN.md`와 v3.27 시안
 * `html/22-admin-ops.dc.html`의 NAV를 그대로 따른다 — 여섯 묶음(보고 · 데이터 · 사용자 ·
 * 성장 · 운영 · 시스템)이고, 이름은 ADMIN.md의 화면 이름이다. 코드가 따로 부르던
 * 이름(Kill Switch · Policy Engine · Revenue · 롤백 관리)은 md 쪽으로 맞췄다.
 */
type NavEntry = { group: string } | { key: string; label: string; href: string };

const NAV: NavEntry[] = [
  { group: '보고' },
  { key: 'home', label: 'AI 운영현황', href: '/admin/home' },
  { key: 'briefing', label: '일일 브리핑', href: '/admin/briefing' },
  /* 아래 셋은 ADMIN.md 26화면 목록에 아직 없다 — docs/admin-screen-audit.md 참고. */
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
  { key: 'ads-gate', label: '광고 실운영 전환 게이트', href: '/admin/ads-gate' },
  { group: '운영' },
  { key: 'automation', label: '자동화 상태', href: '/admin/automation' },
  { key: 'kill-switch', label: '긴급 중지', href: '/admin/kill-switch' },
  { key: 'rollback', label: '변경 복구 관리', href: '/admin/rollback' },
  { group: '시스템' },
  { key: 'faq', label: '자주 묻는 질문 관리', href: '/admin/faq' },
  { key: 'terms', label: '약관 · 방침 관리', href: '/admin/terms' },
  { key: 'ai-usage', label: 'AI 사용량 · 비용', href: '/admin/ai-usage' },
  { key: 'policy-engine', label: '정책 규칙 관리', href: '/admin/policy-engine' },
  { key: 'audit-log', label: '감사 기록', href: '/admin/audit-log' },
];

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
              <Pressable style={[styles.navItem, active && styles.navItemActive]}>
                <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AdminLayout() {
  const pathname = usePathname();

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.notWeb}>
        <Text style={styles.notWebText}>관리자 콘솔은 웹에서만 사용할 수 있어요.</Text>
      </View>
    );
  }

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
    width: 240,
    backgroundColor: C.adminSidebar,
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
    height: 34,
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
});
