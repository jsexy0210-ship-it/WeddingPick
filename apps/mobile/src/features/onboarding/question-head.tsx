import { StyleSheet, View } from 'react-native';

import { Layout, LetterSpacing, ThemedText } from '@weddingpick/ui';

/**
 * 질문 머리 — 규격서 docs/design/figma-export/06-onboarding-login.dc.html(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 382×445  pad 80 0 0 0
 *     p "JUST FOR YOU" · 10/400 primary · lh 15 · ls 2.2px      ← **넣지 않는다**(아래)
 *     h1 "결혼 예정일이 있나요?" · 38/700 #1A1C20 · lh 45 · ls -0.95px · mar 16 0 0 0
 *     p "아직 정하지 않았어도 괜찮아요." · 14/400 #868B94 · lh 20 · mar 12 0 0 0
 *
 * 제목은 우리 두 줄(`STEP_TITLE_LINES`)을 한 문장으로 잇는다 — 피그마 제목은 한 줄이고 폭에 따라 접힌다.
 *
 * **영문 eyebrow(`JUST FOR YOU`)는 넣지 않는다 — 되살리지 마라.** 2026-09-15 대표 지시
 * 「위와 같이 온보딩, 전체 메뉴에 이런 형식에 맞지 않는 화면 있으면 싹다 찾아서 삭제해」다.
 * 한국어로 옮기는 것도 아니고 **줄째 없앤다** — 제목 위에 영문 대문자를 자간 넓혀 얹은
 * 장식이라 한국어로 옮기면 그 장식이 어색해진다.
 *
 * **제목은 규격서와 같은 자리에 둔다.** eyebrow가 차지하던 높이까지 사라지면 제목이 위로
 * 붙으므로, 그만큼을 위 여백으로 돌렸다 — `Layout.headTopOnboarding`(80 + lh 15 + mar 16 = 111).
 *
 * `extract-figma-export.mjs`를 다시 돌리면 규격서에는 영문이 되살아난다(피그마를 그대로
 * 읽는 도구다). 그때 「규격서에 있는데 왜 없냐」며 되돌리지 않는다.
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
  /* eyebrow를 지운 만큼을 위 여백으로 돌린다 — «pad 80» + eyebrow «lh 15» + 제목 «mar 16». */
  wrap: {
    paddingTop: Layout.headTopOnboarding,
    paddingHorizontal: Layout.gutter,
  },
  /* «38/700 · lh 45 · ls -0.95px» — «mar 16»은 위 여백에 합쳐졌다. */
  title: { fontWeight: 700, letterSpacing: LetterSpacing.n095 },
  /* «14/400 · mar 12 0 0 0». */
  description: { marginTop: Layout.inlineGap },
});
