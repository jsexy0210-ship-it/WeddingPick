import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Layout, LetterSpacing, Spacing, ThemedText } from '@weddingpick/ui';

/**
 * Root 5탭(홈 · 검색 · Pick · 웨딩노트 · MY) 맨 위 제목 줄 — 한 벌뿐이다.
 *
 * 2026-09-26 대표 지시 「히어로 영역이 제각각이다. 홈 화면 기준으로 통일한다」. 운영 웹에서 잰
 * 제목 상자가 26/35(웨딩노트) · 26/39(홈 · MY) · 22/28(검색) · 28/36 + 위 4 · 아래 24(Pick)로
 * 넷으로 갈려 있었다. 이제 다섯 탭이 전부 홈 브랜드 헤더 값을 쓴다.
 *
 *   줄     높이 66(최소) · 위아래 여백 0 · 세로 가운데 정렬 · SafeArea 위 끝에 바로 붙는다
 *          → 홈 정본 `home.js:288` `header`(`flex:0 0 66px;align-items:center;padding:0 20px`)
 *   제목   26 · 줄높이 39(`f26`) · 700 · 자간 -0.52(= -.02em, `home.js:289` `wordmark`)
 *   오른쪽 헤더 행동(홈 알림 벨 · 웨딩노트 「추가」)은 `right`로 받아 같은 줄 끝에 둔다
 *
 * 좌우는 그 화면 본문의 좌우 여백과 같아야 제목이 아래 카드와 한 줄에 선다 — 다섯 탭 공통
 * `ROOT_TAB_GUTTER`(20)이고, 본문 컨테이너도 같은 상수를 쓴다(아래). 정본 `wordmark` 줄높이 34는
 * 토큰이 없어 `f26` 39를 그대로 쓴다 — 66 줄 가운데 정렬이라 글자 자리는 같다.
 *
 * 제목은 화면 이름 하나뿐이다 — 서브 문구 · 개수 · 뒤로가기를 넣지 않는다(Root 1Depth).
 */
/**
 * Root 5탭(홈 · 검색 · Pick · 웨딩노트 · MY)의 좌우 여백 **20** — 제목 줄과 본문이 이 한 값을 본다.
 *
 * 2026-09-26 대표 지시 「통일해」. 정본 `home.js` · `search.js` · `pick.js` · `my.js`의 Root 화면 키가
 * `padding:0 20px`이다(`header` · `hsec` · `stickyHead` · `rScroll` 칩 줄 · `mySections` …). 하위 화면은
 * 그대로 24(`Layout.gutter`)라 **전역 토큰은 바꾸지 않고** Root 5탭만 이 상수를 쓴다. 홈의
 * `HOME_PAGE_X`(features/home/home-layout)도 이 값을 다시 내보낼 뿐이다 — 20이 두 군데 적히면 다시 갈라진다.
 */
export const ROOT_TAB_GUTTER = 20;

export function RootTabHeader({
  title,
  right,
  gutter = ROOT_TAB_GUTTER,
  style,
}: {
  title: string;
  /** 헤더 오른쪽 행동. 없으면 제목만 둔다. */
  right?: ReactNode;
  /** 좌우 여백 — 그 화면 본문의 좌우 여백과 같은 값. 기본 20(`ROOT_TAB_GUTTER`). */
  gutter?: number;
  /** 화면 고유의 바깥 장식(예: 웨딩노트 첫 방문의 아래 선)만 더한다. 크기 · 여백은 바꾸지 않는다. */
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.header, { paddingHorizontal: gutter }, style]}>
      <ThemedText type="f26" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      {right ? <View style={styles.actions}>{right}</View> : null}
    </View>
  );
}

/** 홈 정본 `header` `flex:0 0 66px`. 같은 값의 토큰이 없어 여기 한 곳에 둔다. */
export const ROOT_TAB_HEADER_HEIGHT = 66;

const styles = StyleSheet.create({
  header: {
    minHeight: ROOT_TAB_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  title: { flexShrink: 1, minWidth: 0, fontWeight: 700, letterSpacing: LetterSpacing.n052 },
  /* 홈 정본 `headIcons` — gap 4. */
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
