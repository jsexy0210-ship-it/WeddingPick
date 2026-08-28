import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Props = {
  /** docs/05-product-spec.md 2번 화면 목록의 ID (예: A-03) */
  screenId: string;
  title: string;
  /** 이 화면이 속한 Phase. 1이 아니면 아직 구현 대상이 아니다. */
  phase: 1 | 2 | 3 | 4;
  /** 화면이 담을 내용. 명세 2번 표의 "내용" 열. */
  summary: string;
};

/**
 * 아직 구현되지 않은 화면 자리. 실제 화면이 붙으면 이 컴포넌트 사용을 지운다.
 */
export function ScreenPlaceholder({ screenId, title, phase, summary }: Props) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="code" themeColor="textSecondary">
            {screenId} · PHASE {phase}
          </ThemedText>
          <ThemedText type="subtitle">{title}</ThemedText>
        </ThemedView>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {summary}
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
});
