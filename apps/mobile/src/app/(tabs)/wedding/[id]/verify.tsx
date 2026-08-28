import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerificationBadge } from '@/components/verification-badge';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDocumentStore } from '@/features/documents/document-store';
import { VERIFICATION_LEVELS, VERIFICATION_LEVEL_RULES } from '@weddingpick/domain';

/**
 * A-13 인증 신청.
 *
 * 등급 판정은 증빙 재검토가 필요해 서버 몫이다(서비스정책서 2번). 서버가 붙기 전까지는
 * 등급 체계와 현재 상태만 보여주고 접수는 막아둔다.
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
              label="인증 신청"
              hint="자료 확인 절차를 준비하고 있습니다. 곧 신청하실 수 있습니다"
              disabled
              onPress={() => {}}
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
