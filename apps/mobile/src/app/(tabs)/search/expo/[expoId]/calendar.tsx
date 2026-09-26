import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { getExpo, type ExpoDetail } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { inStack } from '@/features/navigation/stack-alias';
import { openExternal } from '@/features/open-external';
import {
  ActionButton,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

import ExpoDetailScreen from './index';

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
 * /calendar 딥링크는 박람회 상세를 남기고 DLG-D 선택 시트로 연결한다.
 */
export default function CalendarRoute() {
  const { expoId } = useLocalSearchParams<{ expoId: string }>();
  const pathname = usePathname();
  const [adding, setAdding] = useState<CalendarOption | null>(null);
  const [expo, setExpo] = useState<ExpoDetail | null>(null);
  const [loadError, setLoadError] = useState(false);

  function notify(title: string, message: string) {
    confirmAlert(title, message, [{ text: '확인' }]);
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

  function closeSheet() {
    /* 라운지 스택 별칭이면 그 스택의 박람회 상세로 접는다(`stack-alias.ts`). */
    dismissToOrReplace(inStack(pathname, `/search/expo/${expoId}`));
  }

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
          notify(
            '열 수 없어요',
            'Google 캘린더를 열 수 없어요. 브라우저가 설치되어 있는지 확인해주세요.'
          );
          return;
        }
        await openExternal(url, { handOff: true });
      } else if (option === 'apple') {
        if (Platform.OS !== 'ios') {
          notify('지원 안 해요', 'Apple 캘린더는 iPhone에서만 쓸 수 있어요.');
          return;
        }
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
        await openExternal(`data:text/calendar;charset=utf-8,${encoded}`, { handOff: true });
      } else {
        const url = buildOutlookUrl({
          title: expoTitle,
          startsAt: expoStartsAt,
          endsAt: expoEndsAt,
          location: expoAddress || expoVenue,
          body: '웨딩픽 박람회',
        });
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          notify('열 수 없어요', 'Outlook을 열 수 없어요.');
          return;
        }
        await openExternal(url, { handOff: true });
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
      : CALENDAR_OPTIONS.filter((option) => option !== 'apple');

  return (
    <View style={styles.host}>
      <ExpoDetailScreen />

      <BottomSheet visible onRequestClose={closeSheet} testID="expo-calendar-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <SheetHeader title="캘린더에 추가" onClose={closeSheet} closeDisabled={adding !== null} />
            <ThemedText type="t7" themeColor="textSecondary">
              박람회 일정을 어떤 캘린더에 넣을지 골라주세요.
            </ThemedText>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
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

            <View style={styles.optionList}>
              {options.map((option) => (
                <ActionButton
                  key={option}
                  label={adding === option ? '열고 있어요' : CALENDAR_LABEL[option]}
                  disabled={!expo || adding !== null}
                  onPress={() => void handleAdd(option)}
                />
              ))}
            </View>

            {Platform.OS !== 'web' ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t7" themeColor="textSecondary">
                  캘린더 앱이 열리지 않으면 설정에서 접근 권한을 확인해주세요.
                </ThemedText>
              </ThemedView>
            ) : null}
          </ScrollView>

          <ActionButton label="닫기" disabled={adding !== null} onPress={closeSheet} />
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHead: { gap: Spacing.one },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: Spacing.three },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  optionList: { gap: Spacing.two },
});
