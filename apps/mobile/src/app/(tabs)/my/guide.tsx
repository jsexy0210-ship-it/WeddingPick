import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const SHOOTING_TIPS = [
  '문서가 화면에 꽉 차게, 네 귀퉁이가 모두 보이게 찍어주세요.',
  '그림자가 지지 않는 밝은 곳에서 찍으면 금액과 조건을 더 잘 읽습니다.',
  '여러 장짜리 견적서는 순서대로 이어서 찍어주세요. 한 건으로 묶어 분석합니다.',
  '메일이나 메신저로 받은 PDF는 촬영하지 말고 파일 그대로 불러오세요. 훨씬 정확합니다.',
];

/** AI 안내. 법률검토 체크리스트의 "AI 안내 정책"에 해당하는 소비자 고지다. */
const AI_FACTS = [
  {
    title: 'AI는 읽고, 계산은 서버가 합니다',
    body: 'AI는 문서에 적힌 업체·상품·금액·계약조건을 뽑아내는 일만 합니다. 시장 가격이나 적정성 판단을 AI가 만들어내지 않습니다. 중앙값과 비교 결과는 인증된 실제 계약 데이터로 서버가 계산합니다.',
  },
  {
    title: '틀릴 수 있고, 원본이 우선입니다',
    body: '분석 결과는 참고용이며 법적 효력이 없습니다. 원본 문서와 다르면 원본이 맞습니다. 계약금액·계약일·환불조건은 확인해주시기 전까지 비교나 통계에 쓰이지 않습니다.',
  },
  {
    title: '확신이 낮은 항목은 숨기지 않습니다',
    body: '흐리게 찍혔거나 여러 해석이 가능한 값은 "확인 필요"로 표시해 보여드립니다. 조용히 그럴듯한 값으로 채우지 않습니다.',
  },
  {
    title: '데이터가 모자라면 가격을 만들지 않습니다',
    body: '인증된 계약이 충분히 모이지 않은 업체·상품은 중앙값을 보여드리지 않고 그 사실을 알립니다. 가격을 보여드릴 때는 표본이 몇 건이고 어느 기간인지 함께 표시합니다.',
  },
  {
    title: '개인정보는 값이 아니라 종류만 남깁니다',
    body: '문서에 이름·연락처·서명이 있으면 그 종류만 기록하고 값은 구조화 데이터로 옮기지 않습니다. 원본 파일은 저희 서버를 거치지 않고 저장소로 바로 올라갑니다.',
  },
];

/** 촬영 요령과 AI 안내. MY와 촬영 화면에서 들어온다. */
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
            <ThemedText type="subtitle">AI 안내</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              웨딩픽이 AI를 어떻게 쓰고, 무엇을 보장하지 않는지 알려드립니다.
            </ThemedText>

            {AI_FACTS.map((fact) => (
              <ThemedView key={fact.title} type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{fact.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {fact.body}
                </ThemedText>
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
