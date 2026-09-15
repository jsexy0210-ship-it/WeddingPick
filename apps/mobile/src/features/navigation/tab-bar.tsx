import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Layout, LineHeight, ProductSymbol, ThemedText, WeddingMark, useTheme } from '@weddingpick/ui';

import { isRootTab, rootTab, type RootTabSpec } from './root-tabs';

/**
 * Root 탭 바 — 05-root 시안 1:1 · spec/tokens.json `tabBar`.
 *
 * 기본 탭 바를 쓰지 않는다. react-navigation의 바는 높이·패딩·라벨 굵기·아이콘
 * 자리를 제 방식으로 정해서 시안(72 + safeBottom · 위 패딩 9 · 항목 52 · 아이콘 24/stroke 1.8 ·
 * 아이콘과 라벨 사이 3 · 라벨 12/16 · 활성 #212124 700 · 비활성 #868B94 600 · 위 선 1px #EAEBEE)과
 * 어긋난다. 값은 전부 `Layout`·`ThemedText type="tab"`에서 온다.
 *
 * 탭 목록·라벨·아이콘은 `root-tabs.ts`가 정한다. 이 파일은 그리기만 한다.
 *
 * Pick 탭 아이콘은 **Pick Mark**(하트 안에 체크 · 획 1.9 · 절대 변경 금지 — CLAUDE.md · tokens.json
 * tabBar.items[pick].icon = pickMark)다. 05-root 시안 파일의 ICONS.pick(P + 체크)은 옛 글리프이고
 * 02-design-system · 21-device · tokens.json이 하트 마크를 가리킨다.
 *
 * **Pick은 가운데에서 원형으로 선다**(2026-09-14 대표 확정 · weddingpick_figma
 * `src/app/components/Root.tsx:66-84` `isPick`). 규격은 전부 `spec/tokens.json`
 * `tabBar.emphasized`에서 온다 — 여기에 숫자를 적지 않는다.
 *
 * **꺼져 있어도 원은 남는다.** 켜지면 주색으로 차고 마크가 `onTint`로 뒤집히고,
 * 꺼지면 옅은 면(`backgroundSelected`)에 회색 마크다 — 원이 아예 사라지면 다섯 탭
 * 중 가운데만 자리가 들썩인다. 그림자는 `tabBar.$rule`의 «과도한 그림자 금지»를
 * 지켜 얕게 둔다.
 *
 * Pick 오른쪽 위의 점은 시안이 고정으로 둔 배지다(`spec/tokens.json` `tabBar.pickDot`
 * — 7 · 1.5 · −1). 원이 차 있을 때는 그리지 않는다 — 주색 면 위의 주색 점은 보이지 않는다.
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
            <ThemedText type="tab" style={[styles.label, { color, fontWeight: active ? 700 : 600 }]}>
              {spec.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 탭 아이콘 한 자리.
 *
 * 강조 탭(Pick)은 아이콘 자리가 원이다. 켜져 있으면 원이 주색으로 차고 마크가
 * `onTint`, 꺼져 있으면 원 없이 나머지 탭과 같은 모양이다 — 꺼진 원까지 그리면
 * 다섯 탭이 두 종류로 갈려 보인다.
 *
 * 마크 색을 여기서 정하지 않고 `theme.onTint`(= tokens.json `color.brand.onPrimary`)를
 * 그대로 쓴다. 그 값이 주색 위 대비를 책임진다 — 대비가 모자라면 토큰을 고치지
 * 이 파일을 고치지 않는다.
 */
function TabIcon({ spec, active }: { spec: RootTabSpec; active: boolean }) {
  const theme = useTheme();
  const filled = Boolean(spec.emphasized) && active;
  const color = filled ? theme.onTint : active ? theme.text : theme.textAssistive;
  /* 원 안은 20, 나머지 넷은 24. 토큰 `tabBar.emphasized.$only` 참고. */
  const size = spec.emphasized ? Layout.tabEmphasizedIcon : Layout.iconTab;

  const mark =
    spec.icon === 'pick' ? (
      <WeddingMark size={size} color={color} />
    ) : (
      <ProductSymbol name={spec.icon} size={size} color={color} />
    );

  if (!spec.emphasized) return <View style={styles.iconWrap}>{mark}</View>;

  return (
    <View
      style={[
        styles.emphasizedWrap,
        filled
          ? [styles.emphasizedOn, { backgroundColor: theme.tint, shadowColor: theme.tint }]
          : { backgroundColor: theme.backgroundSelected },
      ]}>
      {/* 점은 아이콘 모서리에 붙는다 — 원을 기준으로 두면 한참 떨어져 뜬다. */}
      <View style={styles.emphasizedIcon}>
        {mark}
        {/* 원이 차 있으면 그리지 않는다 — 주색 면 위의 주색 점은 보이지 않는다. */}
        {filled ? null : (
          <View style={[styles.dot, { backgroundColor: theme.tint, borderColor: theme.backgroundSelected }]} />
        )}
      </View>
    </View>
  );
}

/* 강조 탭의 원 지름. spec/tokens.json `tabBar.emphasized.size`. */
const EMPHASIZED_SIZE = Layout.tabEmphasized;
/*
 * 원 48 + 간격 3 + 라벨 16 = 67은 탭 바가 내주는 63(72 − 위 패딩 9)보다 크다.
 * 넘치는 만큼만 끌어올려 원이 바 위쪽으로 살짝 솟게 한다 — 아래로 넘쳐 잘리는
 * 것을 막고, 강조 탭이 한 단 올라선 모양도 같이 얻는다. 토큰이 바뀌면 이 값도
 * 따라 바뀌게 계산해 둔다(바가 넉넉해지면 0이 되어 솟지 않는다).
 */
const EMPHASIZED_LIFT = Math.max(
  0,
  EMPHASIZED_SIZE + Layout.tabItemGap + LineHeight.tab - (Layout.tabBar - Layout.tabBarPaddingTop)
);

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
  /* 원 안의 아이콘 자리. 점 배지가 이 사각의 모서리에 붙는다. */
  emphasizedIcon: {
    width: Layout.tabEmphasizedIcon,
    height: Layout.tabEmphasizedIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 켜고 끌 때 원은 그대로 있고 면 색만 바뀐다 — 자리가 들썩이지 않는다. */
  emphasizedWrap: {
    width: EMPHASIZED_SIZE,
    height: EMPHASIZED_SIZE,
    borderRadius: EMPHASIZED_SIZE / 2,
    marginTop: -EMPHASIZED_LIFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emphasizedOn: {
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
