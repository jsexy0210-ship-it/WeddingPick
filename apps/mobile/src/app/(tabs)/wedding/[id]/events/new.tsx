import type { CurrentUser } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { addWeddingEvent, getCurrentUser } from '@/api/client';
import { Layout, Spacing, ThemedText } from '@weddingpick/ui';
import { DateTimeField, combineDayTime } from '@/features/wedding/event-form';
import {
  Badge,
  CheckBox,
  Dock,
  DockButton,
  Field,
  Hero,
  ListRow,
  NavBar,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/**
 * 일정 추가. WP-OUR-006 · 핸드오프 08-schedule-sub #3.
 *
 *   close nav «일정 추가»
 *   hero      «어떤 일정을 넣을까요?»
 *   필드 4     제목 · 일시 · 장소 · 관련 업체 (필수: 제목 · 일시)
 *   알림       «하루 전에 알려주기» 체크 · 배우자가 있으면 «{이름}님에게도 알려주기»
 *   dock      «일정 넣기» 52 coral
 *
 * 배우자 공유는 켜고 끄는 것이 아니다 — 일정은 한 명이 넣으면 둘 다 알림을 받는다
 * (SPEC 4.1). 그래서 그 줄은 늘 켜져 있고 누를 수 없다. 끌 수 있는 것처럼 보이는 컨트롤을
 * 두지 않는다.
 */
export default function AddWeddingEventScreen() {
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

      /* 링크로 곧장 들어와 되돌아갈 곳이 없으면 목록으로. */
      if (router.canGoBack()) router.back();
      else router.replace(`/wedding/${id}/events` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '넣지 못했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? '배우자') : null;

  return (
    <Screen>
      <NavBar title="일정 추가" variant="close" fallback={`/wedding/${id}/events`} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Hero title="어떤 일정을 넣을까요?" />

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

        <Section label="알림">
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
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <Dock note={!ready && (title.length > 0 || day !== null) ? reason : null}>
        <DockButton
          variant="primary"
          label={saving ? '넣는 중…' : '일정 넣기'}
          disabled={!ready || saving}
          onPress={() => void save()}
        />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  fields: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Spacing.three },
  error: { paddingHorizontal: Layout.gutter },
});
