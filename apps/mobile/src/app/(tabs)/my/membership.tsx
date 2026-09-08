import type { CurrentUser, MyMonthlyDrawResponse } from '@weddingpick/api-contract';
import {
  MEMBER_TIER_LABEL,
  MISSIONS,
  MISSION_HEADLINE,
  type MembershipFacts,
  isMissionDone,
  missionProgress,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, getMyMonthlyDraw } from '@/api/client';

/**
 * 내 등급과 미션. 디자인 핸드오프 17번.
 *
 * **등급은 막는 장치가 아니라 보여주는 장치다.** 어디까지 왔는지를 말하는 이름이다.
 * 다음 등급 조건을 보여주되, 안 채웠다고 기능을 잠그지 않는다.
 */
export default function MembershipScreen() {
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [draw, setDraw] = useState<MyMonthlyDrawResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    void getCurrentUser()
      .then((response) => {
        setLoadError(null);
        setMe(response);
      })
      .catch((caught: Error) =>
        setLoadError(caught.message ?? '정보를 불러오지 못했어요.')
      );

    // 월간 웨딩지원금은 실패해도 나머지를 막지 않는다.
    void getMyMonthlyDraw()
      .then(setDraw)
      .catch(() => setDraw(null));
  }, []);

  useEffect(load, [load]);

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (!me) {
    return <LoadingView />;
  }

  const facts: MembershipFacts = {
    loggedIn: true,
    spouseLinked: me.spouseLinked,
    hasPaymentProof: me.hasPaymentProof,
    weddingSet: me.setupComplete,
    hasPick: me.hasPick,
    hasCompared: me.hasCompared,
  };

  const progress = missionProgress(facts);

  /** 다음 등급 안내. 각 등급의 다음 조건 한 줄. */
  function nextTierHint(tier: CurrentUser['tier']): string {
    switch (tier) {
      case 'guest':
        return '로그인하면 메이트가 돼요';
      case 'mate':
        return '배우자와 연결하면 프렌드가 돼요';
      case 'friend':
        return 'Pick 인증을 내면 패밀리가 돼요';
      case 'family':
        return '최상위 등급이에요';
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">내 등급</ThemedText>

          {/* 현재 등급 */}
          <ThemedView type="backgroundElement" style={styles.tierCard}>
            <ThemedText type="t7" themeColor="textSecondary">
              현재 등급
            </ThemedText>
            <ThemedText type="t1" themeColor="tint">
              {me.tierLabel}
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {nextTierHint(me.tier)}
            </ThemedText>

            {/* 4단계 시각 표시 */}
            <View style={styles.tierSteps}>
              {(['guest', 'mate', 'friend', 'family'] as const).map((step) => {
                const tiers = ['guest', 'mate', 'friend', 'family'];
                const currentIdx = tiers.indexOf(me.tier);
                const stepIdx = tiers.indexOf(step);
                const reached = stepIdx <= currentIdx;

                return (
                  <View key={step} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: reached ? theme.tint : theme.track,
                        },
                      ]}
                    />
                    <ThemedText
                      type="t7"
                      themeColor={reached ? 'tint' : 'textAssistive'}
                    >
                      {MEMBER_TIER_LABEL[step]}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </ThemedView>

          {/* 미션 */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHead}>
              <ThemedText type="t4">{MISSION_HEADLINE}</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                {progress.done}/{progress.total} 완료
              </ThemedText>
            </ThemedView>

            {MISSIONS.map((mission) => {
              const done = isMissionDone(mission.key, facts);

              return (
                <ThemedView
                  key={mission.key}
                  type="backgroundElement"
                  style={styles.missionRow}
                >
                  <View
                    style={[
                      styles.missionCheck,
                      {
                        borderColor: done ? theme.tint : theme.border,
                        backgroundColor: done ? theme.tint : 'transparent',
                      },
                    ]}
                  />
                  <View style={styles.missionText}>
                    <ThemedText
                      type="t5"
                      themeColor={done ? 'textAssistive' : 'text'}
                    >
                      {mission.title}
                    </ThemedText>
                    {!done ? (
                      <ThemedText type="t7" themeColor="textSecondary">
                        {mission.description}
                      </ThemedText>
                    ) : null}
                  </View>
                </ThemedView>
              );
            })}
          </ThemedView>

          {/* 월간 웨딩지원금 */}
          <ThemedView style={styles.section}>
            <ThemedText type="t4">웨딩지원금 응모</ThemedText>
            {draw ? (
              <ThemedView type="backgroundElement" style={styles.drawCard}>
                <View style={styles.drawHead}>
                  <ThemedText type="t5">{draw.drawMonth} 응모</ThemedText>
                  <ThemedText
                    type="badge"
                    themeColor={draw.status === 'won' ? 'positive' : 'textAssistive'}
                  >
                    {draw.statusLabel}
                  </ThemedText>
                </View>
                <ThemedText type="t7" themeColor="textSecondary">
                  {draw.statusNote}
                </ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  매월 {draw.winnersPerMonth}명 추첨 · 1인 {draw.amountKrw.toLocaleString('ko-KR')}원
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedText type="t6" themeColor="textSecondary">
                이번 달 응모 현황을 불러오지 못했어요
              </ThemedText>
            )}
            <ActionButton
              label="자세히 보기"
              onPress={() => router.push('/my/rewards')}
            />
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
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  tierCard: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  tierSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  stepItem: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    minHeight: Layout.rowMinHeight,
  },
  missionCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 2,
    flexShrink: 0,
  },
  missionText: {
    flex: 1,
    gap: 2,
  },
  drawCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  drawHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
