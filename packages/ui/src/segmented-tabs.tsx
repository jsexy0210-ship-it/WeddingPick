import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Elevation, Layout, Radius, Spacing } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

export type SegmentedTabItem = {
  value: string;
  label: string;
};

export type SegmentedTabsProps = {
  items: SegmentedTabItem[];
  value: string;
  onChange: (value: string) => void;
  /** 무엇을 고르는 줄인지. 스크린 리더가 묶음을 읽을 때 쓴다. */
  accessibilityLabel?: string;
};

/**
 * 한 화면 안에서 보여줄 것을 갈아 끼우는 줄 — 옅은 트랙 안에서 흰 알약이 옮겨 다닌다.
 *
 * **하단 탭 바가 아니다.** 그쪽은 앱의 최상위 목적지를 오가는
 * `apps/mobile/src/features/navigation/tab-bar.tsx`이고, 이건 한 화면 안에서
 * 내용만 바꾸는 물건이다. 「탭은 최상위 목적지에만」이라는 원칙은 그쪽 이야기라,
 * 이 줄이 화면을 옮기는 데 쓰이면 안 된다.
 *
 * 칸은 똑같이 나눠 가진다. 넷을 넘으면 글자가 눌리니 그때는 칩(`FilterChip`)을 쓴다.
 */
export function SegmentedTabs({ items, value, onChange, accessibilityLabel }: SegmentedTabsProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => onChange(item.value)}
            style={(state) => {
              const { pressed, hovered, focused } = readWebInteractionState(state);
              return [
                styles.item,
                selected ? Elevation.figmaCard : null,
                {
                  backgroundColor: selected ? theme.background : 'transparent',
                  borderWidth: focused ? Border.focus : 0,
                  borderColor: theme.tint,
                  opacity: pressed ? 0.8 : hovered && !selected ? 0.9 : 1,
                },
              ];
            }}>
            {/* WP-LNG-001~003 seg(): 칸 «flex:1 · h40 · r8 · 14/700», 켠 칸 흰 면 + shadow. */}
            <ThemedText
              type="f14"
              numberOfLines={1}
              themeColor={selected ? 'text' : 'textAssistive'}
              style={styles.label}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/*
 * v3.29 정본 — `docs/design/html/대메뉴_MY.dc.html` `segWrap` · `seg()`(WP-LNG-001~003,
 * «리얼후기 · 웨딩정보 · 박람회» 세 칸 탭): 겉 `margin:0 20px 12px;padding:4px;
 * border-radius:10px;background:#f2f3f6;gap:2px`, 칸 `flex:1;height:40px;
 * border-radius:8px;font-size:14px;font-weight:700`, 켠 칸은 흰 면 +
 * `box-shadow:0 1px 3px rgba(0,27,55,.10)`.
 *
 * **예전에는 `CommunityFeed`(피그마 2026-09-14 벌·`radius.$note`가 「최신 화면의 기준이
 * 아니다」로 못박은 legacy 별칭 `cardLarge`(16) · `hero`(22))를 썼다** — 겉 radius가
 * 16이라 실제보다 크고, 칸 radius 22(=999에 가까운 완전 알약)라 정본의 각진 8보다 훨씬
 * 둥글었다. 글자도 `f12`(12px)라 정본 14px보다 작았다. 오늘 웨딩노트에서 잡힌
 * 「둥근 회색 필 세그먼트 vs 정본의 각진 세그먼트」와 같은 패턴이라 여기서 맞춘다.
 * `Radius.medium`(10)과 `Radius.picker`(8)는 이름은 다른 자리에서 온 것이지만 값이
 * 정본과 같아 새 토큰을 만들지 않고 그대로 쓴다.
 */
const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.medium,
    padding: Spacing.one,
    gap: 2,
  },
  item: {
    flex: 1,
    height: Layout.controlMedium,
    borderRadius: Radius.picker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: 700 },
});
