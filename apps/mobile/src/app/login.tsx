import type { AuthProvider } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { getCurrentUser } from '@/api/client';
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
  '자료 확인을 신청하고 진행 상황을 받아볼 수 있어요.',
  '배우자와 함께 준비 상황을 나눠볼 수 있어요.',
];

/**
 * A-02 로그인/가입.
 *
 * 2026-09-04 정책 변경 — 비회원 진입 삭제. 스플래시(온보딩 소개) 다음은
 * 이 화면이고, 로그인해야만 앱으로 넘어간다. `_layout.tsx`의 진입 로직이
 * 비로그인 상태면 항상 이 화면으로 보낸다 — 뒤에 아무것도 없으니 "나중에
 * 하기"로 건너뛸 수 없다.
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

      /*
       * 방금 만든 웨딩(완료 처리)이거나, 이전에 이미 만들어둔 계정으로 다시
       * 로그인한 경우 둘 다 있다 — 서버에 다시 물어봐서 정한다.
       */
      const me = await getCurrentUser().catch(() => null);

      router.replace(me?.setupComplete || after.savedWedding ? '/(tabs)' : '/setup');
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
                지금은 로그인할 수 없어요. 잠시 후 다시 시도해주세요.
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
                      ? '실제 애플·카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
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
