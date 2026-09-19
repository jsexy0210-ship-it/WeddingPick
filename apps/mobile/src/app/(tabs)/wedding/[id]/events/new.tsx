import type { CurrentUser } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { addWeddingEvent, getCurrentUser } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { DateTimeField, combineDayTime } from '@/features/wedding/event-form';
import {
  Badge,
  CheckBox,
  Field,
  ListRow,
  Section,
} from '@/features/wedding/screen-kit';
import { ActionButton, Spacing, ThemedText } from '@weddingpick/ui';

import EventsScreen from './index';

/**
 * /events/new 딥링크는 유지하되 별도 전체 화면은 만들지 않는다.
 * 부모 일정 화면을 그대로 남기고 DLG-D BottomSheet만 올린다.
 */
export default function AddWeddingEventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [me, setMe] = useState<CurrentUser | null>(null);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState('14:00');
  const [location, setLocation] = useState('');
  const [vendorLabel, setVendorLabel] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(setMe)
      .catch(() => undefined);
  }, []);

  const startsAt = combineDayTime(day, time);
  const reason =
    title.trim().length === 0 ? '제목을 적어주세요' : startsAt === null ? '일시를 골라주세요' : null;
  const ready = reason === null;
  const dirty =
    title.length > 0 ||
    day !== null ||
    location.length > 0 ||
    vendorLabel.length > 0 ||
    notifyEnabled !== true;

  function closeSheet() {
    router.replace(`/wedding/${id}/events` as never);
  }

  function requestClose() {
    if (saving) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function save() {
    if (!ready || startsAt === null || saving) return;

    setSaving(true);
    setError(null);

    try {
      await addWeddingEvent(id, {
        title: title.trim(),
        startsAt,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(vendorLabel.trim() ? { vendorLabel: vendorLabel.trim() } : {}),
        notifyEnabled,
      });
      closeSheet();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '넣지 못했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? '배우자') : null;

  return (
    <View style={styles.host}>
      <EventsScreen />

      <BottomSheet visible onRequestClose={requestClose} testID="event-add-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <ThemedText type="t4">일정 추가</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              보던 일정 화면을 남겨둔 채 필요한 내용만 입력해요.
            </ThemedText>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ThemedText type="t2">어떤 일정을 넣을까요?</ThemedText>

            <View style={styles.fields}>
              <Field
                label="제목"
                value={title}
                onChangeText={setTitle}
                placeholder="예: 드레스 투어 2차"
                maxLength={60}
                returnKeyType="next"
              />
              <DateTimeField day={day} time={time} onChangeDay={setDay} onChangeTime={setTime} />
              <Field
                label="장소"
                value={location}
                onChangeText={setLocation}
                placeholder="어디에서 만나요?"
                maxLength={120}
              />
              <Field
                label="관련 업체"
                value={vendorLabel}
                onChangeText={setVendorLabel}
                placeholder="업체 이름"
                maxLength={60}
              />
            </View>

            <Section label="알림" style={styles.sheetSection}>
              <ListRow
                left={<CheckBox checked={notifyEnabled} />}
                title="하루 전에 알려주기"
                accessibilityLabel={`하루 전에 알려주기 ${notifyEnabled ? '켬' : '끔'}`}
                onPress={() => setNotifyEnabled((current) => !current)}
              />
              {partner ? (
                <ListRow
                  left={<CheckBox checked />}
                  title={`${partner}님에게도 알려주기`}
                  right={<Badge label="함께" tone="ok" />}
                />
              ) : null}
            </Section>

            {error ? (
              <ThemedText type="t7" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}
          </ScrollView>

          {!ready && dirty && reason ? (
            <ThemedText type="t7" themeColor="textSecondary">
              {reason}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            <ActionButton label="취소" disabled={saving} onPress={requestClose} />
            <ActionButton
              variant="primary"
              label={saving ? '넣는 중…' : '일정 넣기'}
              disabled={!ready || saving}
              onPress={() => void save()}
            />
          </View>
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
  fields: { gap: Spacing.three },
  actions: { flexDirection: 'row', gap: Spacing.two },
  sheetSection: { paddingHorizontal: 0 },
  spacer: { paddingHorizontal: Layout.gutter },
});
