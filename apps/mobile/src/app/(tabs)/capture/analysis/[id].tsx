import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { getAnalysis } from '@/api/client';
import { ErrorView, LoadingView } from '@weddingpick/ui';

const POLL_MS = 2000;

/** 실패 이유마다 사용자가 할 수 있는 일이 다르다. */
const FAILURE_MESSAGE = {
  unreadable: '글씨를 읽지 못했어요. 밝은 곳에서 문서가 화면에 꽉 차게 다시 찍어주세요.',
  not_a_document: '금액이 적힌 자료로 보이지 않아요. 다른 자료를 올려주세요.',
  internal: '분석에 실패했어요. 잠시 후 다시 시도해주세요.',
} as const;

/** A-06 분석 중. 끝나면 결과로 넘어간다. */
export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  if (failure || error) {
    return (
      <ErrorView
        title="분석하지 못했어요"
        message={failure ? FAILURE_MESSAGE[failure] : (error ?? undefined)}
        onRetry={() => router.replace('/capture')}
        retryLabel="다시 촬영하기"
      />
    );
  }

  return (
    <LoadingView label="업체·상품·금액·계약조건을 뽑아내는 중이에요. 잠시만 기다려주세요." />
  );
}
