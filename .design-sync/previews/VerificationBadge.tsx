import { Radius, Spacing, ThemedText, ThemedView, VerificationBadge } from '@weddingpick/ui';

const stack = { gap: Spacing.two, padding: Spacing.three, maxWidth: 380 };

/**
 * 확인 단계 다섯.
 *
 * 색은 UI 전체에서 고정한다 — 서비스정책서 2번이 등급별 색상 고정을 요구한다.
 */
export function Levels() {
  return (
    <ThemedView style={{ ...stack, alignItems: 'flex-start' }}>
      <VerificationBadge level="L0" />
      <VerificationBadge level="L1" />
      <VerificationBadge level="L2" />
      <VerificationBadge level="L3" />
      <VerificationBadge level="L4" />
    </ThemedView>
  );
}

/** 실제 쓰임 — 분석 결과 머리에 업체 이름과 함께 붙는다. */
export function ResultHeader() {
  return (
    <ThemedView style={stack}>
      <ThemedText type="subtitle">아펠가모 공덕</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        그랜드볼룸 토요일 낮 · 2026-05-16
      </ThemedText>
      <ThemedView style={{ alignItems: 'flex-start' }}>
        <VerificationBadge level="L2" />
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary">
        업체 정보 출처: 행정안전부 지방행정 인허가 데이터 (2026-08-28 확인)
      </ThemedText>
    </ThemedView>
  );
}

/** 단계 목록 — 신청 화면에서 조건과 함께 늘어놓는다. */
export function LevelList() {
  const rows = [
    ['L1', '실제 견적자료 확인', '아직 가격 비교에는 쓰이지 않습니다'],
    ['L2', '실제 계약자료 확인', '가격 비교의 기준이 됩니다'],
  ] as const;

  return (
    <ThemedView style={stack}>
      {rows.map(([level, condition, effect]) => (
        <ThemedView
          key={level}
          type="backgroundElement"
          style={{ borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.one }}>
          <ThemedView type="backgroundElement" style={{ alignItems: 'flex-start' }}>
            <VerificationBadge level={level} />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">{condition}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{effect}</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}
