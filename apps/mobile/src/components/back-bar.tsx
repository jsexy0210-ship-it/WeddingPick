import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Layout, ThemedText } from '@weddingpick/ui';
import { BackButton } from '@/components/back-button';

/**
 * 화면 맨 위 뒤로가기 줄.
 *
 * **뒤로가기가 아예 없던 화면 30곳을 메우려고 만들었다**(2026-09-09 전수 조사). 2~3뎁스
 * 화면들이 헤더 없이 곧장 `SafeAreaView > ScrollView`로 시작해서, 나가는 길이 본문
 * 맨 아래 「돌아가기」 버튼뿐이었다 — 스크롤을 끝까지 내려야 보이는 출구는 출구가 아니고,
 * 데스크톱 브라우저에는 스와이프도 물리 버튼도 없다.
 *
 * `screen-kit`의 `NavBar`와 같은 치수를 쓴다(높이 56 · 좌우 nav 패딩 · gap). 다른 부품인
 * 이유는 하나다 — `NavBar`는 제목을 반드시 한 줄 차지하는데, 이 화면들은 본문이 이미
 * 제목을 들고 있어서 제목 없이 화살표만 필요한 자리가 많다.
 */
export function BackBar({
  title,
  right,
  onBack,
  variant = 'back',
}: {
  /** 없으면 화살표만 그린다 — 본문이 이미 제목을 들고 있는 화면. */
  title?: string;
  /** 오른쪽에 놓을 것(글자 액션 · 아이콘). */
  right?: ReactNode;
  /** 진짜 예외 — 화면 안에서 단계를 되돌릴 때만 넘긴다. 기본은 Depth Back이다. */
  onBack?: () => void;
  variant?: 'back' | 'close';
}) {
  return (
    <View style={styles.bar}>
      <BackButton onPress={onBack} variant={variant} />
      {title === undefined ? (
        <View style={styles.spacer} />
      ) : (
        <ThemedText type="t5" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
      )}
      {right}
    </View>
  );
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
  spacer: { flex: 1 },
});
