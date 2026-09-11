import { Pressable, StyleSheet } from 'react-native';

import { Layout, ProductSymbol, Radius, useTheme } from '@weddingpick/ui';
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
 *
 * **자리는 `NavBar`(`features/wedding/screen-kit.tsx`) · `SubScreen`
 * (`features/settings/my-kit.tsx`)과 같다.** 40 상자 안에서 아이콘을 **가운데**
 * 둔다 — 시안 `backBtn`의 `display:flex;align-items:center;justify-content:center`
 * 그대로이고, 20개 dc.html이 모두 같다.
 *
 * 2026-09-11 대표 지시(「Back 버튼 위치가 다른 상세 화면과 다른 부분이 있다. 통일
 * 하라」)로 고친 자리다. 이 상자는 `alignItems: 'flex-start'`였다 — 막대의 좌측
 * 패딩 12는 `NavBar`와 같았는데 아이콘만 상자 왼쪽 끝에 붙어서, 화살표가 화면
 * 왼쪽에서 12에 앉았다. `NavBar` · `SubScreen`은 가운데 정렬이라 `12 + (40−24)/2 = 20`
 * 이다. **같은 토큰을 쓰면서 8px 어긋나 있었고**, 그 8px이 `BackBar`를 쓰는 화면
 * 전부와 나머지 화면 사이를 갈랐다(`theme.ts`의 navPaddingLeft 주석이 「아이콘 24가
 * 20 선에 앉는다」고 적어 둔 그 선이다).
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
      {/*
        글리프도 `NavBar` · `SubScreen`과 같은 것을 쓴다. 예전에는 이 파일만 path를
        따로 그렸는데(`M15 5.5 8 12l7 6.5` · 획 1.9) 다른 화면의 `chevronLeft`
        (`M14.5 5 8 12l6.5 7`)와 모양도 두께도 달랐다.
      */}
      <ProductSymbol
        name={variant === 'close' ? 'close' : 'chevronLeft'}
        size={Layout.iconTab}
        color={theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* 시안 backBtn — 40×40 · pill · 안쪽 가운데. `screen-kit`의 navButton과 같은 값. */
  button: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
