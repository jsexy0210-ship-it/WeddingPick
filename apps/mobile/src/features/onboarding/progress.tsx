import { StyleSheet, View } from 'react-native';

import { Layout, Radius, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 상단 내비게이션. 디자인 핸드오프 v3.22 20-onboarding-v2.dc.html `nav` —
 * 진행 막대 4px와 «N/5»가 한 줄(56)에 앉는다. 좌우 거터 24, 사이 12.
 *
 * **뒤로가기 버튼이 없다**(v3.19 «Back 버튼 전면 제거»). 되돌아가는 길은 dock의
 * «이전»과 답 줄의 «바꾸기»뿐이다 — 상단에 화살표가 있으면 «온보딩을 나간다»와
 * «앞 질문으로 간다»가 한 버튼에 겹쳐 어느 쪽인지 사용자가 알 수 없다.
 *
 * 몇 단계가 남았는지 보이지 않으면 사용자는 끝을 모른 채 답하게 되고, 그때
 * 이탈이 늘어난다. 막대와 숫자를 함께 두는 이유다 — 막대만으로는 «몇 개
 * 남았는가»가 읽히지 않는다.
 *
 * 막대 바탕은 `border`(#EAEBEE)다 — `track`(#DCDEE3)이 아니다. 시안이 막대
 * 바탕과 목록 행 구분선에 같은 값을 쓴다.
 */
export function OnboardingProgress({
  progress,
  label,
}: {
  /** 0~100. 다섯 질문 기준 20 → 40 → 60 → 80 → 100. */
  progress: number;
  /** 진행 막대 오른쪽 — «1/5» … «5/5» · 완료 화면은 «완료». */
  label: string;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.bar}>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { backgroundColor: theme.tint, width: `${progress}%` }]} />
      </View>

      <ThemedText type="t7" themeColor="textAssistive" numeric style={styles.counter}>
        {label}
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
  track: { flex: 1, height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  counter: { fontWeight: 700 },
});
