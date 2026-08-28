import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAnalysis } from '@/api/client';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const POLL_MS = 2000;

/** 실패 이유마다 사용자가 할 수 있는 일이 다르다. */
const FAILURE_MESSAGE = {
  unreadable: '글씨를 읽지 못했습니다. 밝은 곳에서 문서가 화면에 꽉 차게 다시 찍어주세요.',
  not_a_document: '견적서나 계약서로 보이지 않습니다. 다른 문서를 올려주세요.',
  internal: '분석에 실패했습니다. 잠시 후 다시 시도해주세요.',
} as const;

/** A-06 분석 중. 끝나면 결과로 넘어간다. */
export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [failure, setFailure] = useState<keyof typeof FAILURE_MESSAGE | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const analysis = await getAnalysis(id);

        if (!active) return;

        if (analysis.status === 'succeeded') {
          router.replace(`/capture/result/${analysis.quoteId}`);
          return;
        }

        if (analysis.status === 'failed') {
          setFailure(analysis.reason);
          return;
        }

        timer = setTimeout(poll, POLL_MS);
      } catch (caught) {
        if (active) setError((caught as Error).message);
      }
    }

    poll();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {failure || error ? (
          <>
            <ThemedText type="subtitle">분석하지 못했습니다</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {failure ? FAILURE_MESSAGE[failure] : error}
            </ThemedText>
            <ActionButton
              variant="primary"
              label="다시 촬영하기"
              onPress={() => router.replace('/capture')}
            />
          </>
        ) : (
          <>
            <ThemedText type="subtitle">문서를 읽고 있습니다</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              업체·상품·금액·계약조건을 뽑아내는 중입니다. 잠시만 기다려주세요.
            </ThemedText>
            <ActivityIndicator color={theme.tint} size="large" style={styles.spinner} />
          </>
        )}
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
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  spinner: {
    alignSelf: 'flex-start',
    marginTop: Spacing.three,
  },
});
