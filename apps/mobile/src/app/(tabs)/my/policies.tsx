import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type PolicyStatus = '자문 대기' | '작성 필요' | '초안 게시';

const POLICIES: { title: string; status: PolicyStatus; note: string }[] = [
  {
    title: '이용약관',
    status: '자문 대기',
    note: '초안은 작성됐지만 법률 자문 전이라 게시하지 않습니다.',
  },
  {
    title: '개인정보처리방침',
    status: '작성 필요',
    note: 'AI 문서분석과 배우자 데이터 공유 항목을 포함해 작성해야 합니다.',
  },
  {
    title: 'AI 안내',
    status: '초안 게시',
    note: 'AI 처리 방식과 한계를 앱 안에서 안내합니다. 법률 검토 후 확정합니다.',
  },
];

/**
 * A-15 정책.
 *
 * 이용약관 초안은 "법률 자문 전 게시 금지"라 앱에 싣지 않는다. 자리와 상태만 두고,
 * 자문이 끝나면 확정본을 여기에 넣는다.
 */
export default function PoliciesScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="code" themeColor="textSecondary">
              A-15 · PHASE 1
            </ThemedText>
            <ThemedText type="subtitle">약관 및 정책</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              서비스 오픈 전까지 확정해야 하는 문서들입니다. 아직 확정본이 없어 상태만
              표시합니다.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.list}>
            {POLICIES.map((policy) => (
              <ThemedView key={policy.title} type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{policy.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {policy.status} · {policy.note}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          <ActionButton
            variant="primary"
            label="AI 안내 보기"
            onPress={() => router.push('/my/guide')}
          />
          <ActionButton label="돌아가기" onPress={() => router.back()} />
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
