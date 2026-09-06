import type { AuthProvider } from '@weddingpick/api-contract';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  Radius,
  SocialLogo,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { PROVIDER_LABEL, PROVIDER_SHEET_ORDER, canSignInWith, providerTone } from '@/features/auth/providers';

export type OtherLoginSheetProps = {
  visible: boolean;
  providers: AuthProvider[];
  busy: boolean;
  onSelect: (provider: AuthProvider) => void;
  onDismiss: () => void;
};

/**
 * WP-AUTH-002 "다른 방법으로 시작" — 화면 이동이 아니라 시트로 띄운다.
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
  onSelect,
  onDismiss,
}: OtherLoginSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  /** 디자인 핸드오프 v3.11 순서 고정 — 네이버 → 구글 → 애플. */
  const ordered = [...providers].sort(
    (a, b) => PROVIDER_SHEET_ORDER.indexOf(a.provider) - PROVIDER_SHEET_ORDER.indexOf(b.provider)
  );

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

        {/* spec/tokens.json safeArea.formula.sheetBottomPadding — 28 + safeBottom. */}
        <ThemedView style={[styles.sheet, { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) }]}>
          <ThemedText type="t4">어떤 계정으로 시작할까요?</ThemedText>

          <ThemedView style={styles.actions}>
            {ordered.map((provider) => (
              <ActionButton
                key={provider.provider}
                variant="secondary"
                size="xlarge"
                tone={providerTone(provider)}
                icon={provider.isDevelopmentStandIn ? undefined : <SocialLogo provider={provider.provider} />}
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
        </ThemedView>
      </View>
    </Modal>
  );
}

/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항 — Spacing 8단계 밖의 값이라 별도로 둔다. */
const SHEET_BOTTOM_PADDING = 28;

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.three,
  },
  actions: { gap: Spacing.two },
});
