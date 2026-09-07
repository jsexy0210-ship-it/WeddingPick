import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

export type LoginFailureSheetProps = {
  visible: boolean;
  onRetry: () => void;
  onDismiss: () => void;
};

/**
 * 카카오 로그인 실패. `useSignIn`이 에러를 잡으면 화면 밑에 문구를 깔지
 * 않고 이 시트로 띄운다 — 규칙: "무엇이 잘못됐는지 대신 무엇을 하면 되는지
 * 적는다."
 *
 * v3.13부터 초기 버전은 카카오만 쓴다 — 이메일 로그인을 대안으로 안내하지
 * 않는다("어느 화면에서도 연결하지 않는다"). 카카오 말고는 고를 다른
 * 방법이 없으므로 "다시 시도"만 남긴다.
 *
 * 디자인 핸드오프는 취소·네트워크·계정 오류 3개 state를 구분하지만, 지금
 * `useSignIn`의 에러는 카카오 SDK/API가 던진 원문 메시지 하나뿐이라 셋을
 * 안전하게 구분할 신호가 없다 — 잘못 분류해 엉뚱한 안내를 하는 것보다
 * 공통 문구 하나로 시작한다. 구분하려면 `signInWithKakao`가 실패 종류를
 * 값으로 반환하도록 먼저 바꿔야 한다.
 */
export function LoginFailureSheet({ visible, onRetry, onDismiss }: LoginFailureSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onDismiss}
        />

        <ThemedView style={[styles.sheet, { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) }]}>
          <ThemedView style={styles.headline}>
            <ThemedText type="t4">잠시 후 다시 해볼까요?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              로그인을 마치지 못했어요.{'\n'}다시 시도해주세요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.actions}>
            <ActionButton variant="primary" size="xlarge" label="다시 시도" onPress={onRetry} />
          </ThemedView>
        </ThemedView>
      </View>
    </Modal>
  );
}

/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항. */
const SHEET_BOTTOM_PADDING = 28;

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.four,
  },
  headline: { gap: Spacing.one },
  actions: { gap: Spacing.two },
});
