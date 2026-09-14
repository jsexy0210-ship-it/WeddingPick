import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionButton, Layout, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { NavBar, Screen } from '@/features/wedding/screen-kit';
import { QuoteResultView } from '@/features/quotes/quote-result-view';
import { SAMPLE_COMPARISON, SAMPLE_QUOTE } from '@/features/sample/sample-quote';

/**
 * 샘플 미리보기.
 *
 * 견적서를 올리기 전에 결과가 어떻게 생겼는지 보여준다. 실제 결과 화면과 같은
 * 컴포넌트로 그리므로 샘플이 실제와 다른 약속을 하지 않는다.
 *
 * 화면 위아래로 샘플임을 알린다 — 여기 숫자는 지어낸 것이고 실제 업체·계약이 아니다.
 *
 * nav «샘플»의 뒤로는 제보 홈(`/capture`)이다 — 샘플은 거기서만 들어온다.
 */
export default function SampleScreen() {
  return (
    <Screen>
      <NavBar title="샘플" />
      <View style={styles.safeArea}>
        <ThemedView style={styles.banner}>
          <ThemedText type="smallBold" style={styles.bannerText}>
            샘플 화면이에요
          </ThemedText>
          <ThemedText type="small" style={styles.bannerText}>
            실제 업체나 실제 자료가 아니에요. 자료를 올리시면 이런 모습으로 정리돼요.
          </ThemedText>
        </ThemedView>

        <QuoteResultView
          quote={SAMPLE_QUOTE}
          comparison={SAMPLE_COMPARISON}
        />

        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            label="내 자료로 해보기"
            onPress={() => router.replace('/capture')}
          />
        </ThemedView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  banner: {
    backgroundColor: '#7A4DD1',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  bannerText: {
    color: '#ffffff',
  },
  footer: {
    paddingBottom: Spacing.four,
  },
});
