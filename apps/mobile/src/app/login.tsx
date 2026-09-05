import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { PROVIDER_LABEL, canSignInWith, providerTone, useAuthProviders } from '@/features/auth/providers';
import { useSignIn } from '@/features/auth/use-sign-in';

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
 *
 * **카카오가 기본, 나머지는 "다른 방법으로 로그인" 화면(`/login-other`)으로
 * 분리한다** — 화면당 Primary CTA는 1개다(CLAUDE.md §3). 카카오 자리에
 * 개발용 대체가 들어온 경우(`isDevelopmentStandIn`)에는 그걸 기본 자리에
 * 대신 놓는다 — 실제 제공자가 하나도 없는 개발 환경에서 로그인 버튼이
 * 통째로 다음 화면 뒤로 숨는 것을 막는다.
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, busy, error } = useSignIn();

  const featured = providers?.find((provider) => provider.provider === 'kakao') ?? providers?.[0] ?? null;
  const others = providers?.filter((provider) => provider !== featured) ?? [];

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
              {featured ? (
                <ActionButton
                  key={featured.provider}
                  variant="primary"
                  size="xlarge"
                  tone={providerTone(featured)}
                  label={
                    featured.isDevelopmentStandIn ? '개발용 로그인' : PROVIDER_LABEL[featured.provider]
                  }
                  hint={
                    featured.isDevelopmentStandIn
                      ? '실제 애플·카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                      : undefined
                  }
                  disabled={busy || !canSignInWith(featured)}
                  onPress={() => signIn(featured)}
                />
              ) : null}

              {others.length > 0 ? (
                <ActionButton
                  variant="secondary"
                  size="xlarge"
                  label="다른 방법으로 로그인"
                  disabled={busy}
                  onPress={() => router.push('/login-other')}
                />
              ) : null}
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
