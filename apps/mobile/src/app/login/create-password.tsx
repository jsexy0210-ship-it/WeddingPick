import { checkPassword, isPasswordValid } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { createEmailAccount } from '@/api/client';
import { AuthBackButton } from '@/features/auth/auth-back-button';
import { AuthTextField } from '@/features/auth/auth-text-field';
import { finishSignIn } from '@/features/auth/finish-sign-in';

/**
 * WP-AUTH-004 비밀번호 만들기(신규 계정). 조건 3개는 입력하는 동안 하나씩
 * 켜진다(`@weddingpick/domain`의 `PASSWORD_RULES` — 서버 검증과 같은 표를
 * 본다). 비밀번호 확인 입력은 받지 않는다 — 눈 아이콘으로 직접 보게 한다.
 */
export default function LoginCreatePasswordScreen() {
  const theme = useTheme();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = checkPassword(password);
  const valid = isPasswordValid(password);

  async function next() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);

    try {
      await createEmailAccount(email, password);
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
                비밀번호를{'\n'}만들어주세요
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
                autoComplete="password-new"
                returnKeyType="done"
                onSubmitEditing={next}
                error={error}
              />

              <View style={styles.rules}>
                {rules.map((rule) => (
                  <View key={rule.key} style={styles.ruleRow}>
                    <RuleCheck ok={rule.ok} color={theme.tint} mutedColor={theme.border} />
                    <ThemedText type="t7" themeColor={rule.ok ? 'text' : 'textAssistive'}>
                      {rule.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.authBlock}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={busy ? '가입하는 중…' : '다음'}
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

function RuleCheck({ ok, color, mutedColor }: { ok: boolean; color: string; mutedColor: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5l4.5 4.5L19 7"
        stroke={ok ? color : mutedColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
  rules: { gap: Spacing.one },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
