import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { signInWithEmail } from '@/api/client';
import { AuthBackButton } from '@/features/auth/auth-back-button';
import { AuthTextField } from '@/features/auth/auth-text-field';
import { finishSignIn } from '@/features/auth/finish-sign-in';

/**
 * WP-AUTH-003 비밀번호 입력(기존 계정) / WP-AUTH-005 입력 오류는 같은 화면의
 * 상태다 — 틀리면 화면을 바꾸지 않고 필드 아래 오류만 켠다. 서버가 남은
 * 시도 횟수를 메시지에 담아 보낸다(`5번 더 시도할 수 있어요`) — 화면이
 * 숨기지 않는다.
 */
export default function LoginPasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    setError(null);

    try {
      await signInWithEmail(email, password);
      await finishSignIn({ provider: 'email', email });
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
            <AuthBackButton onPress={() => router.back()} />
          </View>

          <View style={styles.content}>
            <View style={styles.brandBlock}>
              <ThemedText type="t1">
                비밀번호를{'\n'}입력해주세요
              </ThemedText>

              <Pressable onPress={() => router.back()} style={styles.emailRow}>
                <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1} style={styles.emailText}>
                  {email}
                </ThemedText>
                <ThemedText type="t7" themeColor="tint">
                  바꾸기
                </ThemedText>
              </Pressable>

              <AuthTextField
                label="비밀번호"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                secure
                autoFocus
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={submit}
                error={error}
              />

              <Pressable
                onPress={() => router.push({ pathname: '/login/forgot-password', params: { email } })}
                hitSlop={4}>
                <ThemedText type="t7" themeColor="textSecondary">
                  비밀번호를 잊었나요
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.authBlock}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={busy ? '확인하는 중…' : '로그인'}
                disabled={!password || busy}
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
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  brandBlock: { gap: Spacing.four, paddingTop: Spacing.five },
  authBlock: { flexGrow: 0, flexShrink: 0 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: -Spacing.two },
  emailText: { flex: 1 },
});
