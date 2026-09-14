import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Layout, Radius } from './theme';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

export type IconButtonProps = {
  /**
   * 스크린 리더가 읽는 이름. **필수다** — 글자가 없는 단추라 이게 없으면
   * 「단추」로만 읽힌다.
   */
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  /**
   * 옅은 면을 깔아 눌리는 자리임을 보인다. 헤더처럼 배경이 이미 비어 있는 자리는
   * 기본값(면 없음)이 맞고, 사진 위에 얹는 자리가 면을 쓴다.
   */
  filled?: boolean;
  /** 켜고 끄는 단추(Pick 하트)면 준다. 스크린 리더가 상태를 읽는다. */
  selected?: boolean;
  testID?: string;
};

/**
 * 아이콘만 있는 단추. 헤더의 검색 · 알림 · 더보기, 카드 우상단의 Pick 하트가 쓴다.
 *
 * 보이는 크기는 40(`Layout.iconButton`)이고, 손가락이 닿는 자리는 `hitSlop`으로
 * 44(`Layout.touchTarget`)까지 넓힌다 — 헤더 아이콘 둘이 붙어 있어도 보이는 면을
 * 44로 키우면 서로 밀린다.
 *
 * 아이콘은 호출하는 쪽이 넣는다. 색도 아이콘이 들고 온다 — 여기서 아이콘 색을
 * 정하면 `ProductSymbol`과 `WeddingMark` 중 무엇이 들어오든 같은 색이 되고,
 * Pick 하트처럼 켜짐/꺼짐으로 색이 달라지는 것을 표현할 수 없다.
 */
export function IconButton({
  accessibilityLabel,
  icon,
  onPress,
  disabled,
  filled = false,
  selected,
  testID,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled === true, selected }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={HIT_SLOP}
      testID={testID}
      style={(state) => {
        const { pressed, hovered, focused } = readWebInteractionState(state);
        return [
          styles.button,
          {
            backgroundColor: filled || hovered ? theme.backgroundSelected : 'transparent',
            borderWidth: focused ? 1 : 0,
            borderColor: theme.tint,
            opacity: disabled === true ? 0.4 : pressed ? 0.8 : 1,
          },
        ];
      }}>
      {icon}
    </Pressable>
  );
}

/** 보이는 40에서 터치 44까지 — 사방 2씩. */
const EDGE = (Layout.touchTarget - Layout.iconButton) / 2;
const HIT_SLOP = { top: EDGE, bottom: EDGE, left: EDGE, right: EDGE } as const;

const styles = StyleSheet.create({
  button: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
