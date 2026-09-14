import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  Layout,
  ProductSymbol,
  ThemedText,
  WeddingMark,
  useTheme,
  type ProductSymbolName,
} from '@weddingpick/ui';

/**
 * Root 탭 바 — 05-root 시안 1:1 · spec/tokens.json `tabBar`.
 *
 * 기본 탭 바를 쓰지 않는다. react-navigation의 바는 높이·패딩·라벨 굵기·아이콘
 * 자리를 제 방식으로 정해서 시안(72 + safeBottom · 위 패딩 9 · 항목 52 · 아이콘 24/stroke 1.8 ·
 * 아이콘과 라벨 사이 3 · 라벨 12/16 · 활성 #212124 700 · 비활성 #868B94 600 · 위 선 1px #EAEBEE)과
 * 어긋난다. 값은 전부 `Layout`·`ThemedText type="tab"`에서 온다.
 *
 * Pick 탭 아이콘은 **Pick Mark**(하트 안에 체크 · 획 1.9 · 절대 변경 금지 — CLAUDE.md · tokens.json
 * tabBar.items[pick].icon = pickMark)다. 05-root 시안 파일의 ICONS.pick(P + 체크)은 옛 글리프이고
 * 02-design-system · 21-device · tokens.json이 하트 마크를 가리킨다.
 *
 * Pick 탭 오른쪽 위의 점은 시안이 고정으로 둔 배지다. 크기·테두리·위치가
 * `spec/tokens.json` `tabBar.pickDot`(7 · 1.5 · −1)이다.
 */
type TabSpec = { icon: ProductSymbolName | 'pick'; label: string };

const TABS: Record<string, TabSpec> = {
  index: { icon: 'house', label: '홈' },
  search: { icon: 'magnifier', label: '검색' },
  pick: { icon: 'pick', label: 'Pick' },
  wedding: { icon: 'calendar', label: '웨딩일정' },
  my: { icon: 'person', label: 'MY' },
};

export function RootTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const bottom = Math.max(insets.bottom, 0);
  // Root 5탭에만 탭 바가 있다(SPEC §12.2). 홈에서 파고든 하위 스택((home) — 피드 ·
  // TOP3)에서는 dock이나 CTA가 아래를 맡는다.
  const focused = state.routes[state.index];
  if (!TABS[focused?.name ?? '']) return null;
  /*
   * 탭 안의 하위 스택(업체 상세 · 일정 · 지출 · 후보 목록 …)에서도 그리지 않는다 — 시안
   * (06 · 07 · 08 하위)은 전부 nav 56 + dock이고 탭 바가 없다. 첫 화면(index 0)만 Root다.
   */
  const nested = focused?.state as { index?: number } | undefined;
  if (nested && typeof nested.index === 'number' && nested.index > 0) return null;

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
        const spec = TABS[route.name];
        const { options } = descriptors[route.key];
        // 다섯 탭 밖의 라우트(제보 · (home) 하위 스택 — href: null)는 자리를 차지하지 않는다.
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
            <View style={styles.iconWrap}>
              {spec.icon === 'pick' ? (
                <WeddingMark size={Layout.iconTab} color={color} />
              ) : (
                <ProductSymbol name={spec.icon} size={Layout.iconTab} color={color} />
              )}
              {spec.icon === 'pick' && (
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: theme.tint, borderColor: theme.background },
                  ]}
                />
              )}
            </View>
            <ThemedText type="tab" style={[styles.label, { color, fontWeight: active ? 700 : 600 }]}>
              {spec.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Layout.tabBarPaddingTop,
    // tokens.json elevation.tabBarTop: inset 0 1px 0 #EAEBEE — RN에서는 borderTop 1(SPEC §14).
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    minHeight: Layout.tabItemMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.tabItemGap,
  },
  iconWrap: {
    width: Layout.iconTab,
    height: Layout.iconTab,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: Layout.tabPickDotOffset,
    right: Layout.tabPickDotOffset,
    width: Layout.tabPickDot,
    height: Layout.tabPickDot,
    borderRadius: Layout.tabPickDot / 2,
    borderWidth: Layout.tabPickDotBorder,
  },
  label: { textAlign: 'center' },
});
