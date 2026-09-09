import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@weddingpick/ui';
import { useDepthBack } from '@/features/navigation/depth-back';

/**
 * 좌상단 뒤로가기. 핸드오프 토큰 `size.backButton`(40) 터치 영역.
 *
 * **Depth Back이다** — 방문 기록을 되짚지 않고 화면 계층에서 한 단계 위로 간다.
 * 규칙은 `features/navigation/depth-back-rules.ts` 한 곳에 있다. 화면마다 `fallback`을
 * 따로 적던 구조를 없앴다 — 서로 어긋나서 MY 하위에서 검색으로 튀는 일이 났다.
 *
 * **웹(데스크톱)에서도 보인다.** 모바일은 스와이프·물리 버튼이 있지만 데스크톱
 * 브라우저는 화면 안의 버튼이 유일한 길이다(2026-09-08). 안드로이드 하드웨어 버튼과
 * 브라우저 뒤로가기는 History Back 그대로 둔다 — 막지 않는다.
 */
export function BackButton({
  onPress,
  variant = 'back',
}: {
  /** 진짜 예외 — 화면 안에서 단계를 되돌리는 경우(편집 취소 등)만 넘긴다. */
  onPress?: () => void;
  variant?: 'back' | 'close';
}) {
  const theme = useTheme();
  const depthBack = useDepthBack();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={variant === 'close' ? '닫기' : '뒤로'}
      onPress={onPress ?? depthBack}
      style={styles.button}
      hitSlop={4}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d={variant === 'close' ? 'M6 6l12 12M18 6 6 18' : 'M15 5.5 8 12l7 6.5'}
          stroke={theme.text}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
