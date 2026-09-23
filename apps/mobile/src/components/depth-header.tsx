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

  return (
    <View style={styles.bar}>
      <BackButton onPress={onBack} variant={variant} />
      <ThemedText type="t5" numberOfLines={1} style={styles.title}>
        {resolvedTitle}
      </ThemedText>
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
});
