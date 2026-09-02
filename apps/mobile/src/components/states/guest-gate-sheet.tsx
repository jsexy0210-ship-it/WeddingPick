import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

export type GuestGateSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** 카카오 로그인 CTA. */
  onKakaoPress: () => void;
};

/**
 * WP-ST-001 — 비회원 게이트.
 *
 * 비회원이 Pick·저장 등 로그인이 필요한 행동을 했을 때 바텀시트로 로그인을 유도한다.
 * 비회원에게 개인화 영역을 보여주지 않는다 — 이 시트 밖에서는 확인된 정보만 열려 있다.
 */
export function GuestGateSheet({ visible, onDismiss, onKakaoPress }: GuestGateSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.scrim }]} onPress={onDismiss} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <View style={styles.grabber} />
        <ThemedText type="t4" style={styles.title}>
          로그인하면 저장돼요
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.body}>
          확인된 정보는 로그인 없이도 볼 수 있어요
        </ThemedText>
        <ActionButton
          variant="primary"
          size="xlarge"
          label="3초 만에 시작"
          onPress={onKakaoPress}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    gap: Spacing.two,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: '#eaebee',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    marginTop: Spacing.two,
  },
  body: {
    marginBottom: Spacing.two,
  },
});
