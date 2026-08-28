import { Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

const card = { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.one };

/** 배경 역할. 화면 바탕과 그 위에 얹는 카드를 가른다. */
export function Surfaces() {
  return (
    <ThemedView style={{ padding: Spacing.three, gap: Spacing.two }}>
      <ThemedView style={card}>
        <ThemedText type="smallBold">background — 화면 바탕</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">기본값입니다.</ThemedText>
      </ThemedView>
      <ThemedView type="backgroundElement" style={card}>
        <ThemedText type="smallBold">backgroundElement — 카드</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          바탕 위에 얹는 것은 전부 이걸 씁니다.
        </ThemedText>
      </ThemedView>
      <ThemedView type="backgroundSelected" style={card}>
        <ThemedText type="smallBold">backgroundSelected — 고른 상태</ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

/** 실제 쓰임 — 분석 결과의 금액 카드. */
export function AmountCard() {
  return (
    <ThemedView style={{ padding: Spacing.three }}>
      <ThemedView type="backgroundElement" style={card}>
        <ThemedText type="small" themeColor="textSecondary">계약금액</ThemedText>
        <ThemedText type="subtitle">23,700,000원</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          계약금 3,000,000원 · 잔금 20,700,000원
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          보증인원 200명 · 1인 식대 68,000원
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}
