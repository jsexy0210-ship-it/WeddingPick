import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { PROVIDER_LABEL, canSignInWith, useAuthProviders } from '@/features/auth/providers';
import { useSignIn } from '@/features/auth/use-sign-in';

/**
 * `/login`의 "다른 방법으로 로그인" 다음 화면. Apple·Google·네이버(+개발용
 * 대체)를 여기 모은다.
 *
 * `/login`이 하는 필터의 반대만 한다 — 거기서 뺀 카카오(또는 그 자리를
 * 대신한 개발용 대체)를 제외한 나머지 전부. 목록 자체는 `useAuthProviders`
 * 한 곳에서만 읽는다 — 두 화면이 서로 다른 소스를 읽으면 한쪽만 새 제공자가
 * 뜨는 날이 온다.
 */
export default function LoginOtherScreen() {
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
            <ThemedText type="title">다른 방법으로 로그인</ThemedText>
          </ThemedView>

          {providers === null ? (
            <ActivityIndicator color={theme.tint} />
          ) : others.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                지금은 다른 로그인 방법이 없어요.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.section}>
              {others.map((provider) => (
                <ActionButton
                  key={provider.provider}
                  variant="secondary"
                  label={
                    provider.isDevelopmentStandIn ? '개발용 로그인' : PROVIDER_LABEL[provider.provider]
                  }
                  hint={
                    provider.isDevelopmentStandIn
                      ? '실제 애플·카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                      : undefined
                  }
                  disabled={busy || !canSignInWith(provider)}
                  onPress={() => signIn(provider)}
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
