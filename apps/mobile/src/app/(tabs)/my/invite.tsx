import type { MyRewardsResponse } from '@weddingpick/api-contract';
import { REFERRAL_NOTICE, REWARDS } from '@weddingpick/domain';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  FontSize,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { getMyRewards } from '@/api/client';

const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

/**
 * 친구 초대. 최종통합정책 v2.0 I장.
 *
 * **조건이 먼저다.** 보상 금액부터 보이면 조건이 안 읽히고, "가입만 하면 받는다"로
 * 기억된다 — v2.0 K-7이 폐기한 규칙이다.
 *
 * **공유와 복사는 시스템 공유 시트를 쓴다.** expo-clipboard가 없어 직접 클립보드에
 * 쓸 수 없으므로 Share.share()를 통해 코드만 내보낸다.
 */
export default function InviteScreen() {
  const theme = useTheme();
  const [data, setData] = useState<MyRewardsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    void getMyRewards()
      .then((response) => {
        setLoadError(null);
        setData(response);
      })
      .catch((caught: Error) =>
        setLoadError(caught.message ?? '초대 정보를 불러오지 못했어요.')
      );
  }, []);

  useEffect(load, [load]);

  async function copyCode() {
    if (!data) return;

    try {
      await Share.share({ message: data.referralCode });
    } catch {
      // 공유 시트를 닫은 경우가 대부분이라 따로 알리지 않는다.
    }
  }

  async function shareInvite() {
    if (!data) return;

    try {
      await Share.share({
        message: `웨딩픽 초대 코드 ${data.referralCode}\n${REFERRAL_NOTICE}`,
      });
    } catch {
      // 공유 시트를 닫은 경우가 대부분이라 따로 알리지 않는다.
    }
  }

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (!data) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">친구 초대</ThemedText>

          {/* 조건이 먼저다 */}
          <ThemedView style={[styles.notice, { backgroundColor: theme.tintSubtle }]}>
            <ThemedText type="t6" themeColor="tint">
              {REFERRAL_NOTICE}
            </ThemedText>
          </ThemedView>

          {/* 초대 코드 */}
          <ThemedView type="backgroundElement" style={styles.codeCard}>
            <ThemedText type="t7" themeColor="textSecondary">
              내 초대 코드
            </ThemedText>
            <ThemedText
              type="t1"
              numeric
              style={[styles.code, { letterSpacing: 4 }]}
            >
              {data.referralCode}
            </ThemedText>
            <ThemedText type="t7" themeColor="textAssistive">
              보상: 나 {won(REWARDS.referral.amountKrw)} · 친구 {won(REWARDS.referral.friendAmountKrw ?? REWARDS.referral.amountKrw)}
            </ThemedText>
          </ThemedView>

          <ActionButton label="코드 복사하기" onPress={() => void copyCode()} />
          <ActionButton
            variant="primary"
            label="친구에게 공유하기"
            onPress={() => void shareInvite()}
          />

          {/* 초대 현황 */}
          <ThemedText type="t4">내 초대 현황</ThemedText>

          <ThemedView style={styles.statsRow}>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText type="t7" themeColor="textSecondary">
                초대한 친구
              </ThemedText>
              <ThemedText type="t2" numeric>
                {data.invitedCount}명
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText type="t7" themeColor="textSecondary">
                조건을 채운 친구
              </ThemedText>
              <ThemedText type="t2" numeric themeColor="tint">
                {data.qualifiedCount}명
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {data.invitedCount === 0 ? (
            <ThemedText type="t6" themeColor="textSecondary">
              아직 초대한 친구가 없어요
            </ThemedText>
          ) : null}

          {/* 받은 보상 */}
          {data.grants.length > 0 ? (
            <>
              <ThemedText type="t4">받은 보상</ThemedText>
              {data.grants
                .filter((grant) => grant.kind === 'referral')
                .map((grant) => (
                  <ThemedView key={grant.id} type="backgroundElement" style={styles.grantCard}>
                    <ThemedView type="backgroundElement" style={styles.grantHead}>
                      <ThemedText type="t5">{grant.kindLabel} {won(grant.amountKrw)}</ThemedText>
                      <ThemedText
                        type="badge"
                        themeColor={grant.status === 'paid' ? 'positive' : 'textAssistive'}
                      >
                        {grant.statusLabel}
                      </ThemedText>
                    </ThemedView>
                    <ThemedText type="t7" themeColor="textSecondary">
                      {grant.statusNote}
                    </ThemedText>
                  </ThemedView>
                ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
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
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  notice: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  codeCard: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: FontSize.t1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  grantCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  grantHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
