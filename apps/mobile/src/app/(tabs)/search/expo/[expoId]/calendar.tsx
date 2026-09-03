import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet } from 'react-native';
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

// TODO: API 미구현 — GET /v1/expos/:expoId (캘린더 추가용 박람회 일정 조회)
type CalendarOption = 'google' | 'apple' | 'outlook';

const CALENDAR_LABEL: Record<CalendarOption, string> = {
  google: 'Google 캘린더',
  apple: 'Apple 캘린더',
  outlook: 'Outlook',
};

const CALENDAR_OPTIONS: CalendarOption[] = ['google', 'apple', 'outlook'];

function buildGoogleCalendarUrl(params: {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  details: string;
}): string {
  const start = params.startsAt.replace(/[-:]/g, '').replace('T', 'T');
  const end = params.endsAt.replace(/[-:]/g, '').replace('T', 'T');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${start}/${end}`,
    location: params.location,
    details: params.details,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function buildOutlookUrl(params: {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  body: string;
}): string {
  const q = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: params.title,
    startdt: params.startsAt,
    enddt: params.endsAt,
    location: params.location,
    body: params.body,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

/**
 * 외부 캘린더 등록. 핸드오프 WP-EXPO-005.
 * Google·Apple·Outlook을 지원하며, 플랫폼별로 분기한다.
 * Apple 캘린더는 iOS 전용 — Android에서는 비노출.
 */
export default function CalendarScreen() {
  const { expoId } = useLocalSearchParams<{ expoId: string }>();
  const [adding, setAdding] = useState<CalendarOption | null>(null);

  // TODO: API 미구현 — expoId로 박람회 일정 조회 후 실제 값으로 교체
  const expoTitle = '웨딩 박람회';
  const expoStartsAt = '';
  const expoEndsAt = '';
  const expoVenue = '';
  const expoAddress = '';

  async function handleAdd(option: CalendarOption) {
    setAdding(option);

    try {
      if (option === 'google') {
        const url = buildGoogleCalendarUrl({
          title: expoTitle,
          startsAt: expoStartsAt,
          endsAt: expoEndsAt,
          location: expoAddress || expoVenue,
          details: `웨딩픽 박람회 정보: ${expoId}`,
        });
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          Alert.alert('열 수 없어요', 'Google 캘린더를 열 수 없어요. 브라우저가 설치되어 있는지 확인해주세요.');
          return;
        }
        await Linking.openURL(url);
      } else if (option === 'apple') {
        if (Platform.OS !== 'ios') {
          Alert.alert('지원 안 해요', 'Apple 캘린더는 iPhone에서만 쓸 수 있어요.');
          return;
        }
        // TODO: expo-calendar 미설치 — 설치 후 Calendar.requestCalendarPermissionsAsync()
        // 권한 거부 시: Alert.alert('권한 필요', '설정에서 캘린더 접근을 허용해주세요.')
        Alert.alert(
          '준비 중이에요',
          'Apple 캘린더 직접 등록은 준비 중이에요. 직접 일정을 추가해주세요.',
          [{ text: '확인' }]
        );
      } else if (option === 'outlook') {
        const url = buildOutlookUrl({
          title: expoTitle,
          startsAt: expoStartsAt,
          endsAt: expoEndsAt,
          location: expoAddress || expoVenue,
          body: `웨딩픽 박람회`,
        });
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          Alert.alert('열 수 없어요', 'Outlook을 열 수 없어요.');
          return;
        }
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('오류', '캘린더를 열 수 없어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setAdding(null);
    }
  }

  const options =
    Platform.OS === 'ios'
      ? CALENDAR_OPTIONS
      : CALENDAR_OPTIONS.filter((o) => o !== 'apple');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">캘린더에 추가</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              박람회 일정을 캘린더에 등록해두면 잊지 않아요
            </ThemedText>
          </ThemedView>

          {/* 일정 요약 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t5">{expoTitle}</ThemedText>
            {/* TODO: API 미구현 — 실제 일정 표시 */}
            <ThemedText type="t7" themeColor="textSecondary">
              일정 정보를 가져오고 있어요
            </ThemedText>
          </ThemedView>

          {/* 캘린더 선택 */}
          <ThemedView style={styles.optionList}>
            {options.map((opt) => (
              <ActionButton
                key={opt}
                label={adding === opt ? '열고 있어요' : CALENDAR_LABEL[opt]}
                onPress={() => handleAdd(opt)}
              />
            ))}
          </ThemedView>

          {/* 권한 거부 안내 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t7" themeColor="textSecondary">
              캘린더 앱이 열리지 않으면 설정에서 접근 권한을 허용해주세요
            </ThemedText>
          </ThemedView>

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
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  header: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  optionList: { gap: Spacing.two },
});
