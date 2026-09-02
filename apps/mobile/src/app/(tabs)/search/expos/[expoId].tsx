import type { ExpoDetail } from '@weddingpick/api-contract';
import { googleCalendarLink, outlookCalendarLink } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpo } from '@/api/client';
import {
  cancelExpoReminder,
  isExpoReminderSet,
  scheduleExpoReminder,
} from '@/features/expos/expo-reminder';
import {
  ActionButton,
  BottomSheet,
  ErrorView,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const fmt = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;

  return start.toDateString() === end.toDateString()
    ? fmt(start)
    : `${fmt(start)} ~ ${fmt(end)}`;
}

/**
 * WP-EXPO-002 박람회 상세.
 *
 * 알림·캘린더 등록 둘 다 서버에 아무것도 남기지 않는다 — 이 콘텐츠는 사용자
 * 개인 데이터가 아니라 운영이 올리는 공개 정보라, "누가 무엇에 알림을
 * 걸었는지"를 서버가 알 이유가 없다.
 */
export default function ExpoDetailScreen() {
  const { expoId } = useLocalSearchParams<{ expoId: string }>();
  const [expo, setExpo] = useState<ExpoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    getExpo(expoId)
      .then(setExpo)
      .catch((caught: Error) => setError(caught.message));
  }, [expoId]);

  useEffect(() => {
    isExpoReminderSet(expoId).then(setReminderOn);
  }, [expoId]);

  async function toggleReminder() {
    if (!expo || reminderBusy) return;

    setReminderBusy(true);
    setReminderNote(null);

    try {
      if (reminderOn) {
        await cancelExpoReminder(expo.id);
        setReminderOn(false);

        return;
      }

      const result = await scheduleExpoReminder(expo);

      if (result.ok) {
        setReminderOn(true);
        return;
      }

      setReminderNote(
        result.reason === 'permission_denied'
          ? result.canAskAgain
            ? '알림 권한을 켜주셔야 알려드릴 수 있어요.'
            : '이미 거부하셔서 설정에서 알림 권한을 켜주셔야 해요.'
          : result.reason === 'too_late'
            ? '시작이 하루도 안 남아 알림을 걸 수 없어요.'
            : '알림을 걸지 못했어요.'
      );

      if (result.reason === 'permission_denied' && !result.canAskAgain) {
        void Linking.openSettings();
      }
    } finally {
      setReminderBusy(false);
    }
  }

  async function share() {
    if (!expo) return;

    try {
      await Share.share({ message: `${expo.name}\n${formatRange(expo.startsAt, expo.endsAt)}` });
    } catch {
      // 공유 시트를 닫은 경우가 대부분이라 따로 알리지 않는다.
    }
  }

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!expo) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">{expo.name}</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {formatRange(expo.startsAt, expo.endsAt)}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <Row label="장소" value={expo.venue ?? '아직 확인되지 않았어요'} />
            <Row label="주최" value={expo.organizer ?? '아직 확인되지 않았어요'} />
            <Row label="지역" value={expo.region} />
          </ThemedView>

          {expo.benefitsNote ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">참가 혜택</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {expo.benefitsNote}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedText type="t7" themeColor="textAssistive">
            {new Date(expo.lastVerifiedAt).toLocaleDateString('ko-KR')} 기준으로 확인한 정보예요
          </ThemedText>

          <ThemedView style={styles.section}>
            {expo.registrationUrl ? (
              <ActionButton
                variant="primary"
                label="사전등록하기"
                onPress={() => void Linking.openURL(expo.registrationUrl!)}
              />
            ) : null}
            <ActionButton
              label={reminderBusy ? '처리하는 중…' : reminderOn ? '알림 끄기' : '하루 전 알림 받기'}
              disabled={reminderBusy}
              onPress={() => void toggleReminder()}
            />
            {reminderNote ? (
              <ThemedText type="small" themeColor="textSecondary">
                {reminderNote}
              </ThemedText>
            ) : null}
            <ActionButton label="캘린더에 등록" onPress={() => setCalendarOpen(true)} />
            <ActionButton label="공유하기" onPress={() => void share()} />
            <ActionButton label="목록으로 돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <BottomSheet visible={calendarOpen} onDismiss={() => setCalendarOpen(false)}>
        <ThemedText type="t4">캘린더에 등록</ThemedText>
        <ThemedText type="t6" themeColor="textSecondary">
          Apple 캘린더는 아직 지원하지 않아요.
        </ThemedText>
        <ActionButton
          label="Google 캘린더"
          onPress={() => {
            setCalendarOpen(false);
            void Linking.openURL(
              googleCalendarLink({
                title: expo.name,
                startsAt: expo.startsAt,
                endsAt: expo.endsAt,
                location: expo.venue ?? undefined,
              })
            );
          }}
        />
        <ActionButton
          label="Outlook 캘린더"
          onPress={() => {
            setCalendarOpen(false);
            void Linking.openURL(
              outlookCalendarLink({
                title: expo.name,
                startsAt: expo.startsAt,
                endsAt: expo.endsAt,
                location: expo.venue ?? undefined,
              })
            );
          }}
        />
        <ActionButton label="닫기" onPress={() => setCalendarOpen(false)} />
      </BottomSheet>
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
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
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
