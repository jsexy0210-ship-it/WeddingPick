import type { VerificationRequest } from '@weddingpick/api-contract';
import { VERIFICATION_LEVEL_RULES } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getVerificationRequest } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function statusLabel(status: VerificationRequest['status']): string {
  switch (status) {
    case 'received': return '접수 완료';
    case 'in_review': return '심사 중';
    case 'approved': return '승인';
    case 'rejected': return '반려';
  }
}

function statusHint(status: VerificationRequest['status']): string {
  switch (status) {
    case 'received': return '올려주신 자료를 아직 확인하지 않았어요. 확인이 끝나면 알려드려요.';
    case 'in_review': return '자료를 확인하고 있어요. 조금만 기다려 주세요.';
    case 'approved': return '자료 확인이 끝났어요. 인증 단계가 올랐어요.';
    case 'rejected': return '자료 확인이 끝났어요. 아래 사유를 확인해 주세요.';
  }
}

/**
 * 인증 신청 진행 상황.
 *
 * 접수·심사 중·승인·반려 중 어느 상태인지 보여준다. 반려면 사유도 함께 보인다.
 * requestId는 createVerificationRequest 응답에서 온다.
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
    return <LoadingView />;
  }

  const isSettled = req.status === 'approved' || req.status === 'rejected';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">인증 신청 진행 상황</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              신청 목표 단계: {VERIFICATION_LEVEL_RULES[req.targetLevel].label}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t5">{statusLabel(req.status)}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {statusHint(req.status)}
            </ThemedText>
            <ThemedText type="t7" themeColor="textAssistive">
              접수일: {formatDate(req.receivedAt)}
            </ThemedText>
            {isSettled && req.decidedAt ? (
              <ThemedText type="t7" themeColor="textAssistive">
                처리일: {formatDate(req.decidedAt)}
              </ThemedText>
            ) : null}
          </ThemedView>

          {req.status === 'rejected' && req.rejectionReason ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">반려 사유</ThemedText>
              <ThemedText type="t6">{req.rejectionReason}</ThemedText>
            </ThemedView>
          ) : null}

          {!isSettled ? (
            <ActionButton label="새로고침" onPress={load} />
          ) : null}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  section: { gap: Spacing.one, marginBottom: Spacing.two },
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.two },
});
