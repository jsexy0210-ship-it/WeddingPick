import type { AuthProvider } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { completeAfterSignIn } from '@/features/auth/after-sign-in';
import {
  PROVIDER_LABEL,
  canSignInWith,
  signInWith,
  useAuthProviders,
} from '@/features/auth/providers';

/** 로그인이 무엇을 위한 것인지. 계정을 요구하는 이유를 먼저 말한다. */
const REASONS = [
  '분석한 자료를 기기를 바꿔도 다시 볼 수 있어요.',
  '자료 확인을 신청하고 진행 상황을 받아볼 수 있습니다.',
  '촬영과 기기 저장은 로그인 없이도 됩니다.',
];

/**
 * A-02 로그인/가입.
 *
 * 이 앱은 로그인을 앞세우지 않는다. 촬영과 기기 저장은 계정 없이 되고, 서버가 필요한
 * 순간에만 여기로 온다.
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSignIn(provider: AuthProvider) {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await signInWith(provider);
      /*
       * 로그인 전에 기기에 적어둔 최소 온보딩과 멈춰둔 Pick을 여기서도 마친다.
       * 시트에서만 하면, 이 화면으로 로그인한 사람의 예식일은 서버에 영영 안 올라간다.
       */
      const after = await completeAfterSignIn();

      /*
       * 아직 가입이 끝나지 않았다(v3.13 §N-2). 여기서 그냥 돌아가면 서버가
       * 모든 경로를 막은 계정으로 앱을 쓰게 되고, 사용자는 로그인이 됐는데
       * 아무것도 안 되는 화면을 본다.
       */
      if (after.needsSignup) {
        router.replace('/signup');

        return;
      }

      router.back();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="title">로그인</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              자료를 분석하려면 계정이 필요해요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            {REASONS.map((reason) => (
              <ThemedView key={reason} type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {reason}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {providers === null ? (
            <ActivityIndicator color={theme.tint} />
          ) : providers.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                지금은 로그인할 수 없습니다. 촬영과 기기 저장은 그대로 쓰실 수 있습니다.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.section}>
              {providers.map((provider) => (
                <ActionButton
                  key={provider.provider}
                  variant={provider.isDevelopmentStandIn ? 'secondary' : 'primary'}
                  label={
                    provider.isDevelopmentStandIn
                      ? '개발용 로그인'
                      : PROVIDER_LABEL[provider.provider]
                  }
                  hint={
                    provider.isDevelopmentStandIn
                      ? '실제 애플·카카오 로그인이 아닙니다. 개발 중인 서버에만 있습니다'
                      : undefined
                  }
                  disabled={busy || !canSignInWith(provider)}
                  onPress={() => startSignIn(provider)}
                />
              ))}
            </ThemedView>
          )}

          {error ?? loadError ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error ?? loadError}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ActionButton label="나중에 하기" onPress={() => router.back()} />
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
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
