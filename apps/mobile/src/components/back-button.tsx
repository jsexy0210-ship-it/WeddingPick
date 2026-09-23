import { Pressable, StyleSheet } from 'react-native';

import { ProductSymbol, Radius, useTheme } from '@weddingpick/ui';
import { useDepthBack } from '@/features/navigation/depth-back';

/**
 * 좌상단 뒤로가기 · 닫기. v3.29 공통 헤더 규격 — 좌측 36px 슬롯(일반 화면은 24px
 * 화살, 풀팝업은 16px X). 옛 40px·20/24 값에서 이 파일 전용 상수로 바꿨다(아래).
 *
 * **History 우선, 없으면 Depth Back이다**(`features/navigation/depth-back.ts`
 * `useDepthBack`) — 방문 기록이 있으면 실제 직전 화면으로, 없으면(딥링크 등)
 * `features/navigation/depth-back-rules.ts`의 계층 fallback 표로 간다. 화면마다
 * `fallback`을 따로 적던 구조를 없앴다 — 서로 어긋나서 MY 하위에서 검색으로 튀는
 * 일이 났다.
 *
 * **웹(데스크톱)에서도 보인다.** 모바일은 스와이프·물리 버튼이 있지만 데스크톱
 * 브라우저는 화면 안의 버튼이 유일한 길이다(2026-09-08). 안드로이드 하드웨어 버튼과
 * 브라우저 뒤로가기는 History Back 그대로 둔다 — 막지 않는다.
 *
 * 상자 안에서 아이콘은 **가운데** 둔다 — 시안 `backBtn`·`vicoBack`의
 * `display:flex;align-items:center;justify-content:center` 그대로다.
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
      {/*
        뒤로는 ← 화살(피그마 2026-09-14 정본 — `Search.tsx` · `VendorFlows.tsx` · `FlowScreens.tsx`
        전부 lucide ArrowLeft `h-5 w-5` = 20). 꺾쇠였던 것을 바꿨고, 상세 화면끼리 같은 단추를
        쓰므로 여기 한 곳만 바꾸면 전부 따라온다.
      */}
      <ProductSymbol
        name={variant === 'close' ? 'close' : 'arrowLeft'}
        size={variant === 'close' ? CLOSE_ICON_SIZE : BACK_ICON_SIZE}
        color={theme.text}
      />
    </Pressable>
  );
}

/*
 * v3.29 공통 헤더 규격(CLAUDE.md 「일반 화면 · 풀팝업」 행) — 좌측 36px 슬롯.
 * 일반 화면 뒤로가기는 24px 아이콘, 풀팝업 닫기는 16px 아이콘이다. 40×40·20/24
 * 이던 옛 값에서 바꿨다 — `Layout.iconButton`·`iconRow`·`iconTab`은 탭바·홈 카드 등
 * 다른 아이콘 버튼도 같이 쓰는 범용 토큰이라 여기서 값만 바꾸면 그 화면들까지
 * 흔들린다. 그래서 이 버튼 전용 상수로 뗐다.
 */
export const TOUCH_SLOT_SIZE = 36;
export const BACK_ICON_SIZE = 24;
export const CLOSE_ICON_SIZE = 16;

const styles = StyleSheet.create({
  button: {
    width: TOUCH_SLOT_SIZE,
    height: TOUCH_SLOT_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
