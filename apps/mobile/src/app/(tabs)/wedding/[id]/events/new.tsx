import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addWeddingEvent } from '@/api/client';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingCalendar,
  useTheme,
} from '@weddingpick/ui';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * 일정 추가. 핸드오프 WP-OUR-006.
 *
 * "배우자 공유"는 별도 토글을 두지 않는다 — 우리웨딩은 이미 배우자와 함께 보는
 * 공간이라(웨딩 스케줄·방문노트와 같은 이유), 일정만 따로 비공개로 둘 수 있게
 * 하면 실제로 하지 않는 일을 하는 것처럼 보이는 컨트롤이 된다. 대신 안내
 * 문구로 그 사실을 알린다.
 */
export default function AddWeddingEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('14:00');
  const [location, setLocation] = useState('');
  const [vendorLabel, setVendorLabel] = useState('');
  const [memo, setMemo] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ready = title.trim().length > 0 && date !== null && TIME_PATTERN.test(time);

  async function save() {
    if (!ready || date === null) return;

    setSaving(true);
    setError(null);

    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();

      await addWeddingEvent(id, {
        title: title.trim(),
        startsAt,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(vendorLabel.trim() ? { vendorLabel: vendorLabel.trim() } : {}),
        ...(memo.trim() ? { memo: memo.trim() } : {}),
        notifyEnabled,
      });

      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '더하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">일정 더하기</ThemedText>

          <ThemedText type="t7" themeColor="textSecondary">
            제목
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
            value={title}
            onChangeText={setTitle}
            placeholder="예: 상견례"
            placeholderTextColor={theme.textAssistive}
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
            placeholder="14:00"
            placeholderTextColor={theme.textAssistive}
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
            placeholder="예: 더 라움"
            placeholderTextColor={theme.textAssistive}
            accessibilityLabel="장소"
          />

          <ThemedText type="t7" themeColor="textSecondary">
            관련 업체
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
            value={vendorLabel}
            onChangeText={setVendorLabel}
            placeholder="예: 스튜디오 이로"
            placeholderTextColor={theme.textAssistive}
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
            placeholder="준비물이나 확인할 것을 적어주세요"
            placeholderTextColor={theme.textAssistive}
            accessibilityLabel="메모"
          />

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <ThemedText type="t6">알림</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                일정 전에 알려드려요
              </ThemedText>
            </View>
            <Switch
              value={notifyEnabled}
              onValueChange={setNotifyEnabled}
              accessibilityLabel="알림"
              trackColor={{ true: theme.tint, false: theme.track }}
            />
          </View>

          <ThemedText type="t7" themeColor="textAssistive">
            모든 일정은 배우자와 자동으로 공유돼요.
          </ThemedText>

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}

          <ThemedView style={styles.actions}>
            <ActionButton label="취소" onPress={() => router.back()} />
            <ActionButton
              variant="primary"
              label="더하기"
              disabled={!ready || saving}
              onPress={() => void save()}
            />
          </ThemedView>
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
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  memo: { minHeight: 100, textAlignVertical: 'top', paddingTop: Spacing.three },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  switchText: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
