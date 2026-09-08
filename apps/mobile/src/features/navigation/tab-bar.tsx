import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FontSize,
  Layout,
  LineHeight,
  ProductSymbol,
  WeddingMark,
  useTheme,
  type ProductSymbolName,
} from '@weddingpick/ui';

/**
 * Root 탭 바 — 05-root 시안 1:1.
 *
 * 기본 탭 바를 쓰지 않는다. react-navigation의 바는 높이·패딩·라벨 굵기·아이콘
 * 자리를 제 방식으로 정해서 시안(72 + safeBottom · 위 패딩 9 · 항목 52 · 아이콘과
 * 라벨 사이 3 · 라벨 12/16)과 어긋난다. 값은 전부 `Layout`·`FontSize`에서 온다.
 *
 * Pick 탭 오른쪽 위의 점은 시안이 고정으로 둔 배지다. 크기·테두리·위치가
 * `spec/tokens.json` `tabBar.pickDot`이다.
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
  if (!TABS[state.routes[state.index]?.name ?? '']) return null;

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
            <Text style={[styles.label, { color, fontWeight: active ? '700' : '600' }]}>
              {spec.label}
            </Text>
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
    // 시안: box-shadow inset 0 1px 0 #eaebee — 위쪽 1px 선.
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
  label: {
    fontSize: FontSize.tab,
    lineHeight: LineHeight.tab,
  },
});
