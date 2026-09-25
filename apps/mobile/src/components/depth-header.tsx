import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Border, Layout, ThemedText, useTheme } from '@weddingpick/ui';
import { BackButton, TOUCH_SLOT_SIZE } from '@/components/back-button';

export function DepthHeader({
  title,
  right,
  onBack,
  variant = 'back',
}: {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
  variant?: 'back' | 'close';
}) {
  const theme = useTheme();
  const pathname = usePathname();
  const resolvedTitle = title ?? depthHeaderTitle(pathname);

  return (
    <View style={[styles.bar, { borderBottomColor: theme.border }]}>
      <BackButton onPress={onBack} variant={variant} />
      <ThemedText type="f16" numberOfLines={1} style={styles.title}>
        {resolvedTitle}
      </ThemedText>
      {right ?? <View style={styles.pad} />}
    </View>
  );
}
function depthHeaderTitle(pathname: string): string {
  const rules: readonly [RegExp, string][] = [
    [/^\/my\/guide(?:\/|$)/, '고객지원'],
    [/^\/my\/privacy(?:\/|$)/, '개인정보처리방침'],
    [/^\/my\/settings(?:\/|$)/, '설정'],
    [/^\/my\/contact(?:\/|$)/, '문의하기'],
    [/^\/my\/rebuttals(?:\/|$)/, '후기 반론'],
    [/^\/my\/vendor-claims(?:\/|$)/, '업체 관계자 인증'],
    [/^\/my\/biz\/claim(?:\/|$)/, '업체 인증'],
    [/^\/my\/biz\/data(?:\/|$)/, '자료 제공'],
    [/^\/my\/biz\/benefit(?:\/|$)/, '혜택 등록'],
    [/^\/feed(?:\/|$)/, '웨딩피드'],
    [/^\/recommendations(?:\/|$)/, '웨딩픽 추천'],
    [/^\/pick\/category(?:\/|$)/, 'Pick'],
    [/^\/search\/autocomplete(?:\/|$)/, '검색'],
    [/^\/search\/expo(?:\/|$)/, '박람회'],
    [/^\/search\/wedding-info(?:\/|$)/, '웨딩 정보'],
    [/^\/search\/[^/]+\/reviews(?:\/|$)/, '후기'],
    [/^\/wedding\/[^/]+\/map(?:\/|$)/, '업체 위치'],
    [/^\/wedding\/[^/]+\/tasks(?:\/|$)/, '웨딩 스케줄'],
    [/^\/wedding\/[^/]+\/verify(?:\/|$)/, '자료 확인'],
    [/^\/wedding\/[^/]+\/quotes(?:\/|$)/, '자료 목록'],
    [/^\/wedding\/[^/]+(?:\/|$)/, '웨딩노트'],
    [/^\/capture\/analysis(?:\/|$)/, '자료 확인 중'],
    [/^\/capture(?:\/|$)/, 'Pick 인증'],
  ];

  return rules.find(([pattern]) => pattern.test(pathname))?.[1] ?? '';
}

/*
 * RN 정본 공통 뒤로 헤더 — `common.js:396~398` · `search.js:240~241` · `pick.js:90~91` · `note.js:93~94` ·
 * `my.js:168~169` · `home.js:641~642` 여섯 보드가 같은 값이다(2026-09-25 common 픽셀 대조).
 *   navBar    높이 56 · padding 0 16 · gap 8 · 아래 1px BORDER(#eaebee, inset — 높이 안)
 *   navTitle  flex 1 · 가운데 · 16 · 700 · INK · 한 줄 말줄임
 *   navPad    오른쪽 동작이 없으면 36 빈 칸 — 제목이 화면 가운데 앉는다
 * 전에는 왼쪽 12 · 오른쪽 20 · 제목 18/24 왼쪽 정렬 · 아래 선 없음이었다.
 */
const styles = StyleSheet.create({
  bar: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.navPaddingRight,
    gap: Layout.navGap,
    borderBottomWidth: Border.hairline,
  },
  title: { flex: 1, minWidth: 0, textAlign: 'center', fontWeight: '700' },
  /* 왼쪽 BackButton과 같은 폭이어야 제목이 실제로 가운데 앉는다 — back-button.tsx의 TOUCH_SLOT_SIZE(36) 그대로. */
  pad: { width: TOUCH_SLOT_SIZE },
});
