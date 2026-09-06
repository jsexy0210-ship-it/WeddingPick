import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, Colors, MaxContentWidth, Spacing, ThemedText, ThemedView, Toast } from '@weddingpick/ui';
import { requestPasswordReset } from '@/api/client';
import { AuthBackButton } from '@/features/auth/auth-back-button';

const STEPS = ['메일에서 링크를 눌러주세요', '새 비밀번호를 만들어주세요', '웨딩픽으로 돌아와 로그인해주세요'];

/**
 * WP-AUTH-007 메일 보냈어요. `forgot-password.tsx`가 성공하든(계정 있음)
 * 조용히 아무 일도 안 하든(계정 없음) 항상 이 화면으로 온다 — 등록 여부를
 * 드러내지 않는다는 규칙이 화면 하나로 끝난다.
 */
export default function EmailSentScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function resend() {
    if (resending) return;
    setResending(true);

    try {
      await requestPasswordReset(email);
      setToast('메일을 다시 보냈어요');
    } catch {
      setToast('메일을 다시 보내지 못했어요');
    } finally {
      setResending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <AuthBackButton variant="close" onPress={() => router.replace('/login')} />
        </View>

        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <View style={[styles.iconWrap, { backgroundColor: Colors.light.tintSubtle }]}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 6.5h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-11Z"
                  stroke={Colors.light.tint}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <Path d="M4.5 7l7.5 6 7.5-6" stroke={Colors.light.tint} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>

            <ThemedText type="t1">
              메일을{'\n'}보냈어요
            </ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {email} 으로 링크를 보냈어요
            </ThemedText>

            <View style={styles.steps}>
              {STEPS.map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View style={[styles.stepBadge, { backgroundColor: Colors.light.tintSubtle }]}>
                    <ThemedText type="t7" themeColor="tint">
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText type="t6" themeColor="textSecondary" style={styles.stepText}>
                    {step}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.authBlock}>
            <ActionButton
              variant="secondary"
              size="xlarge"
              label={resending ? '다시 보내는 중…' : '다시 보내기'}
              disabled={resending}
              onPress={resend}
            />
            <ActionButton
              variant="primary"
              size="xlarge"
              label="메일 앱 열기"
              onPress={() => {
                Linking.openURL('mailto:').catch(() => setToast('메일 앱을 열지 못했어요'));
              }}
            />
          </View>
        </View>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, alignItems: 'flex-end' },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  brandBlock: { gap: Spacing.four, paddingTop: Spacing.five },
  authBlock: { flexGrow: 0, flexShrink: 0, gap: Spacing.two },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: { gap: Spacing.two },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },
});
