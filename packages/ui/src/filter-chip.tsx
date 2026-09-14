import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Border, Layout, Radius } from './theme';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

export type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 여럿 중 하나만 고르는 자리인지. 스크린 리더가 읽는 역할이 달라진다. */
  role?: 'checkbox' | 'radio';
  /**
   * `default` 36 · 글자 14/700 · padding 0 14 — 검색 필터 · 조건 칩(component.chip).
   * `small` 28 · 글자 micro 13/700 · padding 0 10 — 스타일 태그(v3.24 «추천 이유 첫 줄 칩 28»).
   * `sheet` 38 · 글자 16/700 · padding 0 14 — 필터 바텀시트의 조건 칩(component.chip.sheet ·
   * 06-search.dc.html `opt`).
   */
  size?: 'default' | 'small' | 'sheet';
  /**
   * 선택 색. 기본 `ink`(#212124 채움 · 흰 글자 — tokens.json component.chip.activeBg).
   * `tint`는 스킨 코랄 — 홈 코랄 네 곳 규칙(v3.24) 밖에서는 쓰지 않는다. 내가 고른 스타일과 겹치는
   * 태그(coral + 체크)처럼 시안이 코랄로 그린 자리에만.
   */
  accent?: 'ink' | 'tint';
  /**
   * 꺼진 칩의 표현.
   *
   * `fill`(기본) 회색 채움 #F2F3F6 — component.chip.inactiveBg.
   * `outline` 흰 바탕 + 1px #DCDEE3 테두리 — component.chip.outline. 검색 결과
   * 필터바(WP-SRCH-001)가 이쪽이다. 루트 시안 `WP-SRCH-검색.dc.html` `chip(false)`가
   * «background:#fff;box-shadow:inset 0 0 0 1px #dcdee3»로 그린다. 켠 칩은 둘이 같다.
   */
  off?: 'fill' | 'outline';
  disabled?: boolean;
};

/**
 * 눌러서 켜고 끄는 작은 조건 단추 — tokens.json component.chip · 02-design-system «Chip».
 *
 *   높이 36 · radius 999 · padding 0 14 · 14px 700
 *   켬   #212124 / #FFFFFF        끔   #F2F3F6 / #4D5159        비활성  opacity .5
 *
 * 테두리는 없다 — 채움으로만 구분한다. 키보드 포커스(웹)만 2px 코랄 링을 얹는다.
 * 가로 스크롤 영역에서는 `flex: 0 0 auto`가 필요하다 — 부모가 `flexShrink: 0`을 준다.
 */
export function FilterChip({
  label,
  selected,
  onPress,
  role = 'checkbox',
  size = 'default',
  accent = 'ink',
  off = 'fill',
  disabled = false,
}: FilterChipProps) {
  const theme = useTheme();
  const small = size === 'small';
  const paddingX = small ? Layout.chipSmallPaddingX : Layout.chipPaddingX;
  const height = small ? Layout.chipSmall : size === 'sheet' ? Layout.chipSheet : Layout.chip;
  const selectedBackground = accent === 'tint' ? theme.tint : theme.text;
  /* 꺼진 칩의 테두리. 켠 칩과 포커스 링은 자기 색이 있어 여기 끼지 않는다. */
  const outlined = off === 'outline' && !selected;

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected, disabled } : { checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}>
      {(state) => {
        const { focused } = readWebInteractionState(state);
        const ring = focused ? Border.focus : outlined ? Border.hairline : 0;
        return (
          <ThemedView
            style={[
              styles.chip,
              {
                height,
                /* 포커스 링은 패딩을 그만큼 줄여 폭이 변하지 않게 한다. */
                paddingHorizontal: paddingX - ring,
                borderWidth: ring,
                borderColor: focused ? theme.tint : theme.track,
                backgroundColor: selected
                  ? selectedBackground
                  : outlined
                    ? theme.background
                    : theme.backgroundSelected,
                opacity: disabled ? 0.5 : 1,
              },
            ]}>
            <ThemedText
              type={small ? 'micro' : size === 'sheet' ? 't6' : 't7'}
              numberOfLines={1}
              style={[styles.label, { color: selected ? theme.onTint : theme.textSecondary }]}>
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
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  /** 칩 글자는 700 — caption(14)의 400 기본값을 덮는다. */
  label: { fontWeight: 700 },
});
