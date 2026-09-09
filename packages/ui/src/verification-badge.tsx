import { VERIFICATION_LEVEL_RULES, type VerificationLevel } from '@weddingpick/domain';
import { StyleSheet, View } from 'react-native';

import { STATUS_BADGE_STYLE } from './pick-status-badge';
import { ThemedText } from './themed-text';
import { VERIFICATION_LEVEL_ACCENT } from './verification-levels';

/** 검증 등급 배지. 서비스정책서 2번에 따라 등급은 UI에서 항상 배지로 표시한다. */
export type VerificationBadgeProps = {
  /** 이 문서가 어느 확인 단계까지 왔는지. 등급의 의미는 도메인이 정한다. */
  level: VerificationLevel;
};

/**
 * 상자는 상태 배지와 같다 — height 22 · padding 4 9 · radius 4 · 14/19/700 · 한 줄
 * (tokens.json component.badge). 등급별 색은 `VERIFICATION_LEVEL_ACCENT`(고정).
 */
export function VerificationBadge({ level }: VerificationBadgeProps) {
  const accent = VERIFICATION_LEVEL_ACCENT[level];

  return (
    <View style={[styles.badge, { backgroundColor: `${accent}1F` }]}>
      <ThemedText type="badge" numberOfLines={1} style={{ color: accent }}>
        {VERIFICATION_LEVEL_RULES[level].label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: STATUS_BADGE_STYLE,
});
