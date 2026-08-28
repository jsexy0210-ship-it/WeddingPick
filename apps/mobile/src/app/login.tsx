import type { AuthProvider } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listAuthProviders, signIn } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { DEV_LOGIN_SECRET, devIdToken } from '@/features/auth/dev-login';

const PROVIDER_LABEL = {
  apple: 'Apple로 계속하기',
  kakao: '카카오로 계속하기',
} as const;

/** 로그인이 무엇을 위한 것인지. 계정을 요구하는 이유를 먼저 말한다. */
const REASONS = [
  '분석한 견적을 기기를 바꿔도 다시 볼 수 있습니다.',
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
  // 서버 주소가 없으면 물어볼 곳도 없다. 처음부터 빈 목록으로 시작한다.
  const [providers, setProviders] = useState<AuthProvider[] | null>(
    isServerConfigured ? null : []
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isServerConfigured) {
      return;
    }

    listAuthProviders()
      .then((response) => setProviders(response.providers))
      .catch((caught: Error) => {
        setProviders([]);
        setError(caught.message);
      });
  }, []);

  async function startSignIn(provider: AuthProvider) {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (!provider.isDevelopmentStandIn) {
        // 제공자 SDK는 클라이언트 ID가 나온 뒤에 붙인다. 그 전까지 버튼은 눌리지 않는다.
        throw new Error('아직 준비 중입니다.');
      }

      await signIn(provider.provider, devIdToken());
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
              견적서를 분석하려면 계정이 필요합니다.
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
                  disabled={busy || (provider.isDevelopmentStandIn && !DEV_LOGIN_SECRET)}
                  onPress={() => startSignIn(provider)}
                />
              ))}
            </ThemedView>
          )}

          {error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
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
