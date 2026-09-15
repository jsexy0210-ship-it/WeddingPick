import { StyleSheet, View } from 'react-native';

import { Layout, LetterSpacing, Spacing, ThemedText } from '@weddingpick/ui';

import { onboarding } from '../../../../../spec/strings.ko.json';

/**
 * 질문 머리 — 규격서 docs/figma-spec/onboarding.txt(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 382×445  pad 80 0 0 0
 *     p (eyebrow) · 10/400 primary · lh 15 · ls 2.2px
 *     h1 "결혼 예정일이 있나요?" · 38/700 #1A1C20 · lh 45 · ls -0.95px · mar 16 0 0 0
 *     p "아직 정하지 않았어도 괜찮아요." · 14/400 #868B94 · lh 20 · mar 12 0 0 0
 *
 * 제목은 우리 두 줄(`STEP_TITLE_LINES`)을 한 문장으로 잇는다 — 피그마 제목은 한 줄이고 폭에 따라 접힌다.
 *
 * **eyebrow만 규격서와 다르다 — 되돌리지 마라.** 규격서는 `JUST FOR YOU`라고 적지만
 * (`docs/figma-spec/onboarding.txt:12`) 2026-09-15 대표 지시 「이딴 영문 싹다 없애」로
 * 한국어를 쓴다. 「피그마가 못 이기는 것은 말뿐이다」의 적용이고, **말만 바꾼 것이다** —
 * 자리 · 크기(10/400) · 색(코랄) · 자간(2.2px) · 제목과의 간격(16)은 규격서 그대로다.
 *
 * `extract-figma-spec.mjs`를 다시 돌리면 규격서에는 영문이 되살아난다(피그마를 그대로
 * 읽는 도구다). 그때 「규격서와 다르다」며 이 줄을 영문으로 돌리지 않는다.
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
      <ThemedText type="f10" themeColor="tint" style={styles.eyebrow}>
        {onboarding['question.eyebrow']}
      </ThemedText>
      <ThemedText type="f38" style={styles.title}>
        {lines.join(' ')}
      </ThemedText>
      {description ? (
        <ThemedText type="f14" themeColor="textAssistive" style={styles.description}>
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /* «pad 80 0 0 0» — 같은 값의 pickEmptyPaddingY. 좌우는 화면 «pad … 24». */
  wrap: {
    paddingTop: Layout.pickEmptyPaddingY,
    paddingHorizontal: Layout.gutter,
  },
  /* «10/400 · ls 2.2px». */
  eyebrow: { letterSpacing: LetterSpacing.p22 },
  /* «38/700 · lh 45 · ls -0.95px · mar 16 0 0 0». */
  title: { fontWeight: 700, letterSpacing: LetterSpacing.n095, marginTop: Spacing.three },
  /* «14/400 · mar 12 0 0 0». */
  description: { marginTop: Layout.inlineGap },
});
