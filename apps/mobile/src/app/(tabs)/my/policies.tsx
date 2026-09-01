import { POLICY_DOCUMENTS, withdrawalNotice } from '@weddingpick/domain';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

/**
 * A-15 정책.
 *
 * 이용약관 초안은 "법률 자문 전 게시 금지"라 앱에 싣지 않는다. 자리와 상태만 두고,
 * 자문이 끝나면 확정본을 여기에 넣는다.
 *
 * 목록은 @weddingpick/domain에 있다 — 웹 랜딩이 같은 것을 본다. 한쪽에서만
 * "게시됨"으로 바뀌면 어느 쪽이 맞는지 아무도 모르게 된다.
 */
export default function PoliciesScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">약관 및 정책</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              서비스 오픈 전까지 확정해야 하는 문서들입니다. 아직 확정본이 없어 상태만
              표시합니다.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.list}>
            {POLICY_DOCUMENTS.map((policy) => (
              <ThemedView key={policy.id} type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{policy.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {policy.status} · {policy.note}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {/*
            탈퇴하면 낸 자료가 어떻게 되는지. **문장을 여기서 짓지 않는다** —
            개인정보처리방침이 답할 질문이고, 방침이 확정되기 전에 화면이 먼저
            답하면 근거 없는 약속이 된다. 확정 전에는 아직 안내드릴 수 없다고 적는다.
           */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">탈퇴하면 낸 자료는요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {withdrawalNotice()}
            </ThemedText>
          </ThemedView>

          <ActionButton
            variant="primary"
            label="분석 안내 보기"
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
