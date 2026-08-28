import { ActionButton, Spacing, ThemedView } from '@weddingpick/ui';

const stack = { gap: Spacing.two, padding: Spacing.three, maxWidth: 380 };

/** 두 가지 무게. 화면에서 가장 중요한 하나만 primary다. */
export function Weights() {
  return (
    <ThemedView style={stack}>
      <ActionButton variant="primary" label="견적서 촬영하기" onPress={() => {}} />
      <ActionButton label="샘플 결과 먼저 보기" onPress={() => {}} />
    </ThemedView>
  );
}

/** 보조 설명. 무엇이 일어날지, 왜 눌리지 않는지를 여기 적는다. */
export function WithHint() {
  return (
    <ThemedView style={stack}>
      <ActionButton
        variant="primary"
        label="견적서 촬영하기"
        hint="카메라 · 사진 · PDF"
        onPress={() => {}}
      />
      <ActionButton
        label="웨딩픽 공유하기"
        hint="앱만 공유합니다. 내 견적·계약 정보는 포함되지 않습니다"
        onPress={() => {}}
      />
    </ThemedView>
  );
}

/**
 * 누를 수 없을 때.
 *
 * 왜 눌리지 않는지를 hint에 적는다 — 회색 단추만 두고 이유를 감추지 않는다.
 */
export function Disabled() {
  return (
    <ThemedView style={stack}>
      <ActionButton
        variant="primary"
        label="자료 확인 신청"
        hint="금액과 계약일을 확인하면 신청할 수 있습니다"
        disabled
        onPress={() => {}}
      />
      <ActionButton
        variant="primary"
        label="3곳 비교하기"
        hint="한 번에 3곳까지 견줄 수 있습니다"
        onPress={() => {}}
      />
    </ThemedView>
  );
}
