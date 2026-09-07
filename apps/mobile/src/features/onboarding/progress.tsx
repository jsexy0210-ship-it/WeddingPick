import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Layout, Radius, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 상단 내비게이션. 디자인 핸드오프 01-onboarding.dc.html WP-APP-008~011 —
 * 뒤로가기 · 진행 막대 · 단계 숫자가 한 줄(56)에 앉는다.
 *
 * 몇 단계가 남았는지 보이지 않으면 사용자는 끝을 모른 채 답하게 되고, 그때
 * 이탈이 늘어난다. 막대와 숫자를 함께 두는 이유다 — 막대만으로는 «몇 개
 * 남았는가»가 읽히지 않는다.
 *
 * 막대 바탕은 `border`(#EAEBEE)다 — `track`(#DCDEE3)이 아니다. 시안이 막대
 * 바탕과 목록 행 구분선에 같은 값을 쓴다.
 *
 * 뒤로갈 곳이 없는 첫 단계에서도 뒤로가기 자리를 비우지 않는다. 자리가
 * 사라지면 막대가 왼쪽으로 튀어 단계마다 시작선이 달라진다.
 */
export function OnboardingProgress({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  /** 없으면 첫 단계다 — 자리만 남기고 숨긴다. */
  onBack?: () => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        accessibilityElementsHidden={!onBack}
        importantForAccessibility={onBack ? 'auto' : 'no-hide-descendants'}
        disabled={!onBack}
        onPress={onBack}
        style={[styles.back, !onBack && styles.backHidden]}
        hitSlop={4}>
        <Svg width={Layout.iconTab} height={Layout.iconTab} viewBox="0 0 24 24" fill="none">
          <Path
            d="M14.5 5 8 12l6.5 7"
            stroke={theme.text}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: theme.tint, width: `${(step / total) * 100}%` },
          ]}
        />
      </View>

      <ThemedText type="t7" themeColor="textAssistive" numeric style={styles.counter}>
        {step}/{total}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    /* 시안의 12 — 목록 행과 같은 리듬이다. */
    gap: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
  },
  /* 로그인 화면의 AuthBackButton과 같다 — 아이콘 왼쪽 선이 거터 24에 앉는다. */
  back: {
    width: Layout.controlMedium,
    height: Layout.controlMedium,
    borderRadius: Radius.pill,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backHidden: { opacity: 0 },
  track: { flex: 1, height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  counter: { fontWeight: 700 },
});
