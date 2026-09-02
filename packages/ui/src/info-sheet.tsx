import { Pressable, StyleSheet } from 'react-native';

import { ActionButton } from './action-button';
import { BottomSheet } from './bottom-sheet';
import { Spacing, type ThemeColor } from './theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export type InfoButtonProps = {
  /** 스크린리더가 읽을 말. 예: "확인된 정보 설명 보기". */
  accessibilityLabel: string;
  onPress: () => void;
  /** 잉크 블록처럼 tint 배경 위에 놓일 때 `onTint`로 바꿔 쓴다. 기본은 `tint`. */
  themeColor?: ThemeColor;
};

/**
 * 값 옆에 붙는 `ⓘ`. WP-SHT-014·015가 "값 옆 ⓘ"라고만 정하고 아이콘 자산은 주지
 * 않았다 — 이 앱은 이미지 없이 글자로만 그리는 화면이 많아(WP-ST-004가 그 규칙),
 * 별도 아이콘 세트를 들이는 대신 같은 글자 부호를 쓴다.
 */
export function InfoButton({ accessibilityLabel, onPress, themeColor = 'tint' }: InfoButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}>
      <ThemedText type="t7" themeColor={themeColor}>
        ⓘ
      </ThemedText>
    </Pressable>
  );
}

export type InfoSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  /** 문단 여러 개. 짧게 끊어 적는다 — 시트는 한 화면을 다 못 채운다. */
  paragraphs: readonly string[];
};

/** WP-SHT-014·015. ⓘ가 여는 설명 시트 — 값이 아니라 그 값의 뜻을 적는 자리. */
export function InfoSheet({ visible, onDismiss, title, paragraphs }: InfoSheetProps) {
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <ThemedText type="t4">{title}</ThemedText>
      <ThemedView style={styles.body}>
        {paragraphs.map((paragraph, index) => (
          <ThemedText key={index} type="t6" themeColor="textSecondary">
            {paragraph}
          </ThemedText>
        ))}
      </ThemedView>
      <ActionButton label="닫기" onPress={onDismiss} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.two },
});
