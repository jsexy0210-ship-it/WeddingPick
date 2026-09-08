import { CALL_BLOCKED_NOTICE } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { getAnalysis } from '@/api/client';
import { ErrorView, ProcessingView, type Step } from '@weddingpick/ui';

const POLL_MS = 2000;

/** 실패 이유마다 사용자가 할 수 있는 일이 다르다. */
const FAILURE_MESSAGE = {
  unreadable: '글씨를 읽지 못했어요. 밝은 곳에서 문서가 화면에 꽉 차게 다시 찍어주세요.',
  not_a_document: '금액이 적힌 자료로 보이지 않아요. 다른 자료를 올려주세요.',
  internal: '분석에 실패했어요. 잠시 후 다시 시도해주세요.',
  // 고장이 아니라 지금 부를 수 없는 것이다. 다시 시도하라고 하지 않는다.
  unavailable: CALL_BLOCKED_NOTICE,
} as const;

/** A-06 분석 중. 끝나면 결과로 넘어간다. */
export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [failure, setFailure] = useState<keyof typeof FAILURE_MESSAGE | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 서버가 말해준 단계. 큐 대기(pending) → 읽는 중(running). 그 이상은 서버가 모른다. */
  const [phase, setPhase] = useState<'pending' | 'running'>('pending');

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

        setPhase(analysis.status);

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

  /*
   * WP-ST-012 처리 중 — 단계 표시. 서버가 알려주는 것은 «대기 → 읽는 중» 둘뿐이라
   * 그만큼만 체크한다. 가짜 진행률을 만들지 않는다(핸드오프 규칙).
   */
  const steps: Step[] = [
    { label: '글자 읽기', state: phase === 'running' ? 'done' : 'now' },
    { label: '금액과 날짜 찾기', state: phase === 'running' ? 'now' : 'todo' },
    { label: '업체 맞춰보기', state: 'todo' },
  ];

  return (
    <ProcessingView title={'올려주신 자료를\n읽고 있어요'} estimatedLabel="10초 안에 끝나요" steps={steps} />
  );
}
