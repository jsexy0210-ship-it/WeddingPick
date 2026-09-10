import { Link, Slot, usePathname } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';

const NAV_GROUPS: { group?: string; key?: string; label?: string; href?: string }[] = [
  { group: '대시보드' },
  { key: 'home', label: '관리자 홈', href: '/admin/home' },
  { key: 'briefing', label: '일일 브리핑', href: '/admin/briefing' },
  { key: 'decisions', label: '자동 결정 현황', href: '/admin/decisions' },
  { group: '검토해요' },
  { key: 'queue', label: '확인 필요 큐', href: '/admin/queue' },
  { key: 'rebuttal', label: '후기 · 반론', href: '/admin/rebuttal' },
  { key: 'objections', label: '후기 이의제기', href: '/admin/objections' },
  { key: 'pii-reviews', label: '개인정보 검토', href: '/admin/pii-reviews' },
  { group: '데이터' },
  { key: 'data-pipeline', label: '제보 처리 현황', href: '/admin/data-pipeline' },
  { key: 'price-stats', label: '가격 통계', href: '/admin/price-stats' },
  { key: 'vendors', label: '업체 관리', href: '/admin/vendors' },
  { key: 'images', label: '이미지 자동수급', href: '/admin/images' },
  { key: 'email-matching', label: '이메일 자동매칭', href: '/admin/email-matching' },
  { group: '지표를 봐요' },
  { key: 'stats', label: '이상치 · 조작 탐지', href: '/admin/stats' },
  { group: '사용자' },
  { key: 'users', label: '계정 관리', href: '/admin/users' },
  { key: 'biz-queue', label: '업체 문의 큐', href: '/admin/biz-queue' },
  { key: 'report', label: 'VOC', href: '/admin/report' },
  { group: '성장 · 광고' },
  { key: 'marketing', label: '마케팅 자동화', href: '/admin/marketing' },
  { key: 'campaigns', label: '캠페인 · 보상', href: '/admin/campaigns' },
  { key: 'revenue', label: 'Revenue', href: '/admin/revenue' },
  { key: 'ads', label: '광고 집행 관리', href: '/admin/ads' },
  { key: 'ads-gate', label: '광고 실운영 게이트', href: '/admin/ads-gate' },
  { group: '콘텐츠' },
  { key: 'faq', label: 'FAQ 관리', href: '/admin/faq' },
  { key: 'terms', label: '약관 · 방침', href: '/admin/terms' },
  { key: 'og-card', label: '링크 미리보기', href: '/admin/og-card' },
  { group: '운영' },
  { key: 'automation', label: '자동화 상태', href: '/admin/automation' },
  { key: 'kill-switch', label: 'Kill Switch', href: '/admin/kill-switch' },
  { key: 'rollback', label: '롤백 관리', href: '/admin/rollback' },
  { group: '시스템' },
  { key: 'ai-usage', label: 'AI 사용량 · 비용', href: '/admin/ai-usage' },
  { key: 'policy-engine', label: 'Policy Engine', href: '/admin/policy-engine' },
  { key: 'audit-log', label: '감사 로그', href: '/admin/audit-log' },
];

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
              <Pressable style={[styles.navItem, active && styles.navItemActive]}>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f2f3f6',
    minHeight: '100vh' as unknown as number,
  },
  sidebar: {
    /*
     * 240 — 핸드오프 v3.27이 관리자 콘솔 기준을 1920×1080으로 올리면서 사이드바도
     * 216에서 240으로 넓혔다. 감사 기록처럼 컬럼이 여덟 개인 표가 1440에서는 가로
     * 스크롤 없이 들어가지 않았던 것이 폭을 올린 이유다.
     */
    width: 240,
    backgroundColor: '#17181c',
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
    color: '#fff',
  },
  sidebarScroll: {
    flex: 1,
  },
  navGroup: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 5,
    fontSize: FontSize.tab,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#393a40',
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
    color: '#868b94',
  },
  navLabelActive: {
    color: '#fff',
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
    padding: 24,
  },
  notWebText: {
    fontSize: FontSize.t6,
    color: '#868b94',
  },
});
