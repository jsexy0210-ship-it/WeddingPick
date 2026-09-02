import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

// TODO: API 미구현 — GET /v1/expos/:expoId (박람회 상세)
type ExpoStatus = 'upcoming' | 'ongoing' | 'closed';

type ExpoDetail = {
  id: string;
  title: string;
  organizer: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  region: string;
  status: ExpoStatus;
  isDeadlineSoon: boolean;
  registrationDeadline: string | null;
  benefits: string[];
  description: string;
  notifyEnabled: boolean;
};

const STATUS_LABEL: Record<ExpoStatus, string> = {
  upcoming: '진행예정',
  ongoing: '진행중',
  closed: '종료',
};

const STATUS_TINT: Record<ExpoStatus, string> = {
  upcoming: '#5856D6',
  ongoing: '#34C759',
  closed: '#8E8E93',
};

/**
 * 박람회 상세. 핸드오프 WP-EXPO-002.
 * 진행예정·진행중·종료 상태별 UI 분기.
 */
export default function ExpoDetailScreen() {
  const { expoId } = useLocalSearchParams<{ expoId: string }>();

  // TODO: API 미구현 — expoId로 박람회 상세 조회
  const expo = null as ExpoDetail | null;

  if (!expo) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            {/* TODO: API 미구현 — expoId로 박람회 상세 조회 */}
            <ThemedText type="t7" themeColor="textSecondary">
              박람회 정보를 불러올 수 없습니다.
            </ThemedText>
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isClosed = expo.status === 'closed';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 상태 뱃지 */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: STATUS_TINT[expo.status] }]}>
              <ThemedText type="badge" style={styles.badgeText}>
                {STATUS_LABEL[expo.status]}
              </ThemedText>
            </View>
            {expo.isDeadlineSoon && !isClosed && (
              <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
                <ThemedText type="badge" style={styles.badgeText}>
                  마감 임박
                </ThemedText>
              </View>
            )}
          </View>

          {/* 제목 */}
          <ThemedText type="t2">{expo.title}</ThemedText>

          {/* 일정 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6">일정</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {expo.startsAt} ~ {expo.endsAt}
            </ThemedText>
            {expo.registrationDeadline && (
              <ThemedText type="t7" themeColor="textSecondary">
                사전등록 마감: {expo.registrationDeadline}
              </ThemedText>
            )}
          </ThemedView>

          {/* 장소 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6">장소</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {expo.venue}
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {expo.address}
            </ThemedText>
          </ThemedView>

          {/* 주최사 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6">주최사</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {expo.organizer}
            </ThemedText>
          </ThemedView>

          {/* 혜택 */}
          {expo.benefits.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6">혜택</ThemedText>
              {expo.benefits.map((benefit, i) => (
                <ThemedText key={i} type="t7" themeColor="textSecondary">
                  · {benefit}
                </ThemedText>
              ))}
            </ThemedView>
          )}

          {/* 상세 설명 */}
          {expo.description ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6">박람회 소개</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                {expo.description}
              </ThemedText>
            </ThemedView>
          ) : null}

          {/* 종료된 경우 안내 */}
          {isClosed && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                이 박람회는 이미 종료되었습니다.
              </ThemedText>
            </ThemedView>
          )}

          {/* 액션 버튼 영역 */}
          {!isClosed && (
            <ThemedView style={styles.actions}>
              {/* TODO: API 미구현 — 사전등록 / 알림 설정 */}
              {expo.registrationDeadline && (
                <ActionButton
                  label="사전등록"
                  onPress={() => {
                    // TODO: API 미구현 — 사전등록 처리
                  }}
                />
              )}
              <ActionButton
                label={expo.notifyEnabled ? '알림 해제' : '알림 받기'}
                onPress={() => {
                  // TODO: API 미구현 — 알림 토글
                }}
              />
              <ActionButton
                label="캘린더에 추가"
                onPress={() => router.push(`/search/expo/${expoId}/calendar`)}
              />
            </ThemedView>
          )}

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
    flex: 1,
    padding: Layout.gutter,
    gap: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  badgeRow: { flexDirection: 'row', gap: Spacing.one },
  badge: { borderRadius: Radius.small, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff' },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  actions: { gap: Spacing.two },
});
