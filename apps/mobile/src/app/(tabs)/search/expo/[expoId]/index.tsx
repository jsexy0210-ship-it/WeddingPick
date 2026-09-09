import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpo, toggleExpoNotify, type ExpoDetail, type ExpoStatus } from '@/api/client';
import { BackBar } from '@/components/back-bar';
import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

const STATUS_LABEL: Record<ExpoStatus, string> = {
  upcoming: '진행 예정',
  ongoing: '진행 중',
  closed: '종료',
};

/** 스켈레톤 — 박람회 상세 페이지 뼈대. */
function ExpoDetailSkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Skeleton height={19} width="30%" />
      <Skeleton height={35} width="80%" />
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={22} width="30%" />
        <Skeleton height={19} width="60%" />
        <Skeleton height={19} width="50%" />
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={22} width="20%" />
        <Skeleton height={19} width="70%" />
        <Skeleton height={19} width="55%" />
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={22} width="20%" />
        <Skeleton height={19} width="50%" />
      </ThemedView>
    </ScrollView>
  );
}

/**
 * 박람회 상세. 핸드오프 WP-EXPO-002.
 * 상태: 진행 예정 / 진행 중 / 종료.
 * 진행 예정·중이면 사전등록·알림·캘린더 CTA를 보여준다.
 * 종료된 박람회는 종료 안내만 보여준다.
 */
export default function ExpoDetailScreen() {
  const theme = useTheme();
  const { expoId } = useLocalSearchParams<{ expoId: string }>();
  const [expo, setExpo] = useState<ExpoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifyLoading, setNotifyLoading] = useState(false);

  const load = useCallback(() => {
    if (!expoId) return;
    setError(null);
    setExpo(null);
    getExpo(expoId)
      .then(setExpo)
      .catch(() => setError('박람회 정보를 불러오지 못했어요'));
  }, [expoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function retry() {
    load();
  }

  async function handleNotifyToggle() {
    if (!expo || notifyLoading) return;
    setNotifyLoading(true);
    const newEnabled = !expo.notifyEnabled;
    try {
      await toggleExpoNotify(expoId!, newEnabled);
      setExpo((prev) => prev ? { ...prev, notifyEnabled: newEnabled } : prev);
    } catch {
      // 실패 시 기존 상태 유지 — 조용히 넘어간다
    } finally {
      setNotifyLoading(false);
    }
  }

  const STATUS_COLOR: Record<ExpoStatus, string> = {
    upcoming: theme.tint,
    ongoing: theme.positive,
    closed: theme.tintInactive,
  };

  if (error) {
    return (
      <ErrorView
        title={error}
        onRetry={retry}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  if (!expo) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <BackBar />
          <ExpoDetailSkeleton />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isClosed = expo.status === 'closed';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 상태 배지 */}
          <ThemedView style={styles.badgeRow}>
            <ThemedView
              style={[styles.badge, { backgroundColor: STATUS_COLOR[expo.status] }]}>
              <ThemedText type="badge" style={{ color: theme.onTint }}>
                {STATUS_LABEL[expo.status]}
              </ThemedText>
            </ThemedView>
            {expo.isDeadlineSoon && !isClosed && (
              <ThemedView style={[styles.badge, { backgroundColor: theme.negative }]}>
                <ThemedText type="badge" style={{ color: theme.onTint }}>
                  마감 임박
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* 제목 */}
          <ThemedText type="t2">{expo.title}</ThemedText>

          {/* 일정 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6" style={styles.sectionLabel}>
              일정
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {expo.startsAt} ~ {expo.endsAt}
            </ThemedText>
            {expo.registrationDeadline ? (
              <ThemedText type="t7" themeColor="textSecondary">
                사전등록 마감 {expo.registrationDeadline}
              </ThemedText>
            ) : null}
          </ThemedView>

          {/* 장소 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6" style={styles.sectionLabel}>
              장소
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {expo.venue}
            </ThemedText>
            <ThemedText type="t7" themeColor="textAssistive">
              {expo.address}
            </ThemedText>
          </ThemedView>

          {/* 주최사 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6" style={styles.sectionLabel}>
              주최사
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {expo.organizer}
            </ThemedText>
          </ThemedView>

          {/* 혜택 */}
          {expo.benefits.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" style={styles.sectionLabel}>
                혜택
              </ThemedText>
              {expo.benefits.map((benefit, i) => (
                <ThemedText key={i} type="t7" themeColor="textSecondary">
                  {benefit}
                </ThemedText>
              ))}
            </ThemedView>
          ) : null}

          {/* 박람회 소개 */}
          {expo.description ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" style={styles.sectionLabel}>
                박람회 소개
              </ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                {expo.description}
              </ThemedText>
            </ThemedView>
          ) : null}

          {/* 출처·마지막 확인일 */}
          <ThemedText type="t7" themeColor="textAssistive">
            출처 {expo.sourceNote} · 마지막 확인 {expo.lastVerifiedAt}
          </ThemedText>

          {/* 종료 안내 */}
          {isClosed ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                이미 종료된 박람회예요
              </ThemedText>
            </ThemedView>
          ) : (
            /* CTA — 진행 예정·중일 때만 노출 */
            <ThemedView style={styles.actions}>
              {/* Primary CTA: 사전등록이 있으면 사전등록, 없으면 알림 받기 */}
              {expo.registrationDeadline ? (
                <ActionButton
                  variant="primary"
                  size="xlarge"
                  label="사전등록"
                  onPress={() => {
                    // 사전등록 링크 — 서버에 별도 필드 추가 시 연동
                  }}
                />
              ) : (
                <ActionButton
                  variant="primary"
                  size="xlarge"
                  label={notifyLoading ? '처리 중' : expo.notifyEnabled ? '알림 해제' : '알림 받기'}
                  onPress={handleNotifyToggle}
                />
              )}
              {/* 사전등록이 있을 때는 알림 받기를 Secondary로 */}
              {expo.registrationDeadline ? (
                <ActionButton
                  variant="secondary"
                  size="large"
                  label={notifyLoading ? '처리 중' : expo.notifyEnabled ? '알림 해제' : '알림 받기'}
                  onPress={handleNotifyToggle}
                />
              ) : null}
              <ActionButton
                variant="secondary"
                size="large"
                label="캘린더에 추가"
                onPress={() => router.push(`/search/expo/${expoId}/calendar`)}
              />
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  scrollContent: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },
  badgeRow: { flexDirection: 'row', gap: Spacing.one },
  badge: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  sectionLabel: { fontWeight: '700' },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
