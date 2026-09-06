import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@weddingpick/ui';

/**
 * 이메일 로그인 화면들(WP-AUTH-002~007)의 좌상단 뒤로가기 · 우상단 닫기.
 * 핸드오프 토큰의 `size.backButton`(40) 터치 영역을 그대로 쓴다.
 *
 * `variant="close"`는 비밀번호 찾기·메일 보냈어요 화면(WP-AUTH-006/007)이
 * 쓴다 — 그 둘은 순서를 되짚어가는 단계가 아니라 로그인 흐름 밖으로 빠지는
 * 자리라 "<" 대신 "✕"로 다르게 보여준다.
 */
export function AuthBackButton({ onPress, variant = 'back' }: { onPress: () => void; variant?: 'back' | 'close' }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={variant === 'close' ? '닫기' : '뒤로'}
      onPress={onPress}
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
