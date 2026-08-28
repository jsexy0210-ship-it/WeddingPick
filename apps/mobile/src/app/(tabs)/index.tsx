import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerificationBadge } from '@/components/verification-badge';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import { useDocumentStore } from '@/features/documents/document-store';

/** 사업계획서 1번의 핵심 경험. 분석 결과가 쌓이기 전까지 홈이 대신 설명한다. */
const FLOW = [
  { step: '1', title: '찍는다', body: '견적서·가계약서·계약서를 촬영하거나 파일로 불러옵니다.' },
  { step: '2', title: '읽는다', body: '업체·상품·금액·계약조건·추가비용을 뽑아 정리합니다.' },
  { step: '3', title: '비교한다', body: '실제 계약 중앙값과 견줘 지금 조건이 어느 정도인지 봅니다.' },
];

/**
 * A-03 홈. 촬영 CTA 중심(명세 2번)이며, 아래는 최근 분석과 내 웨딩 요약 자리다.
 * 분석 결과를 저장할 곳이 아직 없으므로 두 섹션 모두 빈 상태만 보여준다.
 * 가짜 견적·가격을 채우지 않는 건 제품 원칙 2(AI가 시장 데이터를 만들어내지 않는다) 때문이다.
 */
export default function HomeScreen() {
  const { pages } = useCaptureDraft();
  const { sets } = useDocumentStore();
  const recent = sets.slice(0, 3);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary">
              찍으면, 진짜 가격이 보인다
            </ThemedText>
            <ThemedText type="subtitle">내 견적, 적정한 걸까?</ThemedText>
          </ThemedView>

          <ThemedView style={styles.actions}>
            <ActionButton
              variant="primary"
              label="견적서 촬영하기"
              hint="카메라 · 사진 · PDF"
              onPress={() => router.push('/capture')}
            />
            {pages.length > 0 ? (
              <ActionButton
                label={`작성 중인 문서 ${pages.length}장 이어서 보기`}
                onPress={() => router.push('/capture/review')}
              />
            ) : null}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">최근 분석</ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                아직 분석한 견적이 없습니다.
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.flow}>
                {FLOW.map((item) => (
                  <ThemedView key={item.step} type="backgroundElement" style={styles.flowRow}>
                    <ThemedText type="code" themeColor="textSecondary" style={styles.flowStep}>
                      {item.step}
                    </ThemedText>
                    <ThemedView type="backgroundElement" style={styles.flowText}>
                      <ThemedText type="smallBold">{item.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.body}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                ))}
              </ThemedView>
              <ActionButton
                label="샘플 결과 먼저 보기"
                hint="견적서를 올리면 어떤 모습으로 정리되는지 보여드립니다"
                onPress={() => router.push('/capture/sample')}
              />
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">내 웨딩</ThemedText>
            {recent.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  저장된 후보와 견적이 아직 없습니다. 찍어둔 문서는 여기에 모입니다.
                </ThemedText>
              </ThemedView>
            ) : (
              <>
                {recent.map((set) => (
                  <Pressable key={set.id} onPress={() => router.push(`/wedding/${set.id}`)}>
                    <ThemedView type="backgroundElement" style={styles.setRow}>
                      <ThemedView type="backgroundElement" style={styles.setText}>
                        <ThemedText type="smallBold">{set.label}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {set.pages.length}장 · 분석 전
                        </ThemedText>
                      </ThemedView>
                      <VerificationBadge level={set.verificationLevel} />
                    </ThemedView>
                  </Pressable>
                ))}
                {sets.length > recent.length ? (
                  <ActionButton
                    label={`내 웨딩 전체 보기 (${sets.length}건)`}
                    onPress={() => router.push('/wedding')}
                  />
                ) : null}
              </>
            )}
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
  header: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  flow: {
    gap: Spacing.three,
  },
  flowRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  flowStep: {
    paddingTop: Spacing.half,
  },
  flowText: {
    flex: 1,
    gap: Spacing.half,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  setText: {
    flex: 1,
    gap: Spacing.half,
  },
});
