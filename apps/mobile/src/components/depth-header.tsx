import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Layout, ThemedText } from '@weddingpick/ui';
import { BackButton } from '@/components/back-button';

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
  const pathname = usePathname();
  const resolvedTitle = title ?? depthHeaderTitle(pathname);
  const isFullPopup = variant === 'close';

  return (
    <View style={styles.bar}>
      <BackButton onPress={onBack} variant={variant} />
      {isFullPopup ? (
        /*
          v3.28(CLAUDE.md 「풀팝업」 행) — 풀팝업 헤더는 좌측 X 닫기 + 중앙 타이틀이다.
          오른쪽에 액션(`right`)이 붙는 화면도 있어 좌우 폭이 다를 수 있으므로, `flex:1`
          정렬 대신 막대 전체 폭 기준 절대 배치로 실제 가운데에 앉힌다. `grow`는 기존
          `right ?? null`을 막대 오른쪽 끝으로 미는 빈 자리를 그대로 잇는다.
        */
        <>
          <View style={styles.grow} />
          <View style={styles.centerLayer} pointerEvents="none">
            <ThemedText type="t5" numberOfLines={1} style={styles.centerTitle}>
              {resolvedTitle}
            </ThemedText>
          </View>
        </>
      ) : (
        <ThemedText type="t5" numberOfLines={1} style={styles.title}>
          {resolvedTitle}
        </ThemedText>
      )}
      {right ?? null}
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
    [/^\/top3(?:\/|$)/, 'TOP 3'],
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

const styles = StyleSheet.create({
  bar: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.navPaddingRight,
    gap: Layout.navGap,
  },
  title: { flex: 1, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  centerLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  centerTitle: { maxWidth: '60%', textAlign: 'center' },
});
