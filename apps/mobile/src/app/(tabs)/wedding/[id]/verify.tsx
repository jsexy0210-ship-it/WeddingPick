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
            <ThemedText type="code" themeColor="textSecondary">
              A-13 · PHASE 1
            </ThemedText>
            <ThemedText type="subtitle">인증 등급</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              실제 견적·계약자료를 확인받은 데이터만 시장 가격 계산에 들어갑니다.
            </ThemedText>
          </ThemedView>

          {set ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{set.label}</ThemedText>
              <VerificationBadge level={set.verificationLevel} />
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">등급 체계</ThemedText>
            {VERIFICATION_LEVELS.map((level) => {
              const rule = VERIFICATION_LEVEL_RULES[level];

              return (
                <ThemedView key={level} type="backgroundElement" style={styles.levelRow}>
                  <VerificationBadge level={level} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {rule.condition}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    시장 가격 반영: {rule.affectsMarketPrice ? '반영' : '미반영'}
                  </ThemedText>
                </ThemedView>
              );
            })}
          </ThemedView>

          <ThemedView style={styles.footer}>
            <ActionButton
              variant="primary"
              label="인증 신청"
              hint="증빙 확인이 서버에서 이뤄지므로 아직 접수할 수 없습니다"
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
