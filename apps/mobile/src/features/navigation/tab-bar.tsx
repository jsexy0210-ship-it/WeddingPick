import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
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

import { isRootTab, rootTab, type RootTabSpec } from './root-tabs';

/**
 * Root 탭 바 — 규격서 docs/figma-spec/home.txt 맨 아래 `nav`(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   nav 430×72  flex · align center · pad 0 8 0 8 · bg #FFFFFF · border 1 #000000 6%
 *     a 83×55   flex/column · gap 4 · justify center · align center · pad 8 0 8 0
 *       svg 20×20
 *       span "홈" · 10/600 #1A1C20 · lh 15          (꺼진 탭은 10/500 #868B94)
 *     a 83×67   flex/column · gap 4 · justify center · align center        ← Pick
 *       div 48×48  flex · justify center · align center · bg #F7F8F9 · r9999   (켜지면 primary + shadow)
 *         svg 20×20
 *       span "Pick" · 10/600 #868B94 · lh 15 · ls 0.25px  (켜지면 #1A1C20)
 *
 * 기본 탭 바를 쓰지 않는다 — react-navigation의 바는 높이 · 패딩 · 라벨 굵기를 제 방식으로 정한다.
 * 탭 목록 · 라벨 · 아이콘은 `root-tabs.ts`가 정한다. 이 파일은 그리기만 한다.
 *
 * 아이콘 넷은 SEED(`SeedIcon` · 피그마 `Root.tsx` `IconHomeRegular/Fill` …)다. **Pick 자리만 보류다**
 * (2026-09-15 MASTER) — 피그마는 `IconHeart`지만 대표님이 하트라고 하기 전까지 우리 Pick Mark
 * (하트 안에 체크 · 두 path 절대 변경 금지)를 그대로 둔다.
 *
 * 옛 규격(72 + 위 패딩 9 · 항목 52 · 아이콘 24 · 라벨 12/16)은 `spec/tokens.json` `tabBar.$rule`에
 * 남아 있지만 규격서가 이긴다. `Layout.tabBarPaddingTop` · `tabItemMinHeight`는 이제 여기서 안 쓴다.
 */
export function RootTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const bottom = Math.max(insets.bottom, 0);
  // Root 5탭에만 탭 바가 있다(SPEC §12.2). 탭에서 내린 화면(검색 · 제보 · (home) 하위
  // 스택)에서는 dock이나 CTA가 아래를 맡고 상단 뒤로가기만 남는다.
  const focused = state.routes[state.index];
  if (!isRootTab(focused?.name)) return null;
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
        const spec = rootTab(route.name);
        const { options } = descriptors[route.key];
        // 다섯 탭 밖의 라우트(검색 · 제보 · (home) 하위 스택 — href: null)는 자리를 차지하지 않는다.
        if (!spec) return null;
        const active = state.index === index;
        /* 라벨 — 켜짐 «10/600 #1A1C20», 꺼짐 «10/500 #868B94». Pick은 꺼져도 600. */
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

/**
 * 탭 아이콘 한 자리. 켜짐 · 꺼짐이 SEED 한 쌍(Regular · Fill)이다.
 *
 * 강조 탭(Pick)은 원 48 안에 20이다. **꺼져 있어도 원은 남는다** — 면만 `backgroundElement`
 * (#F7F8F9)로 바뀐다. 켜지면 주색 면 + 그림자(피그마 `shadow-lg shadow-primary/30`)에 흰 마크다.
 */
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
  /* «flex · align center · pad 0 8 0 8 · border 1». */
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.tabBarPaddingX,
    borderTopWidth: Border.hairline,
  },
  /* «flex/column · gap 4 · justify center · align center · pad 8 0 8 0». */
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.tabItemGap,
    paddingVertical: Spacing.two,
  },
  /* Pick 항목은 위아래 패딩이 없다(«a 83×67» — 원 48 + 4 + 15). */
  itemPick: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.tabItemGap,
  },
  /* «div 48×48 · r9999». */
  pickCircle: {
    width: Layout.tabEmphasized,
    height: Layout.tabEmphasized,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 켜진 원의 그림자 — 피그마 `shadow-lg shadow-primary/30`. 얕은 카드 그림자와 다른 값이다. */
  pickCircleOn: {
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { textAlign: 'center' },
  /* «"Pick" … ls 0.25px». */
  labelPick: { letterSpacing: LetterSpacing.p025 },
});
