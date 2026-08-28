import { Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

const row = { gap: Spacing.two, padding: Spacing.three };

/** 글자 종류. 화면은 fontSize를 직접 정하지 않고 이 중에서 고른다. */
export function Types() {
  return (
    <ThemedView style={row}>
      <ThemedText type="title">내 견적, 적정한 걸까?</ThemedText>
      <ThemedText type="subtitle">아펠가모 공덕</ThemedText>
      <ThemedText type="default">
        견적서를 촬영하면 업체·상품·금액·계약조건을 정리해 보여드립니다.
      </ThemedText>
      <ThemedText type="smallBold">확인이 필요합니다</ThemedText>
      <ThemedText type="small">확인된 계약 6건 · 2026-01-15~2026-06-15</ThemedText>
      <ThemedText type="code">L2</ThemedText>
    </ThemedView>
  );
}

/** 색 역할. 밝은/어두운 모드는 useTheme이 알아서 고른다. */
export function ColorRoles() {
  return (
    <ThemedView style={row}>
      <ThemedText>기본 — 계약금액 23,700,000원</ThemedText>
      <ThemedText themeColor="textSecondary">
        보조 — 계약금 3,000,000원 · 잔금 20,700,000원
      </ThemedText>
      <ThemedText themeColor="textAssistive">더 흐리게 — 2026년 8월 28일 올림</ThemedText>
      <ThemedText themeColor="tint">강조 — 샘플 결과 먼저 보기</ThemedText>
      <ThemedText themeColor="negative">경고 — 이 조항은 50%로 더 무겁습니다</ThemedText>
    </ThemedView>
  );
}

/** 여러 줄 본문. 안내 문구가 실제로 어떻게 앉는지. */
export function BodyText() {
  return (
    <ThemedView style={{ ...row, maxWidth: 360 }}>
      <ThemedText type="smallBold">자료가 모자라면 가격을 만들지 않습니다</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        확인된 계약이 충분히 모이지 않은 업체·상품은 비교 결과 대신 그 사실을 알려드립니다.
        가격을 보여드릴 때는 몇 건을 모았고 어느 기간인지 함께 표시합니다.
      </ThemedText>
    </ThemedView>
  );
}
