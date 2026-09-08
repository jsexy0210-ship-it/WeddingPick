import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { completeAfterSignIn, type AfterSignIn } from '@/features/auth/after-sign-in';
import { canSignInWith, signInWithKakao, useAuthProviders } from '@/features/auth/providers';

export type LoginSheetProps = {
  visible: boolean;
  /**
   * 왜 지금 로그인이 필요한지 한 줄. 화면이 준다.
   *
   * 이 시트는 하려던 일 위에 덮이므로, "로그인이 필요합니다"만 적으면 사용자는
   * 방금 무엇을 눌렀는지 다시 떠올려야 한다.
   */
  reason: string;
  /** 로그인이 끝나고 멈췄던 일까지 마친 뒤. 화면이 자기 상태를 다시 읽는다. */
  onSignedIn: (result: AfterSignIn) => void;
  onDismiss: () => void;
};

/**
 * 로그인 Bottom Sheet. 통합정책 v3.10 §3·§8.
 *
 * 화면을 **떠나지 않는다**. 로그인 화면으로 밀어내면 돌아왔을 때 보던 업체도
 * 스크롤 위치도 사라지고, 사용자는 처음부터 다시 찾아와야 한다. 정책이 "맥락을
 * 유지하는 하단 Sheet를 우선한다"고 적은 것이 이 뜻이다.
 *
 * 닫기를 막지 않는다. 지연 로그인은 로그인을 미룰 수 있다는 약속이고, 시트가
 * 안 닫히면 그 약속이 거짓이 된다.
 */
export function LoginSheet({ visible, reason, onSignedIn, onDismiss }: LoginSheetProps) {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(index: number) {
    const provider = providers?.[index];

    if (busy || !provider) return;

    setBusy(true);
    setError(null);

    try {
      await signInWithKakao(provider);
      /*
       * 로그인만 하고 시트를 닫으면 사용자가 누른 Pick은 여전히 안 담겨 있다.
       * 멈췄던 일을 여기서 마친 뒤에야 닫는다.
       */
      onSignedIn(await completeAfterSignIn());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        {/*
          시트 밖을 누르면 닫힌다. 화면 위를 덮은 것이라 뒤로 나갈 길이 있어야 한다.

          시트를 이 안에 넣지 않고 **형제로 둔다.** 누름이 위로 새는 것을 막으려고
          시트를 다시 Pressable로 감싸면 웹에서 button 안에 button이 들어가고,
          그건 브라우저가 고쳐 그리는 잘못된 문서다.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onDismiss}
        />

        <ThemedView style={styles.sheet}>
          <ThemedView style={styles.headline}>
            <ThemedText type="t4">로그인하고 이어서 해요</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {reason}
            </ThemedText>
          </ThemedView>

          {providers === null ? (
            <DelayedLoader size={28} />
          ) : providers.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                지금은 로그인할 수 없어요. 검색과 상세는 그대로 보실 수 있어요.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.actions}>
              {providers.map((provider, index) => (
                <ActionButton
                  key={provider.provider}
                  variant={provider.isDevelopmentStandIn ? 'secondary' : 'primary'}
                  label={provider.isDevelopmentStandIn ? '개발용 로그인' : '카카오로 시작하기'}
                  hint={
                    provider.isDevelopmentStandIn
                      ? '실제 카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                      : undefined
                  }
                  disabled={busy || !canSignInWith(provider)}
                  onPress={() => void start(index)}
                />
              ))}
            </ThemedView>
          )}

          {error ?? loadError ? (
            <ThemedText type="t7" themeColor="negative">
              {error ?? loadError}
            </ThemedText>
          ) : null}

          <ActionButton label="나중에 하기" disabled={busy} onPress={onDismiss} />
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  headline: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three },
  actions: { gap: Spacing.two },
});
