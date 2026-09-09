import { ANALYSIS_FACTS, FAQ_ITEMS, formatAttribution, listDataSources } from '@weddingpick/domain';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Layout, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { APP_VERSION } from '@/features/settings/version';

const SHOOTING_TIPS = [
  '문서가 화면에 꽉 차게, 네 귀퉁이가 모두 보이게 찍어주세요.',
  '그림자가 지지 않는 밝은 곳에서 찍으면 금액과 조건을 더 잘 읽어요.',
  '여러 장짜리 자료는 순서대로 이어서 찍어주세요. 한 건으로 묶어 분석해요.',
  '메일이나 메신저로 받은 PDF는 촬영하지 말고 파일 그대로 불러오세요. 훨씬 정확해요.',
];

/** 촬영 요령, FAQ, 분석 안내. MY와 촬영 화면에서 들어온다. */
export default function GuideScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">자주 묻는 것</ThemedText>
            {/*
              아코디언이 아니라 상세로 보낸다(WP-FAQ-003). 접었다 펴는 것만으로는
              답을 읽은 뒤에 할 수 있는 일이 없다 — 상세에는 관련 질문과
              「해결되지 않았어요」가 있고, 그것이 문의로 이어지는 유일한 길이다.
            */}
            {FAQ_ITEMS.map((faq) => (
              <Pressable
                key={faq.key}
                accessibilityRole="button"
                onPress={() => router.push(`/my/faq/${faq.key}` as never)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">{faq.question}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

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
              웨딩픽이 올려주신 자료를 어떻게 읽고, 무엇을 보장하지 않는지 알려드려요.
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
              웨딩픽이 비교와 대조에 쓰는 바깥 자료예요. 기관이 자료를 고치면 앱의 내용도
              달라질 수 있어 마지막으로 확인한 날짜를 함께 적어둬요.
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
              hint="자료를 올리기 전에 결과가 어떤 모습인지 볼 수 있어요"
              onPress={() => router.push('/capture/sample')}
            />
            <ActionButton
              label="문의하기"
              hint="답이 없으면 직접 물어보세요"
              onPress={() => router.push('/my/contact')}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>

          <ThemedText type="t7" themeColor="textAssistive">
            앱 버전 {APP_VERSION}
          </ThemedText>
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
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
