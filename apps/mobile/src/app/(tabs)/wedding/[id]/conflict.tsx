import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

const KIND_LABEL: Record<string, string> = {
  task: '준비 항목',
  event: '일정',
  expense: '지출내역',
  candidate: '담아둔 업체',
  memo: '메모',
};

/**
 * WP-CPL-005: 공동 편집 충돌 화면.
 *
 * 두 파트너가 같은 항목을 동시에 수정하면 서버가 `conflict` 오류를 돌려준다.
 * 부르는 화면이 오류를 받아 이 화면으로 보낸다. 여기서 결론을 내리고 돌아간다.
 *
 * 이 화면 자체는 API를 부르지 않는다. 해결은 "돌아가서 새로고침"이고,
 * 부모 화면은 `useFocusEffect`로 다시 로드한다.
 */
export default function ConflictScreen() {
  const {
    kind = '',
    label = '',
    conflictMessage = '',
  } = useLocalSearchParams<{
    id: string;
    kind?: string;
    label?: string;
    conflictMessage?: string;
  }>();

  const theme = useTheme();
  const kindLabel = KIND_LABEL[kind] ?? '항목';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView
            style={[styles.iconBox, { backgroundColor: theme.cautionaryBackground }]}
          >
            <ThemedText type="t4" themeColor="cautionary">
              ⚠
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t2">편집이 겹쳤어요</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              배우자가 같은 {kindLabel}을(를) 동시에 수정해서 변경 내용이 충돌했어요.
            </ThemedText>
          </ThemedView>

          {label ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textAssistive">
                충돌한 {kindLabel}
              </ThemedText>
              <ThemedText type="t5">{label}</ThemedText>
            </ThemedView>
          ) : null}

          {conflictMessage ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textAssistive">
                서버 안내
              </ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                {conflictMessage}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6">
              새로고침하면 현재 저장된 내용을 볼 수 있어요. 다시 수정하고 싶으시면
              새로고침 후 편집을 눌러주세요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.actions}>
            <ActionButton
              variant="primary"
              label="새로고침해서 볼게요"
              hint="현재 저장된 내용으로 돌아가요"
              onPress={() => router.back()}
            />
            <ActionButton label="그만두기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
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
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  actions: {
    gap: Spacing.two,
  },
});
