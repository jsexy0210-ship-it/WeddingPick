import { StyleSheet, View } from 'react-native';

import { Layout, Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/** WP-ST-003 — Pick 상태 뱃지. */
export type PickStatus = 'none' | 'picked' | 'decided';

export type PickStatusBadgeProps = {
  status: PickStatus;
};

const LABEL: Record<PickStatus, string> = {
  none: 'Pick 전',
  picked: 'Pick',
  decided: '결정 완료',
};

/**
 * 상태 배지 — tokens.json component.badge · SPEC §12.3.
 *
 *   minHeight 22 · 한 줄 · nowrap · padding 4 9 · radius 4 · 14/19/700 — 실제 높이 27
 *   Pick 중  #FFE8E4 / coral      결정 완료  #E8FAF6 / #1AA174      Pick 전  #F2F3F6 / #868B94
 *
 * 배지를 아래로 내리지 않는다 — 공간이 부족하면 옆 텍스트를 말줄임한다.
 */
export function PickStatusBadge({ status }: PickStatusBadgeProps) {
  const theme = useTheme();

  const bgColor =
    status === 'picked'
      ? theme.tintSubtle
      : status === 'decided'
        ? theme.positiveBackground
        : theme.backgroundSelected;

  const textColor =
    status === 'picked'
      ? theme.tint
      : status === 'decided'
        ? theme.positive
        : theme.textAssistive;

  return (
    <View style={[styles.base, { backgroundColor: bgColor }]}>
      <ThemedText type="f10" numberOfLines={1} style={[BADGE_LABEL, { color: textColor }]}>
        {LABEL[status]}
      </ThemedText>
    </View>
  );
}

/**
 * 상태 배지 공통 상자 — `Badge` · `VerificationBadge`도 같은 값을 쓴다.
 *
 * **높이는 `minHeight`다.** 핸드오프의 배지(`docs/design-handoff/current/html` 22곳 전부)는
 * `padding:4px 9px; line-height:19px`뿐이고 height를 적지 않는다 — 실제로 그려지는 높이는
 * 4+19+4=27이다. 웹(`apps/web/src/site-styles.ts` `.badge`)도 같다. 여기에 `height: 22`를
 * 박아두면 안쪽이 14로 줄어 19줄이 상하 2.5씩 비어져 나오고, 배지는 바탕색 상자라
 * 글자가 상자 테두리에 닿는다 — 「배지가 잘린다」로 보이던 자리다.
 * `component.badge.height` 22는 그래서 최소 높이로만 든다.
 */
/**
 * 배지 글자 — 피그마 «10/…/lh 15». 굵기는 **600**이다.
 *
 * 규격서의 옅은 배지는 500(18곳) 또는 600(2곳)인데 **우리는 500을 싣지 않는다**
 * (Pretendard Regular 400 · SemiBold 600 · Bold 700 · ExtraBold 800 넷뿐 —
 * `apps/mobile/assets/fonts/README.md`). 가장 가까우면서 실제로 실려 있는 600으로
 * 간다(2026-09-15 MASTER 확정). 사진 위 배지만 700이고 그쪽은 `Badge`가 덮는다.
 */
export const BADGE_LABEL = { fontWeight: 600 } as const;

export const STATUS_BADGE_STYLE = {
  alignSelf: 'flex-start',
  minHeight: Layout.badgeHeight,
  paddingHorizontal: Layout.badgePaddingX,
  paddingVertical: Layout.badgePaddingY,
  /* 피그마 배지는 알약이다 — 28곳 전부 «r9999». `Radius.badge` 4는 뼈대 · 관리자 몫이라 안 건드린다. */
  borderRadius: Radius.pill,
  justifyContent: 'center',
} as const;

const styles = StyleSheet.create({
  base: STATUS_BADGE_STYLE,
});
