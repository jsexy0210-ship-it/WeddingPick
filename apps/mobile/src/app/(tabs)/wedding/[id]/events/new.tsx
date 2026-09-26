import type { CurrentUser, PublicHoliday } from '@weddingpick/api-contract';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { addWeddingEvent, getCurrentUser, listPublicHolidays } from '@/api/client';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { OsDateField, OsTimeField } from '@/features/common/os-picker-field';
import { dayOf } from '@/features/common/os-picker-field.shared';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { combineDayTime } from '@/features/wedding/event-form';
import { holidayLine, monthRange } from '@/features/wedding/public-calendar-lines';
import { CheckBox, Field, ListRow, ToggleSwitch } from '@/features/wedding/screen-kit';
import { ActionButton, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import WeddingScreen from '../../index';

const DEFAULT_TIME = '14:00';

/**
 * 일정 추가 시트 — WP-NOTE-002 · `docs/design/React_Native/note.jsx` frame-002.
 *
 *   formHead   공용 SheetHeader — 타이틀 「일정 추가」 + 우측 36px 회색 원형 X 닫기
 *   fieldWrap  날짜(OsDateField, coral 강조 + 캘린더 아이콘) → 제목 → 시간(OsTimeField)
 *              날짜 · 시간은 OS 선택기로 고른다(2026-09-25 대표 지시 「OS 데이트피커 ·
 *              타임피커」) — 앱이 그리던 달력과 「14:00」 직접 입력 칸을 대신한다.
 *   알림       정본은 토글 3개(하루 전 · 두 시간 전 · 배우자)이지만 서버는 `notifyEnabled`
 *              하나뿐이다 — 없는 값을 토글로 그리지 않는다([eventId].tsx의 같은 결정과
 *              동일). 「하루 전에 알려주기」만 실제 스위치로 두고, 배우자 몫은 연결된
 *              배우자가 있을 때만 안내 행(비활성 체크)으로 보여준다.
 *   공휴일     날짜 칸 바로 아래 한 줄(f13 · textSecondary) — 고른 날짜가 든 달의 공휴일만
 *              이어 쓴다(2026-09-24 대표 A안 「달력 아래 보고 있는 달 공휴일 한 줄」). 날짜 선택이
 *              휠 시트로 바뀌어 «달력 아래» 자리가 없어져 날짜 칸 아래로 옮겼다 — 자리는
 *              DESIGN_UNRESOLVED(대표님 확인 대기). 날짜가 없거나 못 받으면 줄을 그리지 않는다.
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
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(setMe)
      .catch(() => undefined);
  }, []);

  /* 고른 날짜가 든 달 — 「YYYY-MM」. 달이 바뀔 때만 다시 묻는다. */
  const dayMonth = day?.slice(0, 7) ?? null;
  const shownMonth = dayMonth ? { year: Number(dayMonth.slice(0, 4)), month: Number(dayMonth.slice(5, 7)) - 1 } : null;

  useEffect(() => {
    if (!dayMonth) return;
    let active = true;
    const { from, to } = monthRange(Number(dayMonth.slice(0, 4)), Number(dayMonth.slice(5, 7)) - 1);
    void listPublicHolidays(from, to)
      .then((r) => { if (active) setHolidays(r.holidays); })
      .catch(() => { if (active) setHolidays([]); });
    return () => { active = false; };
  }, [dayMonth]);

  const holidayText = shownMonth ? holidayLine(holidays, shownMonth.year, shownMonth.month) : null;

  const startsAt = combineDayTime(day, time);
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
          <SheetHeader title="일정 추가" onClose={requestClose} />

          <ScrollView
            style={[styles.scroll, { maxHeight: Math.max(280, height * 0.62) }]}
            nestedScrollEnabled
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.fields}>
              <OsDateField
                label="날짜"
                value={day}
                placeholder="날짜를 골라주세요"
                min={dayOf(new Date())}
                accent
                onChange={setDay}
              />
              {holidayText ? (
                <ThemedText type="f13" themeColor="textSecondary" numeric>
                  {holidayText}
                </ThemedText>
              ) : null}
              <Field
                label="제목"
                value={title}
                onChangeText={setTitle}
                placeholder="예: 드레스 투어 2차"
                maxLength={60}
                returnKeyType="next"
              />
              <OsTimeField label="시간" value={time} placeholder={DEFAULT_TIME} onChange={setTime} />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.alarms}>
              <ListRow
                title="하루 전에 알려주기"
                right={
                  <ToggleSwitch
                    value={notifyEnabled}
                    onValueChange={setNotifyEnabled}
                    accessibilityLabel="하루 전에 알려주기"
                  />
                }
                divider={false}
              />
              {partner ? (
                <ListRow left={<CheckBox checked />} title={`${partner}님에게도 알려주기`} divider={false} />
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
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: 12 },
  /* note.js `sheetForm` — 칸 사이 `gap:12px`. */
  fields: { gap: 12 },
  /* note.js `divider` — `margin:20px 0`이 시트 `gap:12px` 위에 더해진다. */
  divider: { height: 1, marginVertical: 20 },
  alarms: { gap: Spacing.half },
});
