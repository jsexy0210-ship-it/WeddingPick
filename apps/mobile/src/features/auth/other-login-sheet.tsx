import type { AuthProvider } from '@weddingpick/api-contract';
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
import { PROVIDER_LABEL, canSignInWith, providerTone } from '@/features/auth/providers';

export type OtherLoginSheetProps = {
  visible: boolean;
  providers: AuthProvider[];
  busy: boolean;
  error: string | null;
  onSelect: (provider: AuthProvider) => void;
  onDismiss: () => void;
};

/**
 * `/login`의 "다른 방법으로 로그인" — 화면 이동이 아니라 시트로 띄운다.
 *
 * `features/auth/login-sheet.tsx`(구 지연 로그인용)와 구조는 같지만 용도가
 * 다르다 — 그건 로그인을 미룰 수 있었지만(폐기된 정책), 이건 로그인 화면
 * 위에서 카카오 외의 방법을 더 보여줄 뿐이다. 닫아도 로그인 자체를 건너뛰지
 * 않는다 — 그냥 `/login`으로 돌아간다.
 */
export function OtherLoginSheet({
  visible,
  providers,
  busy,
  error,
  onSelect,
  onDismiss,
}: OtherLoginSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        {/* login-sheet.tsx와 같은 이유로 시트 밖에 형제로 둔다 — 웹에서 button-in-button을 피한다. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onDismiss}
        />

        <ThemedView style={styles.sheet}>
          <ThemedText type="t4">다른 방법으로 로그인</ThemedText>

          <ThemedView style={styles.actions}>
            {providers.map((provider) => (
              <ActionButton
                key={provider.provider}
                variant="secondary"
                size="xlarge"
                tone={providerTone(provider)}
                label={
                  provider.isDevelopmentStandIn ? '개발용 로그인' : PROVIDER_LABEL[provider.provider]
                }
                hint={
                  provider.isDevelopmentStandIn
                    ? '실제 애플·카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                    : undefined
                }
                disabled={busy || !canSignInWith(provider)}
                onPress={() => onSelect(provider)}
              />
            ))}
          </ThemedView>

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}
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
  actions: { gap: Spacing.two },
});
