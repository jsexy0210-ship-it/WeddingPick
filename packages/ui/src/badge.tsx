import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BADGE_LABEL, STATUS_BADGE_STYLE } from './pick-status-badge';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/**
 * 상태 배지 색 — 02-design-system «Chip · Badge» · tokens.json color.status. 스킨과 무관하게 고정.
 *
 *   ok     인증완료 · 결정 완료 · 반영됨      #E8FAF6 / #1AA174
 *   wait   확인 중 · 보완 필요 · 검수 중       #FFE3BA / #805217
 *   no     반려 · 오류 · 환불                 #FFE5E3 / #E81607
 *   brand  Pick 완료 · 후보 Pick 중           #FFE8E4 / coral   (color-mix(pick 12~14%, #fff)의 고정값 · SPEC §14)
 *   none   준비 전 · 기본                     #F2F3F6 / #4D5159
 *   info   정보 · 링크성 배지(관리자)          #EBF7FA / #0077B2
 *   onImage 사진 위에 얹는 표시                rgba(0,0,0,.5) / #FFFFFF
 */
export type BadgeKind = 'ok' | 'wait' | 'no' | 'brand' | 'none' | 'info' | 'onImage';

export type BadgeProps = {
  kind?: BadgeKind;
  children: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 배지 — **피그마 실측(2026-09-15)**.
 *
 *   minHeight 19 · 한 줄 · nowrap · padding 2 8 · 알약(r9999) · 10/15
 *
 * 규격서에서 배지꼴 34개를 세었더니 28개가 이 한 가지였다. 굵기만 갈린다 —
 * 옅은 배지는 **600**, 사진 위 먹색 배지는 **700**(«10/700 #FFFFFF · bg #1A1C20»).
 * 자세한 근거는 `Layout.badgeHeight`와 `BADGE_LABEL` 주석에 있다.
 *
 * 배지를 아래로 내리지 않는다 — 공간이 부족하면 옆 텍스트를 말줄임한다.
 */
export function Badge({ kind = 'none', children, style }: BadgeProps) {
  const theme = useTheme();
  const { background, text } = BADGE_LOOK[kind](theme);

  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      <ThemedText
        type="f10"
        numberOfLines={1}
        style={[kind === 'onImage' ? styles.onImageLabel : BADGE_LABEL, { color: text }]}>
        {children}
      </ThemedText>
    </View>
  );
}

type Theme = ReturnType<typeof useTheme>;

const BADGE_LOOK: Record<BadgeKind, (theme: Theme) => { background: string; text: string }> = {
  ok: (theme) => ({ background: theme.positiveBackground, text: theme.positive }),
  wait: (theme) => ({ background: theme.cautionaryBackground, text: theme.cautionary }),
  no: (theme) => ({ background: theme.negativeBackground, text: theme.negative }),
  brand: (theme) => ({ background: theme.tintSubtle, text: theme.tint }),
  none: (theme) => ({ background: theme.backgroundSelected, text: theme.textSecondary }),
  info: (theme) => ({ background: theme.accentBackground, text: theme.accentText }),
  /*
   * 사진 위 — 업체 카드의 대표 사진에 얹는 「인기」 「신규」 자리다(2026-09-14 대표 지시).
   *
   * **여기만 흰 글자다.** 이 저장소가 여러 곳에 적어 둔 「흰 글자를 쓰지 않는다」는
   * 키 컬러(#FF6F61) 면 위의 이야기다 — 거기서는 2.51:1이라 못 읽는다. 검은 반투명은
   * 다른 자리다: `pillOnImage`가 사진을 어둡게 깔아주고 그 위에서 흰 글자가 가장 밝다.
   * 가장 나쁜 경우(새하얀 사진)에도 3.95:1이고, 보통의 사진에서는 훨씬 높다.
   *
   * `brand`를 이 자리에 쓰면 안 된다 — 옅은 면(#FFE8E4)에 키 컬러 글자라 2.27:1이고,
   * 사진의 밝기와 무관하게 안 읽힌다. 그렇다고 `brand` 자체를 고치지도 않는다:
   * 흰 바탕에서 쓰는 자리는 지금 조합이 옳다.
   *
   * 배경은 `pillOnImage`(overlay.pillOnImage · rgba(0,0,0,.5))다. `scrim`은 라이트 .45 ·
   * 다크 .72로 갈려 사진 위에서 무게가 달라진다(2026-09-11 캡처로 드러난 자리다).
   * 글자는 `onInk` — 어두운 면 위의 글자색이고 두 모드 모두 흰색이다. `onTint`는
   * 플럼(#FFFFFF)이라 여기 쓰면 검은 면에 검은 글자가 된다.
   */
  onImage: (theme) => ({ background: theme.pillOnImage, text: theme.onInk }),
};

const styles = StyleSheet.create({
  badge: STATUS_BADGE_STYLE,
  /** 사진 위 배지만 700 — 규격서 «10/700 #FFFFFF · bg #1A1C20» 여덟 곳. */
  onImageLabel: { fontWeight: 700 },
});
