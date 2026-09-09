import type { VerificationRequest } from '@weddingpick/api-contract';
import { VERIFICATION_LEVEL_RULES } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getVerificationRequest } from '@/api/client';
import { formatDateDot, formatMonthDayDot } from '@/features/common/format-date';
import { ErrorView, Layout, Spacing } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  Badge,
  Dock,
  DockButton,
  Hero,
  ListRow,
  NavBar,
  NoteCard,
  RadioDot,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

type Status = VerificationRequest['status'];

/** hero 제목 — 상태를 사용자 말로. «승인» · «반려»는 운영자 용어라 화면에 그대로 내보내지 않는다. */
const HERO: Record<Status, string> = {
  received: '접수됐어요',
  in_review: '확인하고 있어요',
  needs_supplement: '보완이 필요해요',
  approved: '반영됐어요',
  rejected: '반영되지 않았어요',
};

const HERO_SUB: Record<Status, string> = {
  received: '올려주신 자료를 아직 보지 않았어요. 확인이 끝나면 알려드려요.',
  in_review: '자료와 금액이 맞는지 보고 있어요.',
  needs_supplement: '아래 내용을 더해 다시 신청하면 이어서 봐요.',
  approved: '자료 확인이 끝나 단계가 올랐어요.',
  rejected: '아래 사유를 확인해주세요.',
};

/** 처리 단계 4 — 상태마다 어디까지 왔는지. 끝난 단계는 coral 점, 남은 단계는 회색. */
function stepsOf(req: VerificationRequest): { label: string; sub: string; done: boolean }[] {
  const received = formatMonthDayDot(req.receivedAt);
  const decided = req.decidedAt ? formatMonthDayDot(req.decidedAt) : null;
  const reviewing = req.status !== 'received';
  const settled = req.status === 'approved' || req.status === 'rejected';

  return [
    { label: '자료 접수', sub: `${received} · 올려주신 자료를 받았어요`, done: true },
    { label: '자료 확인', sub: reviewing ? '금액과 날짜를 봤어요' : '순서를 기다리고 있어요', done: reviewing },
    {
      label: '교차 확인',
      sub: settled ? `${decided ?? received} · 다른 제보와 비교했어요` : '다른 제보와 비교해요',
      done: settled,
    },
    {
      label: '반영',
      sub:
        req.status === 'approved'
          ? `${decided ?? received} · 금액 구간에 들어갔어요`
          : req.status === 'rejected'
            ? `${decided ?? received} · 반영하지 않았어요`
            : '확인이 끝나면 들어가요',
      done: req.status === 'approved',
    },
  ];
}

/**
 * 인증 결과. WP-RPT-008 · 핸드오프 12b-remaining «인증 결과».
 *
 *   nav      «인증 결과»
 *   hero     eyebrow «2027.05.16(토) 접수» · 상태 26/35 · «신청 단계 · 안내» 16/24
 *   처리 단계  4행 — 점 24(끝난 것 coral) · 제목 18/24 · «날짜 · 설명» 14/19 · 마지막에 «완료» 배지
 *   반영된 곳  승인일 때만 — 단계가 올랐다는 것
 *   note     보완 · 반려 사유 / 원본 삭제
 *   dock     보완 필요면 «자료 보완하기» · 진행 중이면 «새로고침»
 *
 * 접수 · 확인 중 · 보완 필요 · 반영 · 반영 안 됨 다섯 상태를 한 화면이 맡는다.
 */
export default function VerifyStatusScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const [req, setReq] = useState<VerificationRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getVerificationRequest(requestId)
      .then(setReq)
      .catch((caught: Error) => setError(caught.message));
  }, [requestId]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!req) {
    return <DelayedLoadingView />;
  }

  const settled = req.status === 'approved' || req.status === 'rejected';
  const needsSupplement = req.status === 'needs_supplement';
  const steps = stepsOf(req);
  const reason = needsSupplement ? req.supplementReason : req.status === 'rejected' ? req.rejectionReason : null;

  return (
    <Screen>
      <NavBar title="인증 결과" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero
          eyebrow={`${formatDateDot(req.receivedAt)} 접수`}
          title={HERO[req.status]}
          sub={`${VERIFICATION_LEVEL_RULES[req.targetLevel].label} 신청 · ${HERO_SUB[req.status]}`}
        />

        <Section label="처리 단계">
          {steps.map((step, index) => (
            <ListRow
              key={step.label}
              left={<RadioDot on={step.done} />}
              title={step.label}
              titleColor={step.done ? 'text' : 'textAssistive'}
              sub={step.sub}
              subLines={1}
              right={index === steps.length - 1 && req.status === 'approved' ? <Badge label="완료" tone="ok" /> : null}
            />
          ))}
        </Section>

        {req.status === 'approved' ? (
          <Section label="반영된 곳">
            <ListRow
              title="자료 확인 단계"
              sub={`${VERIFICATION_LEVEL_RULES[req.targetLevel].label}로 올랐어요`}
              subLines={1}
              right={<Badge label="인증" tone="ok" />}
            />
            <ListRow title="다른 사람의 비교" sub="확인을 마친 자료만 기준이 돼요" subLines={1} />
          </Section>
        ) : null}

        {reason ? (
          <View style={styles.noteWrap}>
            <NoteCard title={needsSupplement ? '더 필요한 것' : '반영하지 않은 이유'} body={reason} />
          </View>
        ) : settled ? (
          <View style={styles.noteWrap}>
            <NoteCard
              title="올려주신 원본은 지웠어요"
              body={`확인이 끝나 ${formatDateDot(req.decidedAt ?? req.receivedAt)}에 삭제했어요.`}
            />
          </View>
        ) : null}
      </ScrollView>

      {needsSupplement ? (
        <Dock>
          <DockButton
            variant="primary"
            label="자료 보완하기"
            onPress={() =>
              router.replace({ pathname: '/(tabs)/capture/verify/[quoteId]', params: { quoteId: req.quoteId } })
            }
          />
        </Dock>
      ) : !settled ? (
        <Dock>
          <DockButton label="새로고침" onPress={load} />
        </Dock>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
});
