import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpo, type ExpoDetail } from '@/api/client';
import { BackBar } from '@/components/back-bar';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

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
  const [expo, setExpo] = useState<ExpoDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  /**
   * 웹 안내 문구 — `Alert.alert`는 react-native-web에서 아무 동작도 하지 않는
   * 빈 구현이라, 웹에서는 캘린더 열기를 실패해도 사용자에게 아무 것도 보이지
   * 않는다. 웹에서만 화면 안에 문구를 대신 띄운다.
   */
  const [webNotice, setWebNotice] = useState<string | null>(null);

  /** 네이티브는 Alert, 웹은 화면 안 안내 문구로 갈라 보여준다. */
  function notify(title: string, message: string) {
    if (Platform.OS === 'web') {
      setWebNotice(message);
    } else {
      Alert.alert(title, message);
    }
  }

  useEffect(() => {
    if (!expoId) return;
    getExpo(expoId)
      .then(setExpo)
      .catch(() => setLoadError(true));
  }, [expoId]);

  const expoTitle = expo?.title ?? '웨딩 박람회';
  const expoStartsAt = expo?.startsAt ?? '';
  const expoEndsAt = expo?.endsAt ?? '';
  const expoVenue = expo?.venue ?? '';
  const expoAddress = expo?.address ?? '';

  async function handleAdd(option: CalendarOption) {
    setAdding(option);
    setWebNotice(null);

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
          notify('열 수 없어요', 'Google 캘린더를 열 수 없어요. 브라우저가 설치되어 있는지 확인해주세요.');
          return;
        }
        await Linking.openURL(url);
      } else if (option === 'apple') {
        if (Platform.OS !== 'ios') {
          notify('지원 안 해요', 'Apple 캘린더는 iPhone에서만 쓸 수 있어요.');
          return;
        }
        // .ics 데이터 URI를 열면 iOS가 캘린더 앱으로 바로 넘긴다 — 네이티브 모듈 불필요.
        const ics = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'BEGIN:VEVENT',
          `SUMMARY:${expoTitle}`,
          `DTSTART:${expoStartsAt.replace(/[-:]/g, '').slice(0, 8)}`,
          `DTEND:${expoEndsAt.replace(/[-:]/g, '').slice(0, 8)}`,
          `LOCATION:${expoAddress || expoVenue}`,
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n');
        const encoded = encodeURIComponent(ics);
        await Linking.openURL(`data:text/calendar;charset=utf-8,${encoded}`);
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
          notify('열 수 없어요', 'Outlook을 열 수 없어요.');
          return;
        }
        await Linking.openURL(url);
      }
    } catch {
      notify('오류', '캘린더를 열 수 없어요. 잠시 후 다시 시도해주세요.');
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
        <BackBar />
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
            {loadError ? (
              <ThemedText type="t7" themeColor="textSecondary">
                일정 정보를 불러오지 못했어요
              </ThemedText>
            ) : expo ? (
              <>
                {expoVenue ? (
                  <ThemedText type="t7" themeColor="textSecondary">
                    {expoVenue}
                  </ThemedText>
                ) : null}
                {expoStartsAt ? (
                  <ThemedText type="t7" themeColor="textSecondary">
                    {expoStartsAt.slice(0, 10)} ~ {expoEndsAt.slice(0, 10)}
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <ThemedText type="t7" themeColor="textSecondary">
                일정 정보를 가져오고 있어요
              </ThemedText>
            )}
          </ThemedView>

          {/* 웹 안내 문구 — Alert가 뜨지 않는 웹에서 실패를 조용히 넘기지 않는다 */}
          {webNotice ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="negative">
                {webNotice}
              </ThemedText>
            </ThemedView>
          ) : null}

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

          {/* 권한 거부 안내 — "설정" 앱 개념이 없는 웹에서는 보여주지 않는다 */}
          {Platform.OS !== 'web' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                캘린더 앱이 열리지 않으면 설정에서 접근 권한을 허용해주세요
              </ThemedText>
            </ThemedView>
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
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  header: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  optionList: { gap: Spacing.two },
});
