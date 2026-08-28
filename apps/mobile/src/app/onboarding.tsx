import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { completeOnboarding } from '@/features/onboarding/onboarding-state';

/** A-01 온보딩. 마지막 장에서 카메라·사진 권한이 왜 필요한지 미리 알린다. */
const STEPS = [
  {
    title: '찍으면 정리됩니다',
    body: '견적서·가계약서·계약서를 촬영하거나 파일로 불러오면 업체·상품·금액·계약조건·추가비용을 정리해 보여줍니다. 직접 입력할 항목은 없습니다.',
  },
  {
    title: '실제 계약과 견줍니다',
    body: '내 견적을 인증된 실제 계약 데이터의 중앙값과 비교합니다. 표본이 모자라면 가격을 만들어내지 않고, 표본 수와 기준 기간을 함께 보여줍니다.',
  },
  {
    title: '카메라와 사진 접근이 필요합니다',
    body: '문서를 촬영하고 불러오기 위해서만 씁니다. 찍은 문서는 기기 안에 저장되며, 서버로 보내지 않습니다.',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  async function next() {
    if (!isLast) {
      setIndex(index + 1);
      return;
    }

    await completeOnboarding();
    router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.body}>
          <ThemedText type="code" themeColor="textSecondary">
            {index + 1} / {STEPS.length}
          </ThemedText>
          <ThemedText type="subtitle">{step.title}</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {step.body}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            label={isLast ? '시작하기' : '다음'}
            onPress={next}
            accessibilityLabel={isLast ? '시작하기' : '다음'}
          />
          {!isLast ? (
            <ActionButton
              label="건너뛰기"
              onPress={async () => {
                await completeOnboarding();
                router.replace('/');
              }}
            />
          ) : null}
        </ThemedView>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  body: {
    gap: Spacing.three,
  },
  footer: {
    gap: Spacing.two,
  },
});
