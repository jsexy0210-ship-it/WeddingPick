import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { lookupEmail } from '@/api/client';
import { AuthBackButton } from '@/features/auth/auth-back-button';
import { AuthTextField } from '@/features/auth/auth-text-field';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * WP-AUTH-002 이메일 입력. **가입과 로그인을 사용자가 고르지 않는다** —
 * 이메일 하나로 서버(`/v1/auth/email/lookup`)가 계정 존재 여부를 판정해서
 * 다음 화면(비밀번호 입력 / 비밀번호 만들기)을 정한다.
 */
export default function LoginEmailScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = email.trim();
  const valid = EMAIL_PATTERN.test(trimmed);

  async function next() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);

    try {
      const { exists } = await lookupEmail(trimmed);

      router.push({
        pathname: exists ? '/login/password' : '/login/create-password',
        params: { email: trimmed },
      });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <AuthBackButton onPress={() => router.back()} />
          </View>

          <View style={styles.content}>
            <View style={styles.brandBlock}>
              <ThemedText type="t1">
                이메일을{'\n'}알려주세요
              </ThemedText>

              <AuthTextField
                label="이메일"
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoComplete="email"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={next}
                error={error}
              />
            </View>

            <View style={styles.authBlock}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={busy ? '확인하는 중…' : '다음'}
                disabled={!valid || busy}
                onPress={next}
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
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  brandBlock: { gap: Spacing.four, paddingTop: Spacing.five },
  authBlock: { flexGrow: 0, flexShrink: 0 },
});
