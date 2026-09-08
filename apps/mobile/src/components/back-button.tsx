import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@weddingpick/ui';

/**
 * 좌상단 뒤로가기. 핸드오프 토큰 `size.backButton`(40) 터치 영역.
 *
 * **웹(데스크톱)에서도 보인다.** 모바일은 스와이프·물리 버튼이 있지만
 * 데스크톱 브라우저는 화면 안의 버튼이 유일한 길이다(2026-09-08). 링크로 곧장
 * 들어와 되돌아갈 곳이 없으면 `fallback`(기본 검색 탭)으로 보낸다 — 아무 일도
 * 안 일어나는 버튼을 두지 않는다.
 */
export function BackButton({
  onPress,
  fallback = '/search',
  variant = 'back',
}: {
  onPress?: () => void;
  /** 되돌아갈 화면이 없을 때 갈 곳. */
  fallback?: string;
  variant?: 'back' | 'close';
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={variant === 'close' ? '닫기' : '뒤로'}
      onPress={() => {
        if (onPress) {
          onPress();

          return;
        }

        if (router.canGoBack()) router.back();
        else router.replace(fallback as never);
      }}
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
