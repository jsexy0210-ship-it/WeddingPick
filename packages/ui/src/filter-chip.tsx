import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

export type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** 여럿 중 하나만 고르는 자리인지. 스크린 리더가 읽는 역할이 달라진다. */
  role?: 'checkbox' | 'radio';
  /**
   * `false`면 **누르지 않는 표시용 칩**이 된다 — 업체에 붙은 스타일 · 지역처럼
   * 읽기만 하는 꼬리표가 그 자리다.
   *
   * 같은 모양을 두 벌 만들지 않으려고 여기 한 갈래로 두었다. 대신 눌리지 않는
   * 칩은 `selected`를 무시하고 `onPress`도 받지 않는다 — 보이기만 하는데 켜짐
   * 상태가 있으면 누를 수 있는 것처럼 읽힌다.
   */
  interactive?: boolean;
};

/** 눌러서 켜고 끄는 작은 조건 단추. 검색 필터와 증빙 종류 선택이 같은 것을 쓴다. */
export function FilterChip({
  label,
  selected = false,
  onPress,
  role = 'checkbox',
  interactive = true,
}: FilterChipProps) {
  const theme = useTheme();

  if (!interactive) {
    return (
      <ThemedView style={[styles.chip, styles.tag, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}>
      {(state) => {
        const { hovered, focused } = readWebInteractionState(state);
        return (
          <ThemedView
            style={[
              styles.chip,
              {
                borderColor: selected || focused ? theme.tint : theme.border,
                borderWidth: focused && !selected ? 2 : 1,
                backgroundColor: selected
                  ? theme.tint
                  : hovered
                    ? theme.backgroundSelected
                    : 'transparent',
              },
            ]}>
            <ThemedText
              type="small"
              style={selected ? { color: theme.onTint } : undefined}
              themeColor={selected ? undefined : 'textSecondary'}>
              {label}
            </ThemedText>
          </ThemedView>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    /* SEED 핸드오프: 칩 36px · Radius pill(999). */
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  /** 표시용 칩은 테두리 없이 면으로만 선다 — 눌리는 칩과 한눈에 갈린다. */
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 0,
  },
});
