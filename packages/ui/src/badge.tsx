import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/**
 * 뜻이 정해지지 않은 일반 배지.
 *
 * 「인기」 「신규」처럼 **자리마다 문구가 달라지는** 표시에만 쓴다. 뜻이 정해진
 * 배지는 따로 있다 — 인증 등급은 `VerificationBadge`, Pick 상태는 `PickStatusBadge`,
 * 실 제보 건수는 `DataTierBadge`다. 그 셋을 이것으로 갈아끼우면 배지가 무엇을
 * 뜻하는지가 호출하는 화면마다 흩어진다.
 *
 * **글자를 자르지 않는다.** 높이를 고정하지 않고 안쪽 여백으로만 부푼다. 이름과
 * 한 줄에 놓여도 배지가 먼저 줄지 않게 `flexShrink: 0`으로 버틴다 — 전수 검수에서
 * 걸렸던 자리가 전부 이 두 가지였다. 두 줄이 될 만큼 긴 문구는 배지로 쓰지 않는다.
 */
export type BadgeTone = 'neutral' | 'ink' | 'positive' | 'cautionary';

export type BadgeProps = {
  label: string;
  /**
   * 의미색은 상태를 말할 때만 쓴다. 코랄(`tint`)은 여기 없다 — 그 색은 사용자의
   * 다음 행동이 쓰는 색이라 배지가 가져가면 행동이 어디인지 흐려진다.
   *
   * `ink`는 사진 위에 얹는 자리다. 옅은 면은 사진 위에서 읽히지 않는다.
   */
  tone?: BadgeTone;
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const theme = useTheme();

  const background =
    tone === 'ink'
      ? theme.backgroundInk
      : tone === 'positive'
        ? theme.positiveBackground
        : tone === 'cautionary'
          ? theme.cautionaryBackground
          : theme.backgroundSelected;

  const color =
    tone === 'ink'
      ? theme.background
      : tone === 'positive'
        ? theme.positive
        : tone === 'cautionary'
          ? theme.cautionary
          : theme.textSecondary;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <ThemedText type="badge" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    /** 한 줄에 다른 것과 놓여도 배지가 먼저 줄지 않는다. */
    flexShrink: 0,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.small,
  },
});
