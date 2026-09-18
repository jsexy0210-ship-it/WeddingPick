import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  Layout,
  LetterSpacing,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';

import { rootTab, type RootTabSpec } from './root-tabs';
import { isRootTabPath } from './root-tab-visibility';

/**
 * Root 탭 바. 탭 구성은 root-tabs.ts, 노출 범위는 docs/design/README.md를 따른다.
 * 상세 화면을 스택 첫 항목으로 직접 열어도 탭 바가 나타나지 않도록 경로로 판정한다.
 * Pick Mark와 기존 토큰을 유지한다. 이 변경은 시각 수치를 새로 정하지 않는다.
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
        const weight = active || spec.emphasized ? 600 : 500;

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
            style={spec.emphasized ? styles.itemPick : styles.item}>
            <TabIcon spec={spec} active={active} />
            <ThemedText
              type="f10"
              style={[styles.label, spec.emphasized && styles.labelPick, { color, fontWeight: weight }]}>
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
    const filled = active;

    return (
      <View
        style={[
          styles.pickCircle,
          filled
            ? [styles.pickCircleOn, { backgroundColor: theme.tint, shadowColor: theme.tint }]
            : { backgroundColor: theme.backgroundElement },
        ]}>
        <WeddingMark size={Layout.iconRow} color={filled ? theme.onTint : theme.textAssistive} />
      </View>
    );
  }

  return (
    <SeedIcon
      name={active ? spec.icon.on : spec.icon.off}
      size={Layout.iconRow}
      color={active ? theme.text : theme.textAssistive}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.tabBarPaddingX,
    borderTopWidth: Border.hairline,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.tabItemGap,
    paddingVertical: Spacing.two,
  },
  itemPick: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.tabItemGap,
  },
  pickCircle: {
    width: Layout.tabEmphasized,
    height: Layout.tabEmphasized,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCircleOn: {
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { textAlign: 'center' },
  labelPick: { letterSpacing: LetterSpacing.p025 },
});
