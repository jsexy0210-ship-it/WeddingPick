import type { CurrentUser, PublicHoliday } from '@weddingpick/api-contract';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  addWeddingEvent,
  getCurrentUser,
  listPublicHolidays,
  listWeddingEvents,
  listWeddingTasks,
  updateWeddingEvent,
  updateWeddingTask,
} from '@/api/client';
import { CtaRow } from '@/features/common/cta-row';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { OsDateField, OsTimeField } from '@/features/common/os-picker-field';
import { dayOf } from '@/features/common/os-picker-field.shared';
import { confirmDeleteTimelineItem, type TimelineTarget } from '@/features/wedding/timeline-delete';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { combineDayTime } from '@/features/wedding/event-form';
import { holidayLine, monthRange } from '@/features/wedding/public-calendar-lines';
import { CheckBox, Field, ListRow, ToggleSwitch } from '@/features/wedding/screen-kit';
import { ActionButton, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { ourWedding as copy } from '../../../../../../../../spec/strings.ko.json';
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
 *
 * 수정 모드(2026-09-26 대표 지시 — 웨딩일정 타임라인 줄의 수정 아이콘). 같은 시트를 값이 채워진 채 연다:
 *   `?eventId=`  일정(직접 넣은 일정 · 상담 일정 — 같은 `wedding_events` 행) — 날짜 · 제목 · 시간 · 알림.
 *                저장은 PATCH /events/:id
 *   `?taskId=`   할 일(날짜를 넣은 할 일 · 예식일 기준 임시 날짜 줄) — 날짜 · 제목만. 할 일에는 시간 ·
 *                알림 값이 서버에 없어 그 칸을 그리지 않는다(없는 값을 칸으로 그리지 않는다). 임시 날짜
 *                줄은 `?date=`(보이던 임시 날짜)로 채우고, 저장하면 그 날짜가 진짜 날짜가 된다(PATCH /tasks/:id)
 * 제목 «일정 수정», 아래는 «삭제 · 변경 내용 저장» 두 단추(지출 수정 시트와 같은 `CtaRow` 1 : 1.4). 삭제는
 * OS 확인창(`confirmDeleteTimelineItem`). 정본 note.jsx에 수정 프레임은 없다 — `DESIGN_UNRESOLVED`
 * (등록 시트 WP-NOTE-002를 그대로 쓴다). 지난 일정도 고칠 수 있어 수정 모드는 날짜 하한을 두지 않는다.
 */
export default function AddWeddingEventRoute() {
  const { id, date, eventId, taskId } = useLocalSearchParams<{
    id: string;
    date?: string;
    eventId?: string;
    taskId?: string;
  }>();
  const target: TimelineTarget | null = eventId
    ? { kind: 'event', id: eventId, title: '' }
    : taskId
      ? { kind: 'task', id: taskId, title: '' }
      : null;
  const editing = target !== null;
  const isTask = target?.kind === 'task';
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
  /* 수정 모드에서 처음 채운 값 — 바뀐 것이 있을 때만 저장 단추가 켜진다. 못 읽었으면 null. */
  const [initial, setInitial] = useState<{ title: string; day: string | null; time: string; notify: boolean } | null>(
    null
  );

  useEffect(() => {
    if (!eventId && !taskId) return;
    let active = true;
    const fill = (next: { title: string; day: string | null; time: string; notify: boolean }) => {
      if (!active) return;
      setInitial(next);
      setTitle(next.title);
      setDay(next.day);
      setTime(next.time);
      setNotifyEnabled(next.notify);
    };
    const missing = () => {
      if (active) setError('일정을 찾지 못했어요. 목록에서 다시 골라주세요.');
    };
    if (eventId) {
      listWeddingEvents(id)
        .then(({ events }) => {
          const row = events.find((event) => event.id === eventId);
          if (!row) return missing();
          const at = new Date(row.startsAt);
          const pad = (value: number) => String(value).padStart(2, '0');
          fill({
            title: row.title,
            day: dayOf(at),
            time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
            notify: row.notifyEnabled,
          });
        })
        .catch((caught: Error) => { if (active) setError(caught.message); });
    } else if (taskId) {
      listWeddingTasks(id)
        .then(({ tasks }) => {
          const row = tasks.find((task) => task.id === taskId);
          if (!row) return missing();
          fill({ title: row.label, day: row.dueDate ?? date ?? null, time: DEFAULT_TIME, notify: true });
        })
        .catch((caught: Error) => { if (active) setError(caught.message); });
    }
    return () => { active = false; };
  }, [id, eventId, taskId, date]);

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
    title.trim().length === 0
      ? '제목을 적어주세요'
      : isTask
        ? day === null
          ? '날짜를 골라주세요'
          : null
        : startsAt === null
          ? '날짜와 시간을 골라주세요'
          : null;
  const dirty = editing
    ? initial !== null &&
      (title !== initial.title || day !== initial.day || (!isTask && (time !== initial.time || notifyEnabled !== initial.notify)))
    : title.length > 0 || day !== (date ?? null) || time !== DEFAULT_TIME || notifyEnabled !== true;
  /*
   * 임시 날짜 줄은 날짜가 서버에 없다 — 보이던 날짜 그대로 저장해도 «진짜 날짜로 정하기»라 바뀐 것으로 본다.
   */
  const tentativeTask = isTask && initial !== null && date !== undefined && initial.day === date;
  const ready = reason === null && (!editing || dirty || tentativeTask);

  function closeSheet() {
    dismissToOrReplace('/wedding?tab=calendar');
  }

  function requestClose() {
    if (saving) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function save() {
    if (!ready || saving) return;
    if (!isTask && startsAt === null) return;

    setSaving(true);
    setError(null);

    try {
      if (eventId) {
        await updateWeddingEvent(id, eventId, { title: title.trim(), startsAt: startsAt!, notifyEnabled });
        showResultToast(copy['event.saved']);
      } else if (taskId) {
        await updateWeddingTask(id, taskId, { label: title.trim(), dueDate: day });
        showResultToast(copy['event.saved']);
      } else {
        await addWeddingEvent(id, { title: title.trim(), startsAt: startsAt!, notifyEnabled });
        showResultToast('일정을 추가했어요');
      }
      closeSheet();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '넣지 못했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  function requestDelete() {
    if (!target || saving || initial === null) return;
    confirmDeleteTimelineItem({
      weddingId: id,
      target: { ...target, title: initial.title },
      onStart: () => {
        setSaving(true);
        setError(null);
      },
      onDeleted: () => {
        showResultToast(copy['event.deleted']);
        closeSheet();
      },
      onError: setError,
      onSettled: () => setSaving(false),
    });
  }

  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? '배우자') : null;

  return (
    <View style={styles.host}>
      <WeddingScreen initialTab="calendar" />

      <BottomSheet visible onRequestClose={requestClose} style={styles.sheetHost} testID="event-add-sheet">
        <SheetPanel>
          <SheetHeader title={editing ? copy['event.editTitle'] : '일정 추가'} onClose={requestClose} closeDisabled={saving} />

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
                min={editing ? undefined : dayOf(new Date())}
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
                maxLength={isTask ? 40 : 60}
                returnKeyType="next"
              />
              {isTask ? null : (
                <OsTimeField label="시간" value={time} placeholder={DEFAULT_TIME} onChange={setTime} />
              )}
            </View>

            {isTask ? null : <View style={[styles.divider, { backgroundColor: theme.border }]} />}

            {isTask ? null : (
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
            )}

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
          {editing ? (
            <CtaRow gap={Spacing.two}>
              <ActionButton
                label={copy['expense.delete']}
                disabled={saving || initial === null}
                onPress={requestDelete}
              />
              <ActionButton
                variant="primary"
                label={saving ? '저장하는 중…' : copy['expense.save']}
                disabled={!ready || saving}
                onPress={() => void save()}
              />
            </CtaRow>
          ) : (
            <ActionButton
              variant="primary"
              size="xlarge"
              label={saving ? '넣는 중…' : '일정 넣기'}
              disabled={!ready || saving}
              onPress={() => void save()}
            />
          )}
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
