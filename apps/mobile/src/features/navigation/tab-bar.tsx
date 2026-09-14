import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FontSize,
  Layout,
  LineHeight,
  ProductSymbol,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';

import { isRootTab, rootTab, type RootTabSpec } from './root-tabs';

/**
 * Root 탭 바 — 05-root 시안 1:1.
 *
 * 기본 탭 바를 쓰지 않는다. react-navigation의 바는 높이·패딩·라벨 굵기·아이콘
 * 자리를 제 방식으로 정해서 시안(72 + safeBottom · 위 패딩 9 · 항목 52 · 아이콘과
 * 라벨 사이 3 · 라벨 12/16)과 어긋난다. 값은 전부 `Layout`·`FontSize`에서 온다.
 *
 * 탭 목록·라벨·아이콘은 `root-tabs.ts`가 정한다. 이 파일은 그리기만 한다.
 *
 * **Pick은 가운데에서 원형으로 선다**(2026-09-14 대표 확정 · Figma `Root.tsx`
 * `isPick`). 켜지면 원이 주색으로 차고 마크가 흰색으로 뒤집힌다 — 나머지 넷과
 * 다른 모양이라야 «Pick이 이 앱의 중심»이라는 말이 화면에서도 같은 무게로 읽힌다.
 * 그림자는 `tokens.json` `tabBar.$rule`의 «과도한 그림자 금지»를 지켜 얕게 둔다.
 *
 * **원 위의 흰 마크는 대비가 모자란다** — `tokens.json` `color.brand.onPrimary`의
 * `$contrast`가 «#E7898D 위 2.51:1 · WCAG AA 미달 · MASTER 판단 대기»라고 적어 둔
 * 그 자리다. 토큰이 정해 주는 값을 여기서 몰래 바꾸지 않는다. 보정하기로 결정되면
 * 토큰이 먼저 바뀌고 이 코드는 그대로 따라간다.
 *
 * Pick 오른쪽 위의 점은 시안이 고정으로 둔 배지다(`tokens.json` `tabBar.pickDot`).
 * 원이 차 있을 때는 그리지 않는다 — 주색 면 위의 주색 점은 보이지 않는다.
 */
export function RootTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const bottom = Math.max(insets.bottom, 0);
  // Root 5탭에만 탭 바가 있다(SPEC §12.2). 탭에서 내린 화면(검색 · 제보 · 상세 ·
  // 홈 하위 스택)에서는 dock이나 CTA가 아래를 맡고 상단 뒤로가기만 남는다.
  if (!isRootTab(state.routes[state.index]?.name)) return null;

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
        // 다섯 탭 밖의 라우트(검색 · 제보 · (home) — href: null)는 자리를 차지하지 않는다.
        if (!spec) return null;
        const active = state.index === index;

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
            <Text
              style={[
                styles.label,
                { color: active ? theme.text : theme.textAssistive, fontWeight: active ? '700' : '600' },
              ]}>
              {spec.label}
            </Text>
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
 * 흰색, 꺼져 있으면 원 없이 나머지 탭과 같은 모양이다 — 꺼진 원까지 그리면
 * 다섯 탭이 두 종류로 갈려 보인다.
 */
function TabIcon({ spec, active }: { spec: RootTabSpec; active: boolean }) {
  const theme = useTheme();
  const filled = Boolean(spec.emphasized) && active;
  const color = filled ? theme.onTint : active ? theme.text : theme.textAssistive;

  const mark =
    spec.icon === 'pick' ? (
      <WeddingMark size={Layout.iconTab} color={color} />
    ) : (
      <ProductSymbol name={spec.icon} size={Layout.iconTab} color={color} />
    );

  if (!spec.emphasized) return <View style={styles.iconWrap}>{mark}</View>;

  return (
    <View
      style={[
        styles.emphasizedWrap,
        filled ? [styles.emphasizedOn, { backgroundColor: theme.tint, shadowColor: theme.tint }] : null,
      ]}>
      {/* 점은 아이콘 모서리에 붙는다 — 원을 기준으로 두면 한참 떨어져 뜬다. */}
      <View style={styles.iconWrap}>
        {mark}
        {/* 원이 차 있으면 그리지 않는다 — 주색 면 위의 주색 점은 보이지 않는다. */}
        {filled ? null : (
          <View style={[styles.dot, { backgroundColor: theme.tint, borderColor: theme.background }]} />
        )}
      </View>
    </View>
  );
}

/*
 * 강조 탭의 원. Figma `Root.tsx`의 `w-12 h-12 rounded-full`(48)이고 8단계 간격
 * 토큰에 없는 값이라 여기 이름 붙여 둔다 — 토큰에 `tabBar.emphasized`가 생기면
 * 여기만 바꾼다. 아이콘 24가 48 안에 서므로 주위 여백은 12씩이다.
 */
const EMPHASIZED_SIZE = 48;
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
  /* 꺼져 있어도 자리는 원 크기다 — 켜고 끌 때 라벨이 위아래로 들썩이지 않는다. */
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
  label: {
    fontSize: FontSize.tab,
    lineHeight: LineHeight.tab,
  },
});
