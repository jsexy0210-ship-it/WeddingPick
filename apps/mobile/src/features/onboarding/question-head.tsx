import { StyleSheet, View } from 'react-native';

import { Layout, Spacing, ThemedText } from '@weddingpick/ui';

/**
 * 질문 제목 두 줄 + 설명 한 줄. 시안 20-onboarding-v2 `qWrap` — 상하 12 · 좌우 24 ·
 * 사이 8. 제목은 t2(26/35)이고 줄바꿈은 손으로 나눈 자리 그대로다.
 *
 * 자간은 ThemedText가 플랫폼별로 붙인다(안드로이드만 −0.03/−0.02em). 설명은
 * «서비스가 해주는 일» 한 줄이다(v3.19) — 제목 각 줄 1줄 · 설명 최대 2줄로 고정한다.
 */
export function QuestionHead({
  lines,
  description,
}: {
  lines: readonly [string, string];
  description?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View>
        <ThemedText type="t2" numberOfLines={1}>
          {lines[0]}
        </ThemedText>
        <ThemedText type="t2" numberOfLines={1}>
          {lines[1]}
        </ThemedText>
      </View>
      {description ? (
        <ThemedText type="body" themeColor="textSecondary" numberOfLines={2}>
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.two,
  },
});
