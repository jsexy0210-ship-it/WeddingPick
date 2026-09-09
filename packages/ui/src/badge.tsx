import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { STATUS_BADGE_STYLE } from './pick-status-badge';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/**
 * 상태 배지 색 — 02-design-system «Chip · Badge» · tokens.json color.status. 스킨과 무관하게 고정.
 *
 *   ok     인증완료 · 결정 완료 · 반영됨      #E8FAF6 / #1AA174
 *   wait   확인 중 · 보완 필요 · 검수 중       #FFE3BA / #805217
 *   no     반려 · 오류 · 환불                 #FFE5E3 / #E81607
 *   brand  Pick 완료 · 후보 Pick 중           #FFE8E4 / coral   (color-mix(pick 12~14%, #fff)의 고정값 · SPEC §14)
 *   none   준비 전 · 기본                     #F2F3F6 / #4D5159
 *   info   정보 · 링크성 배지(관리자)          #EBF7FA / #0077B2
 */
export type BadgeKind = 'ok' | 'wait' | 'no' | 'brand' | 'none' | 'info';

export type BadgeProps = {
  kind?: BadgeKind;
  children: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 배지 — tokens.json component.badge · SPEC §12.3.
 *
 *   height 22 고정 · 한 줄 · nowrap · padding 4 9 · radius 4 · 14/19/700
 *
 * 배지를 아래로 내리지 않는다 — 공간이 부족하면 옆 텍스트를 말줄임한다.
 */
export function Badge({ kind = 'none', children, style }: BadgeProps) {
  const theme = useTheme();
  const { background, text } = BADGE_LOOK[kind](theme);

  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      <ThemedText type="badge" numberOfLines={1} style={{ color: text }}>
        {children}
      </ThemedText>
    </View>
  );
}

type Theme = ReturnType<typeof useTheme>;

const BADGE_LOOK: Record<BadgeKind, (theme: Theme) => { background: string; text: string }> = {
  ok: (theme) => ({ background: theme.positiveBackground, text: theme.positive }),
  wait: (theme) => ({ background: theme.cautionaryBackground, text: theme.cautionary }),
  no: (theme) => ({ background: theme.negativeBackground, text: theme.negative }),
  brand: (theme) => ({ background: theme.tintSubtle, text: theme.tint }),
  none: (theme) => ({ background: theme.backgroundSelected, text: theme.textSecondary }),
  info: (theme) => ({ background: theme.accentBackground, text: theme.accentText }),
};

const styles = StyleSheet.create({
  badge: STATUS_BADGE_STYLE,
});
