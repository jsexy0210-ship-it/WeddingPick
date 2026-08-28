import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, VerificationBadge } from '@weddingpick/ui';
import { useDocumentStore } from '@/features/documents/document-store';
import { VERIFICATION_LEVELS, VERIFICATION_LEVEL_RULES } from '@weddingpick/domain';

/**
 * 확인 단계 안내.
 *
 * 여기는 기기에 저장만 해둔 문서를 보는 자리다. 신청은 분석까지 끝난 문서에서만
 * 할 수 있으므로(증빙이 서버에 있어야 한다) 여기서는 단계가 무엇인지만 알려주고
 * 분석으로 보낸다.
 */
export default function VerifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sets } = useDocumentStore();
  const set = sets.find((item) => item.id === id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">자료 확인</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              실제 견적서·계약서를 확인받은 자료만 가격 비교의 기준이 됩니다. 확인 단계가
              올라갈수록 다른 분들의 비교에도 더 큰 몫으로 반영됩니다.
            </ThemedText>
          </ThemedView>

          {set ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{set.label}</ThemedText>
              <VerificationBadge level={set.verificationLevel} />
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">확인 단계</ThemedText>
            {VERIFICATION_LEVELS.map((level) => {
              const rule = VERIFICATION_LEVEL_RULES[level];

              return (
                <ThemedView key={level} type="backgroundElement" style={styles.levelRow}>
                  <VerificationBadge level={level} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {rule.condition}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {rule.affectsMarketPrice
                      ? '가격 비교의 기준이 됩니다'
                      : '아직 가격 비교에는 쓰이지 않습니다'}
                  </ThemedText>
                </ThemedView>
              );
            })}
          </ThemedView>

          <ThemedView style={styles.footer}>
            <ActionButton
              variant="primary"
              label="이 문서 분석하기"
              hint="분석을 마치면 자료 확인을 신청할 수 있습니다"
              onPress={() => router.push('/capture')}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
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
    paddingHorizontal: Spacing.four,
  },
  content: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  levelRow: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  footer: {
    gap: Spacing.two,
  },
});
