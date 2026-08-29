import { Spacing, ThemedText, ThemedView, WeddingCalendar } from '@weddingpick/ui';

const stack = { gap: Spacing.two, padding: Spacing.three, maxWidth: 380 };

/** 오늘을 고정해 캡처가 날마다 달라지지 않게 한다. */
const TODAY = new Date(2026, 8, 15);

/** 아직 안 골랐을 때 — 오늘은 테두리, 오늘 포함 과거는 흐리다. */
export function NothingPicked() {
  return (
    <ThemedView style={stack}>
      <ThemedText type="t7" themeColor="textSecondary">
        오늘 이후 날짜만 고를 수 있어요
      </ThemedText>
      <WeddingCalendar value={null} onChange={() => {}} today={TODAY} />
    </ThemedView>
  );
}

/** 고른 날은 파란 원. 일요일은 붉게, 토요일은 파랗게. */
export function DatePicked() {
  return (
    <ThemedView style={stack}>
      <ThemedText type="t7" themeColor="textSecondary">
        예식까지 214일이 남았어요
      </ThemedText>
      <WeddingCalendar value="2027-04-17" onChange={() => {}} today={TODAY} />
    </ThemedView>
  );
}
