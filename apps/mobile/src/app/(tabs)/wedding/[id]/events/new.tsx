import type { CurrentUser } from '@weddingpick/api-contract';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';

import { addWeddingEvent, getCurrentUser } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { formatDateDot } from '@/features/common/format-date';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { combineDayTime, TIME_PATTERN } from '@/features/wedding/event-form';
import { CheckBox, Field, FieldButton, ListRow } from '@/features/wedding/screen-kit';
import { ActionButton, ProductSymbol, Radius, Spacing, ThemedText, WeddingCalendar, useTheme } from '@weddingpick/ui';

import WeddingScreen from '../../index';

const DEFAULT_TIME = '14:00';

/**
 * 일정 추가 시트 — WP-NOTE-002 · `docs/design/React_Native/note.jsx` frame-002.
 *
 *   formHead   타이틀 「일정 추가」 + 우측 36px 회색 원형 X 닫기(서브 문구 없음)
 *   fieldWrap  날짜(FieldButton, coral 강조 + 캘린더 아이콘) → 제목 → 시간
 *   알림       정본은 토글 3개(하루 전 · 두 시간 전 · 배우자)이지만 서버는 `notifyEnabled`
 *              하나뿐이다 — 없는 값을 토글로 그리지 않는다([eventId].tsx의 같은 결정과
 *              동일). 「하루 전에 알려주기」만 실제 스위치로 두고, 배우자 몫은 연결된
 *              배우자가 있을 때만 안내 행(비활성 체크)으로 보여준다.
 *   CTA        Primary 1개 「일정 넣기」(sheetDock `btnPrimaryFull`) — 취소는 X 하나뿐이다.
 *
 * /events/new 딥링크는 유지하되 별도 전체 화면은 만들지 않는다. 부모 일정 화면을 그대로
 * 남기고 시트만 올린다.
 */
export default function AddWeddingEventRoute() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { height } = useWindowDimensions();
  const theme = useTheme();

  const [me, setMe] = useState<CurrentUser | null>(null);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<string | null>(date ?? null);
  const [dateOpen, setDateOpen] = useState(date === undefined);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(setMe)
      .catch(() => undefined);
  }, []);

  const startsAt = combineDayTime(day, time);
  const timeValid = TIME_PATTERN.test(time);
  const reason =
    title.trim().length === 0 ? '제목을 적어주세요' : startsAt === null ? '날짜와 시간을 골라주세요' : null;
  const ready = reason === null;
  const dirty = title.length > 0 || day !== (date ?? null) || time !== DEFAULT_TIME || notifyEnabled !== true;

  function closeSheet() {
    dismissToOrReplace('/wedding?tab=calendar');
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
      await addWeddingEvent(id, { title: title.trim(), startsAt, notifyEnabled });
      showResultToast('일정을 추가했어요');
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
      <WeddingScreen initialTab="calendar" />

      <BottomSheet visible onRequestClose={requestClose} style={styles.sheetHost} testID="event-add-sheet">
        <SheetPanel>
          <View style={styles.formHead}>
            <ThemedText type="t4">일정 추가</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={requestClose}
              hitSlop={4}
              style={({ pressed }) => [
                styles.formClose,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ProductSymbol name="close" size={16} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={[styles.scroll, { maxHeight: Math.max(280, height * 0.62) }]}
            nestedScrollEnabled
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.fields}>
              <FieldButton
                label="날짜"
                value={day ? formatDateDot(day) : null}
                placeholder="날짜를 골라주세요"
                open={dateOpen}
                accent
                icon={<ProductSymbol name="calendar" size={20} color={theme.tint} />}
                onPress={() => setDateOpen((current) => !current)}
              />
              {dateOpen ? (
                <WeddingCalendar
                  value={day}
                  onChange={(next) => {
                    setDay(next);
                    setDateOpen(false);
                  }}
                />
              ) : null}
              <Field
                label="제목"
                value={title}
                onChangeText={setTitle}
                placeholder="예: 드레스 투어 2차"
                maxLength={60}
                returnKeyType="next"
              />
              <Field
                label="시간"
                value={time}
                onChangeText={setTime}
                placeholder={DEFAULT_TIME}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                hint={timeValid ? null : '14:00 형태로 적어주세요'}
                hintColor={timeValid ? 'textAssistive' : 'negative'}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.alarms}>
              <ListRow
                title="하루 전에 알려주기"
                right={
                  <Switch
                    value={notifyEnabled}
                    onValueChange={setNotifyEnabled}
                    trackColor={{ true: theme.tint, false: theme.track }}
                    thumbColor={theme.onTint}
                    ios_backgroundColor={theme.track}
                    accessibilityLabel={`하루 전에 알려주기 ${notifyEnabled ? '켬' : '끔'}`}
                  />
                }
                divider={false}
              />
              {partner ? (
                <ListRow left={<CheckBox checked />} title={`${partner}님에게도 알려줘요`} divider={false} />
              ) : null}
            </View>

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
          <ActionButton
            variant="primary"
            size="xlarge"
            label={saving ? '넣는 중…' : '일정 넣기'}
            disabled={!ready || saving}
            onPress={() => void save()}
          />
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHost: { flexShrink: 1 },
  formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  formClose: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: Spacing.three },
  fields: { gap: Spacing.three },
  divider: { height: 1 },
  alarms: { gap: Spacing.half },
  pressed: { opacity: 0.8 },
});
