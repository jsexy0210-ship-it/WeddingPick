import { Link, Slot, usePathname } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';

const NAV_GROUPS: { group?: string; key?: string; label?: string; href?: string }[] = [
  { group: '검토해요' },
  { key: 'queue', label: '확인 필요 큐', href: '/admin/queue' },
  { key: 'rebuttal', label: '후기 · 반론', href: '/admin/rebuttal' },
  { group: '지표를 봐요' },
  { key: 'stats', label: '이상치 · 조작 탐지', href: '/admin/stats' },
  { group: '사용자' },
  { key: 'report', label: 'VOC', href: '/admin/report' },
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
    width: 216,
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
