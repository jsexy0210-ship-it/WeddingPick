import type { CurrentUser, WeddingEvent } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getCurrentUser, listWeddingEvents, removeWeddingEvent, updateWeddingEvent } from '@/api/client';
import { formatDateDot, formatMonthDayDot } from '@/features/common/format-date';
import { ErrorView, Layout, Spacing, ThemedText, showAlert } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { DateTimeField, combineDayTime, splitDayTime } from '@/features/wedding/event-form';
import {
  Badge,
  CheckBox,
  Dock,
  DockButton,
  Field,
  Hero,
  ListRow,
  NavBar,
  NoteCard,
  RowValue,
  Screen,
  Section,
  eventTime,
} from '@/features/wedding/screen-kit';

const DAY_MS = 24 * 60 * 60 * 1000;

/** eyebrow — «D-11 · 2027.03.14(금)» · «오늘 · …» · 지난 일정은 «완료 · …». */
function eyebrowOf(event: WeddingEvent, now: number): string {
  const date = formatDateDot(event.startsAt);

  if (event.status === 'done') return `완료 · ${date}`;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(event.startsAt);
  startOfDay.setHours(0, 0, 0, 0);
  const diff = Math.round((startOfDay.getTime() - startOfToday.getTime()) / DAY_MS);

  return `${diff <= 0 ? '오늘' : `D-${diff}`} · ${date}`;
}

/**
 * 일정 상세. WP-OUR-005 · 핸드오프 08-schedule-sub #2.
 *
 *   nav       제목 · 오른쪽 «수정»
 *   hero      eyebrow «D-11 · 2027.03.14(금)» + «14:00 라비드레스»
 *   일정       일시 · 장소 · 관련 업체 — 라벨 18/24 · 값 16/22 tertiary
 *   알림       «하루 전에 알려주기» 체크 + 켬/끔 배지 — 누르면 바로 저장
 *   메모       있으면 한 행
 *   note      배우자가 있으면 «{이름}님에게도 보여요»
 *
 * 시안의 «두 시간 전 알림» · «휴대폰 캘린더에 넣기» · «등록 · 지수 · 2월 28일»은 서버에 그 값이
 * 없어 넣지 않았다 — 없는 데이터를 있는 것처럼 그리지 않는다. 단건 조회 API가 없어 목록을
 * 불러 id로 찾는다.
 */
export default function WeddingEventDetailScreen() {
  const { id, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();

  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [vendorLabel, setVendorLabel] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
    getCurrentUser()
      .then(setMe)
      .catch(() => undefined);
  }, []);

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

  if (error && !event) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (notFound) {
    return <ErrorView title="일정을 찾을 수 없어요" onBack={() => router.back()} />;
  }

  if (!event || now === null) {
    return <DelayedLoadingView />;
  }

  const current = event;
  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? '배우자') : null;

  function startEditing() {
    const split = splitDayTime(current.startsAt);

    setTitle(current.title);
    setDay(split.day);
    setTime(split.time);
    setLocation(current.location ?? '');
    setVendorLabel(current.vendorLabel ?? '');
    setMemo(current.memo ?? '');
    setError(null);
    setEditing(true);
  }

  const startsAt = combineDayTime(day, time);
  const ready = title.trim().length > 0 && startsAt !== null;

  async function save() {
    if (!ready || startsAt === null || saving) return;

    setSaving(true);
    setError(null);

    try {
      await updateWeddingEvent(id, eventId, {
        title: title.trim(),
        startsAt,
        location: location.trim() === '' ? null : location.trim(),
        vendorLabel: vendorLabel.trim() === '' ? null : vendorLabel.trim(),
        memo: memo.trim() === '' ? null : memo.trim(),
      });

      setEditing(false);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '고치지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleNotify() {
    const next = !current.notifyEnabled;

    setEvent({ ...current, notifyEnabled: next });

    try {
      await updateWeddingEvent(id, eventId, { notifyEnabled: next });
      load();
    } catch (caught) {
      setEvent(current);
      setError(caught instanceof Error ? caught.message : '고치지 못했어요.');
    }
  }

  function remove() {
    showAlert('일정을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          removeWeddingEvent(id, eventId)
            .then(() => router.back())
            .catch((caught: Error) => setError(caught.message ?? '삭제하지 못했어요.')),
      },
    ]);
  }

  if (editing) {
    return (
      <Screen>
        <NavBar title="일정 수정" variant="close" onBack={() => setEditing(false)} />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Hero title="무엇을 바꿀까요?" />

          <View style={styles.fields}>
            <Field label="제목" value={title} onChangeText={setTitle} maxLength={60} />
            <DateTimeField day={day} time={time} onChangeDay={setDay} onChangeTime={setTime} allowPast />
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
            <Field
              label="메모"
              value={memo}
              onChangeText={setMemo}
              placeholder="준비물이나 확인할 것"
              multiline
              maxLength={1000}
            />
          </View>

          {error ? (
            <ThemedText type="t7" themeColor="negative" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <Dock>
          <DockButton label="삭제" onPress={remove} />
          <DockButton
            variant="primary"
            label={saving ? '저장 중…' : '저장'}
            disabled={!ready || saving}
            onPress={() => void save()}
          />
        </Dock>
      </Screen>
    );
  }

  const place = current.location ?? current.vendorLabel;

  return (
    <Screen>
      <NavBar title={current.title} right={{ label: '수정', onPress: startEditing }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero
          eyebrow={eyebrowOf(current, now)}
          title={place ? `${eventTime(current.startsAt)} ${place}` : eventTime(current.startsAt)}
        />

        <Section label="일정">
          <ListRow
            title="일시"
            right={<RowValue>{`${formatMonthDayDot(current.startsAt)} ${eventTime(current.startsAt)}`}</RowValue>}
          />
          {current.location ? <ListRow title="장소" right={<RowValue numeric={false}>{current.location}</RowValue>} /> : null}
          {current.vendorLabel ? (
            <ListRow title="관련 업체" right={<RowValue numeric={false}>{current.vendorLabel}</RowValue>} />
          ) : null}
          {current.source === 'auto' ? <ListRow title="등록" right={<RowValue numeric={false}>자동 추가</RowValue>} /> : null}
        </Section>

        <Section label="알림">
          <ListRow
            left={<CheckBox checked={current.notifyEnabled} />}
            title="하루 전에 알려주기"
            right={<Badge label={current.notifyEnabled ? '켬' : '끔'} tone={current.notifyEnabled ? 'ok' : 'none'} />}
            accessibilityLabel={`하루 전에 알려주기 ${current.notifyEnabled ? '켬' : '끔'}`}
            onPress={() => void toggleNotify()}
          />
        </Section>

        {current.memo ? (
          <Section label="메모">
            <ListRow title="메모" sub={current.memo} subLines={4} />
          </Section>
        ) : null}

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        {partner ? (
          <View style={styles.noteWrap}>
            <NoteCard title={`${partner}님에게도 보여요`} body="일정을 바꾸면 둘 다 알림을 받아요." />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.six },
  fields: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Spacing.three },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
});
