import { StyleSheet, View } from 'react-native';

import { FontSize, Layout, LineHeight, Spacing, ThemedText } from '@weddingpick/ui';

/**
 * 질문 머리 — v3.29 정본 `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html`
 * WP-AUTH-002 ~ 006(`qBlock` · `qTitle` · `qSub`).
 *
 * **2026-09-23 정정** — 주석이 파기된 `figma-export/06-onboarding-login.dc.html`을
 * 근거로 적고 있었다. 다섯 질문 모두 `qBlock`(padding 20 24 24 · gap 10 · 제목
 * 28/38 · 안내 15/23) 하나만 쓴다 — v3.29에는 압축형(`qBlockSm`)이 없다. `compact`
 * prop은 지금 어디서도 넘기지 않는 죽은 경로이고, 값은 v3.28 이전 크기(26/35)를
 * 그대로 들고 있어 확인 없이 정본으로 못 쓴다 — DESIGN_UNRESOLVED로 남기고 손대지
 * 않는다(정본에 없는 요소 삭제 규칙은 «화면 안 요소»가 대상이라 쓰이지 않는 내부
 * variant까지 이 PR 범위에서 지우지 않는다).
 *
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
        {lines[0]}{'\n'}{lines[1]}
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
