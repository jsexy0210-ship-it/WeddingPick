import type { WeddingEvent } from '@weddingpick/api-contract';
import { formatEventDateTime } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listWeddingEvents, removeWeddingEvent, updateWeddingEvent } from '@/api/client';
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
  WeddingCalendar,
  useTheme,
} from '@weddingpick/ui';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const splitStartsAt = (isoDateTime: string) => {
  const value = new Date(isoDateTime);
  const date = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate()
  ).padStart(2, '0')}`;
  const time = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(
    2,
    '0'
  )}`;

  return { date, time };
};

/**
 * 일정 상세. 핸드오프 WP-OUR-005.
 *
 * 단건 조회 API를 따로 두지 않는다 — wedding_tasks·visit_notes와 같은 이유로,
 * 목록을 불러와 id로 찾는다. 외부 캘린더 등록(WP-EXPO-005)은 이 화면 범위가
 * 아니다 — 손대지 않는다.
 */
export default function WeddingEventDetailScreen() {
  const { id, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const theme = useTheme();

  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [vendorLabel, setVendorLabel] = useState('');
  const [memo, setMemo] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  const load = useCallback(() => {
    listWeddingEvents(id)
      .then((page) => {
        const found = page.events.find((row) => row.id === eventId) ?? null;

        setEvent(found);
        setNotFound(found === null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [id, eventId]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (notFound) {
    return <ErrorView title="일정을 찾을 수 없어요" onBack={() => router.back()} />;
  }

  if (!event) {
    return <LoadingView />;
  }

  function startEditing() {
    const split = splitStartsAt(event!.startsAt);

    setTitle(event!.title);
    setDate(split.date);
    setTime(split.time);
    setLocation(event!.location ?? '');
    setVendorLabel(event!.vendorLabel ?? '');
    setMemo(event!.memo ?? '');
    setNotifyEnabled(event!.notifyEnabled);
    setEditing(true);
  }

  const ready = title.trim().length > 0 && date !== null && TIME_PATTERN.test(time);

  async function save() {
    if (!ready || date === null) return;

    setSaving(true);
    setError(null);

    try {
      await updateWeddingEvent(id, eventId, {
        title: title.trim(),
        startsAt: new Date(`${date}T${time}:00`).toISOString(),
        location: location.trim() === '' ? null : location.trim(),
        vendorLabel: vendorLabel.trim() === '' ? null : vendorLabel.trim(),
        memo: memo.trim() === '' ? null : memo.trim(),
        notifyEnabled,
      });

      setEditing(false);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '고치지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleNotify(next: boolean) {
    setNotifyEnabled(next);

    try {
      await updateWeddingEvent(id, eventId, { notifyEnabled: next });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '고치지 못했어요.');
    }
  }

  function remove() {
    Alert.alert('일정 빼기', '이 일정을 빼시겠어요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '빼기',
        style: 'destructive',
        onPress: () =>
          removeWeddingEvent(id, eventId)
            .then(() => router.back())
            .catch((caught: Error) => setError(caught.message ?? '지우지 못했어요.')),
      },
    ]);
  }

  if (editing) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="t2">일정 고치기</ThemedText>

            <ThemedText type="t7" themeColor="textSecondary">
              제목
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={title}
              onChangeText={setTitle}
              accessibilityLabel="제목"
            />

            <ThemedText type="t7" themeColor="textSecondary">
              날짜
            </ThemedText>
            <WeddingCalendar value={date} onChange={setDate} today={new Date(1970, 0, 1)} />

            <ThemedText type="t7" themeColor="textSecondary">
              시각 (HH:MM)
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="시각"
            />

            <ThemedText type="t7" themeColor="textSecondary">
              장소
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={location}
              onChangeText={setLocation}
              accessibilityLabel="장소"
            />

            <ThemedText type="t7" themeColor="textSecondary">
              관련 업체
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={vendorLabel}
              onChangeText={setVendorLabel}
              accessibilityLabel="관련 업체"
            />

            <ThemedText type="t7" themeColor="textSecondary">
              메모
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.memo,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
              value={memo}
              onChangeText={setMemo}
              multiline
              accessibilityLabel="메모"
            />

            <View style={styles.switchRow}>
              <ThemedText type="t6">알림</ThemedText>
              <Switch
                value={notifyEnabled}
                onValueChange={setNotifyEnabled}
                accessibilityLabel="알림"
                trackColor={{ true: theme.tint, false: theme.track }}
              />
            </View>

            {error ? (
              <ThemedText type="t7" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}

            <ThemedView style={styles.actions}>
              <ActionButton label="취소" onPress={() => setEditing(false)} />
              <ActionButton
                variant="primary"
                label="저장"
                disabled={!ready || saving}
                onPress={() => void save()}
              />
            </ThemedView>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">{event.title}</ThemedText>
          <ThemedText type="t7" themeColor="textSecondary">
            {formatEventDateTime(event.startsAt)}
          </ThemedText>

          {event.location ? (
            <ThemedView style={styles.section}>
              <ThemedText type="t6">장소</ThemedText>
              <ThemedText type="t7">{event.location}</ThemedText>
            </ThemedView>
          ) : null}

          {event.vendorLabel ? (
            <ThemedView style={styles.section}>
              <ThemedText type="t6">관련 업체</ThemedText>
              <ThemedText type="t7">{event.vendorLabel}</ThemedText>
            </ThemedView>
          ) : null}

          {event.memo ? (
            <ThemedView style={styles.section}>
              <ThemedText type="t6">메모</ThemedText>
              <ThemedText type="t7">{event.memo}</ThemedText>
            </ThemedView>
          ) : null}

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <ThemedText type="t6">알림</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                일정 전에 알려드려요
              </ThemedText>
            </View>
            <Switch
              value={event.notifyEnabled}
              onValueChange={(next) => void toggleNotify(next)}
              accessibilityLabel="알림"
              trackColor={{ true: theme.tint, false: theme.track }}
            />
          </View>

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}

          <ThemedView style={styles.actions}>
            <ActionButton label="수정" onPress={startEditing} />
            <ActionButton label="빼기" onPress={remove} />
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
  section: { gap: Spacing.half },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  switchText: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  memo: { minHeight: 100, textAlignVertical: 'top', paddingTop: Spacing.three },
});
