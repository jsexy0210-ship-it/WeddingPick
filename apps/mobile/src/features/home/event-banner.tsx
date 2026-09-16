import type { MyMonthlyDrawResponse } from '@weddingpick/api-contract';
import { formatCount, manwon } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 이벤트 — 홈 최하단. 2026-09-15 대표 사양 §18.
 *
 * **섹션명은 「이벤트」다** — 「웨딩픽 이벤트」라고 적지 않는다(§18). **배너형 하나**이고
 * 목록도 캐러셀도 아니다.
 *
 * 지금 우리에게 있는 진행 중인 혜택은 **월간 웨딩지원금** 하나다(`GET /v1/me/monthly-draw`).
 * 이벤트를 여러 개 담는 표가 아직 없어서, 그 하나를 배너로 세운다. **없으면 섹션째 그리지
 * 않는다**(§18 「활성 이벤트 없으면 섹션 미노출 가능」) — 비로그인이거나 회차가 닫혀 있을 때다.
 *
 * **운영 기간을 적지 않는다.** 혜택 화면에 이미 붙어 있는 규칙이다 — 「하루 안에」 ·
 * 「매달」 · 「~까지」 · 「30일 안에」 · 「마감일」 · 「당첨 확률」 금지. 그래서 이 배너는
 * 지원금 액수와 무엇을 하면 되는지만 말하고, 언제까지인지는 말하지 않는다.
 *
 * 설명 줄도 **무엇이 되는지**로 끝낸다 — 「~하지 않아요」 · 「~못해요」로 끝내지 않는다.
 */
export type EventBannerProps = {
  draw: MyMonthlyDrawResponse | null;
  onPress: () => void;
};

export function EventBanner({ draw, onPress }: EventBannerProps) {
  const theme = useTheme();

  if (draw === null) return null;

  return (
    <View style={[styles.section, styles.gutter]}>
      <ThemedText type="f14" style={[styles.semibold, styles.head]}>
        이벤트
      </ThemedText>
      <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>
        웨딩픽에서 진행 중인 혜택을 확인해보세요
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="혜택 보기"
        onPress={onPress}
        style={({ pressed }) => [
          styles.banner,
          { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder },
          pressed && styles.pressed,
        ]}>
        <View style={styles.text}>
          <ThemedText type="f14" numeric style={styles.semibold} numberOfLines={1}>
            웨딩지원금 {manwon(draw.amountKrw)}
          </ThemedText>
          <ThemedText type="f12" themeColor="textAssistive" numberOfLines={2} style={styles.note}>
            {bannerNote(draw)}
          </ThemedText>
        </View>
        <View style={[styles.cta, { borderColor: theme.tint }]}>
          <ThemedText type="f12" themeColor="tint" style={styles.semibold}>
            보기
          </ThemedText>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * 배너 한 줄. **남은 조건이 몇 개인지**만 말한다 — 기간도 확률도 적지 않는다.
 *
 * 다 채웠으면 「확인 후 알려드려요」다. 언제 알려주는지는 우리가 모르고, 모르는 것을
 * 「하루 안에」로 적으면 그 말이 지켜지지 않는 날이 온다.
 */
export function bannerNote(draw: MyMonthlyDrawResponse): string {
  if (draw.remaining === 0) return '응모가 끝났어요 · 확인 후 알려드려요';
  if (draw.remaining === 1) return '하나만 더 하면 응모할 수 있어요';

  return `${formatCount(draw.remaining)}가지만 더 하면 응모할 수 있어요`;
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.four },
  gutter: { paddingHorizontal: Layout.pageX },
  head: { marginBottom: Spacing.half },
  semibold: { fontWeight: 600 },
  sub: { marginBottom: Layout.sectionHeadGapCompact },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Layout.inlineGap,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
  },
  text: { flex: 1, minWidth: 0 },
  note: { marginTop: Spacing.half },
  cta: {
    flexShrink: 0,
    paddingVertical: Spacing.two,
    paddingHorizontal: Layout.fieldPaddingX,
    borderRadius: Radius.pill,
    borderWidth: Border.hairline,
  },
  pressed: { opacity: 0.8 },
});
