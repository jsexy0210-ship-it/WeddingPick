import { ANALYSIS_FACTS, formatAttribution, listDataSources } from '@weddingpick/domain';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

const SHOOTING_TIPS = [
  '문서가 화면에 꽉 차게, 네 귀퉁이가 모두 보이게 찍어주세요.',
  '그림자가 지지 않는 밝은 곳에서 찍으면 금액과 조건을 더 잘 읽습니다.',
  '여러 장짜리 견적서는 순서대로 이어서 찍어주세요. 한 건으로 묶어 분석합니다.',
  '메일이나 메신저로 받은 PDF는 촬영하지 말고 파일 그대로 불러오세요. 훨씬 정확합니다.',
];

/** 촬영 요령과 분석 안내. MY와 촬영 화면에서 들어온다. */
export default function GuideScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">이렇게 찍어주세요</ThemedText>
            {SHOOTING_TIPS.map((tip) => (
              <ThemedView key={tip} type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {tip}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">분석 안내</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              웨딩픽이 견적서를 어떻게 읽고, 무엇을 보장하지 않는지 알려드립니다.
            </ThemedText>

            {ANALYSIS_FACTS.map((fact) => (
              <ThemedView key={fact.title} type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{fact.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {fact.body}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">자료 출처</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              웨딩픽이 비교와 대조에 쓰는 바깥 자료입니다. 기관이 자료를 고치면 앱의 내용도
              달라질 수 있어 마지막으로 확인한 날짜를 함께 적어둡니다.
            </ThemedText>

            {listDataSources().map((source) => (
              <ThemedView key={source.id} type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{formatAttribution(source)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  쓰이는 곳: {source.usedFor}
                </ThemedText>
                {source.url ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    원문: {source.url}
                  </ThemedText>
                ) : null}
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ActionButton
              variant="primary"
              label="샘플 결과 보기"
              hint="견적서를 올리기 전에 결과가 어떤 모습인지 볼 수 있습니다"
              onPress={() => router.push('/capture/sample')}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
