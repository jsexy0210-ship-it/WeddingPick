import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, SeedIcon, ThemedText, WeddingMark, useTheme } from '@weddingpick/ui';

import { rootTab, type RootTabSpec } from './root-tabs';
import { isRootTabPath } from './root-tab-visibility';

/**
 * Root 탭 바. 탭 구성은 root-tabs.ts, 노출 범위는 docs/design/README.md를 따른다.
 * 상세 화면을 스택 첫 항목으로 직접 열어도 탭 바가 나타나지 않도록 경로로 판정한다.
 *
 * RN 정본 `docs/design/React_Native/pick.js:62 · 250~251`(search.js:157 · note.js:390 같은 값) —
 *   tabBar   높이 72 · 위 1px 선 · padding-top 9 · 5칸 균등(flex:1, 좌우 여백 없음)
 *   tabCell  세로 · 가운데 · gap 3
 *   아이콘   24 · 켜짐 INK(#212124) · 꺼짐 MUTED(#868b94)
 *   라벨     12/16 · 700 · 아이콘과 같은 색
 * Pick 칸도 다른 넷과 같은 모양이다 — 정본에 튀어나온 원이 없다(2026-09-25 common 픽셀 대조로
 * 뺐다). 글리프는 CLAUDE.md 「심볼」의 Pick Mark를 그대로 쓴다(정본은 heart — PR에 적었다).
 */
export function RootTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const pathname = usePathname();
  const bottom = Math.max(insets.bottom, 0);
  const focused = state.routes[state.index];
  if (!isRootTabPath(pathname, focused?.name)) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          height: Layout.tabBar + bottom,
          paddingBottom: bottom,
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
      ]}>
      {state.routes.map((route, index) => {
        const spec = rootTab(route.name);
        const { options } = descriptors[route.key];
        if (!spec) return null;
        const active = state.index === index;
        const color = active ? theme.text : theme.textAssistive;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole={Platform.OS === 'web' ? 'link' : 'button'}
            accessibilityState={active ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? spec.label}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.item}>
            <TabIcon spec={spec} active={active} />
            <ThemedText type="tab" style={[styles.label, { color }]}>
              {spec.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pick은 기존 전용 마크, 나머지는 SEED의 선택/비선택 아이콘을 사용한다. */
function TabIcon({ spec, active }: { spec: RootTabSpec; active: boolean }) {
  const theme = useTheme();

  if (spec.icon === 'pick') {
    return <WeddingMark size={Layout.iconTab} color={active ? theme.text : theme.textAssistive} />;
  }

  return (
    <SeedIcon
      name={active ? spec.icon.on : spec.icon.off}
      size={Layout.iconTab}
      color={active ? theme.text : theme.textAssistive}
    />
  );
}

/* 위 1px 선은 border라 높이 안에 든다 — 아이콘 위치(9)를 맞추려고 padding-top은 그만큼 뺀다. */
const BAR_PADDING_TOP = 9 - Border.hairline;
const CELL_GAP = 3;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: BAR_PADDING_TOP,
    borderTopWidth: Border.hairline,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: CELL_GAP,
  },
  label: { textAlign: 'center' },
});
