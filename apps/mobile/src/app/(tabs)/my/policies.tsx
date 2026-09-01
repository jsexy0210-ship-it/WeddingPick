import { POLICY_DOCUMENTS, WITHDRAWAL_ANON_SECTION, withdrawalNotice } from '@weddingpick/domain';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

export default function PoliciesScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">약관 및 정책</ThemedText>

          <ThemedView style={styles.list}>
            {POLICY_DOCUMENTS.map((policy) => (
              <ThemedView key={policy.id} type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{policy.title}</ThemedText>
                {!policy.url && (
                  <ThemedText type="small" themeColor="textAssistive">
                    준비 중
                  </ThemedText>
                )}
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">탈퇴하면 낸 자료는요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {withdrawalNotice()}
            </ThemedText>
            <ThemedView style={styles.anonSection}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.anonTitle}>
                {WITHDRAWAL_ANON_SECTION.title}
              </ThemedText>
              {WITHDRAWAL_ANON_SECTION.items.map((item) => (
                <ThemedText key={item} type="small" themeColor="textSecondary">
                  · {item}
                </ThemedText>
              ))}
              <ThemedText type="small" themeColor="textAssistive" style={styles.anonFooter}>
                {WITHDRAWAL_ANON_SECTION.footer}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ActionButton
            variant="primary"
            label="분석 안내 보기"
            onPress={() => router.push('/my/guide')}
          />
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
  list: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  anonSection: {
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  anonTitle: {
    fontWeight: '600',
  },
  anonFooter: {
    marginTop: Spacing.one,
  },
});
