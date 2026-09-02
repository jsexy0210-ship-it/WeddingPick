import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';
import { ThemedView } from './themed-view';

export type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
};

/**
 * 공용 바텀시트 껍데기. 디자인 핸드오프의 WP-SHT 계열이 반복해서 쓰는 모양이다.
 *
 * `features/auth/login-sheet.tsx`가 이 모양을 먼저 만들었다 — scrim을 형제로 두고
 * (감싸면 웹에서 button 안에 button이 생긴다), `Radius.sheet`로 위쪽만 둥글린
 * 패널을 하단에 붙인다. 로그인 시트는 자기 사정(제공자 목록, 에러 상태)이 있어
 * 그대로 두고, 그 뒤로 생기는 시트들은 이 껍데기를 쓴다 — 같은 모양을 또
 * 손으로 그리면 하나를 고칠 때 나머지가 따라오지 않는다.
 *
 * 여백과 배치만 준다. 제목·본문·버튼 구성은 화면마다 다르므로 children이 정한다.
 */
export function BottomSheet({ visible, onDismiss, children }: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onDismiss}
        />
        <ThemedView style={styles.sheet}>{children}</ThemedView>
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
});
