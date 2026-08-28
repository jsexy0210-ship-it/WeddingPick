import { FilterChip, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

const row = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: Spacing.two };
const stack = { gap: Spacing.two, padding: Spacing.three, maxWidth: 380 };

/** 여럿을 켜고 끄는 자리 — 업체 검색의 분류 필터. */
export function CategoryFilter() {
  return (
    <ThemedView style={stack}>
      <ThemedView style={row}>
        <FilterChip label="웨딩홀" selected onPress={() => {}} />
        <FilterChip label="스드메" selected={false} onPress={() => {}} />
        <FilterChip label="스냅·영상" selected={false} onPress={() => {}} />
        <FilterChip label="플래닝" selected={false} onPress={() => {}} />
        <FilterChip label="예물·예단" selected={false} onPress={() => {}} />
      </ThemedView>
    </ThemedView>
  );
}

/** 하나만 고르는 자리는 role="radio" — 스크린 리더가 읽는 역할이 달라진다. */
export function SingleChoice() {
  return (
    <ThemedView style={stack}>
      <ThemedText type="smallBold">업체 / 플래너</ThemedText>
      <ThemedView style={row}>
        <FilterChip role="radio" label="업체" selected onPress={() => {}} />
        <FilterChip role="radio" label="플래너" selected={false} onPress={() => {}} />
      </ThemedView>
      <ThemedText type="smallBold">증빙 종류</ThemedText>
      <ThemedView style={row}>
        <FilterChip role="radio" label="견적서" selected={false} onPress={() => {}} />
        <FilterChip role="radio" label="계약서" selected onPress={() => {}} />
        <FilterChip role="radio" label="결제 내역" selected={false} onPress={() => {}} />
        <FilterChip role="radio" label="이용 확인 자료" selected={false} onPress={() => {}} />
      </ThemedView>
    </ThemedView>
  );
}

/** 개수를 함께 적는 지역 필터 — 눌러도 빈 결과가 나오지 않게 실제 수를 붙인다. */
export function WithCounts() {
  return (
    <ThemedView style={stack}>
      <ThemedView style={row}>
        <FilterChip label="서울 6곳" selected onPress={() => {}} />
        <FilterChip label="경기 2곳" selected={false} onPress={() => {}} />
        <FilterChip label="부산 1곳" selected={false} onPress={() => {}} />
      </ThemedView>
    </ThemedView>
  );
}
