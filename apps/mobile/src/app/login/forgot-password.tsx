import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { requestPasswordReset } from '@/api/client';
import { AuthBackButton } from '@/features/auth/auth-back-button';
import { AuthTextField } from '@/features/auth/auth-text-field';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * WP-AUTH-006 비밀번호 찾기. 계정 존재 여부를 여기서 드러내지 않는다 — 서버가
 * 있든 없든 항상 성공(204)으로 답하고, 다음 화면은 늘 "메일을 보냈어요"다.
 * 새 비밀번호는 이 화면이 아니라 메일 링크로 웹에서 만든다.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = email.trim();
  const valid = EMAIL_PATTERN.test(trimmed);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);

    try {
      await requestPasswordReset(trimmed);
      router.push({ pathname: '/login/email-sent', params: { email: trimmed } });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <AuthBackButton variant="close" onPress={() => router.replace('/login')} />
          </View>

          <View style={styles.content}>
            <View style={styles.brandBlock}>
              <ThemedText type="t1">
                가입한 이메일을{'\n'}알려주세요
              </ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                비밀번호를 다시 만들 수 있는 링크를 보내드려요
              </ThemedText>

              <AuthTextField
                label="이메일"
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoComplete="email"
                autoFocus={!params.email}
                returnKeyType="done"
                onSubmitEditing={submit}
                error={error}
              />

              <ThemedView type="backgroundElement" style={styles.tip}>
                <ThemedText type="t7">메일이 안 보이면</ThemedText>
                <ThemedText type="t7" themeColor="textSecondary">
                  스팸함을 확인해주세요. 링크는 30분 동안 쓸 수 있어요
                </ThemedText>
              </ThemedView>
            </View>

            <View style={styles.authBlock}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={busy ? '보내는 중…' : '링크 받기'}
                disabled={!valid || busy}
                onPress={submit}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, alignItems: 'flex-end' },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  brandBlock: { gap: Spacing.four, paddingTop: Spacing.five },
  authBlock: { flexGrow: 0, flexShrink: 0 },
  tip: { borderRadius: Radius.medium, padding: Spacing.three, gap: 2 },
});
