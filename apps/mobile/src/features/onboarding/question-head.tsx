import { StyleSheet, View } from 'react-native';

import { FontSize, Layout, LineHeight, Spacing, ThemedText } from '@weddingpick/ui';

/**
 * 질문 머리 — docs/design/figma-export/06-onboarding-login.dc.html.
 *
 * 1/3은 qBlock(20/24/24 · 28/38), 2/3·3/3은 qBlockSm(12/24/20 · 26/35)다.
 * 제목 줄바꿈도 정본의 <br> 위치를 그대로 둔다. 영문 eyebrow는 없다.
 */
export function QuestionHead({
  lines,
  description,
  compact = false,
}: {
  lines: readonly [string, string];
  description?: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : styles.wrapRegular]}>
      <ThemedText
        type={compact ? 'f26' : 'f28'}
        style={[styles.title, compact ? styles.titleCompact : styles.titleRegular]}>
        {lines[0]}{'
'}{lines[1]}
      </ThemedText>
      {description ? (
        <ThemedText type="f15" themeColor="textAssistive" style={styles.description}>
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Layout.gutter,
  },
  wrapRegular: {
    paddingTop: Layout.listGap,
    paddingBottom: Layout.gutter,
    gap: Layout.iconTextGap,
  },
  wrapCompact: {
    paddingTop: Layout.inlineGap,
    paddingBottom: Layout.listGap,
    gap: Spacing.two,
  },
  title: { fontWeight: 700 },
  titleRegular: {
    lineHeight: LineHeight.lh38,
    letterSpacing: FontSize.f28 * -0.02,
  },
  titleCompact: {
    lineHeight: LineHeight.t2,
    letterSpacing: FontSize.f26 * -0.02,
  },
  description: { lineHeight: LineHeight.lh23 },
});
