import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, Radius, Spacing } from './theme';
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
                {
                  backgroundColor: selected ? theme.background : 'transparent',
                  borderWidth: focused ? Border.focus : 0,
                  borderColor: theme.tint,
                  opacity: pressed ? 0.8 : hovered && !selected ? 0.9 : 1,
                },
              ];
            }}>
            <ThemedText
              type="t7"
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
 * 피그마 세 칸 탭(2026-09-14 정본 · `CommunityFeed` `grid-cols-3 rounded-2xl bg-secondary p-1`,
 * 칸 `h-10 rounded-xl text-xs font-bold`): 겉 radius 16 · 안쪽 4 · 칸 40 · radius 22 · 글자 700.
 * 켠 칸은 흰 면(그림자는 없다 — elevation.$rule).
 */
const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.cardLarge,
    padding: Spacing.one,
  },
  item: {
    flex: 1,
    height: Layout.controlMedium,
    borderRadius: Radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: 700 },
});
