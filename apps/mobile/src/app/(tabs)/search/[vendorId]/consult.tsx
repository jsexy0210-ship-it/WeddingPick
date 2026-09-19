import type { VendorDetail } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { addWeddingEvent, getVendor } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { CategoryImage } from '@/features/home/category-image';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import {
  Border,
  FontSize,
  Layout,
  LineHeight,
  ProductSymbol,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';

import VendorDetailScreen from './index';

const TITLE = '상담 예약';
const HEADLINE = '우리에게 편한 시간으로\n상담을 예약해요.';
const TIMES = ['오전 10:00', '오전 11:30', '오후 1:00', '오후 2:00', '오후 3:30', '오후 5:00'] as const;
const NOTE_PLACEHOLDER = '원하는 스타일, 특별한 요청이 있으면 남겨주세요.';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const DAY_COUNT = 7;

type DayOption = { date: Date; weekday: string; day: number };

function upcomingDays(from: Date): DayOption[] {
  return Array.from({ length: DAY_COUNT }, (_, offset) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset + 1);
    return { date, weekday: WEEKDAYS[date.getDay()], day: date.getDate() };
  });
}

function parseTime(label: string): { hour: number; minute: number } {
  const [meridiem, clock] = label.split(' ');
  const [rawHour, rawMinute] = clock.split(':').map(Number);
  const hour = meridiem === '오후' && rawHour !== 12 ? rawHour + 12 : rawHour;
  return { hour, minute: rawMinute };
}

/**
 * 상담/예약은 별도 전체 화면이 아니라 업체 상세 위 DLG-D BottomSheet다.
 * /booking은 이 route를 그대로 re-export하므로 같은 규칙을 공유한다.
 */
export default function ConsultRoute() {
  const theme = useTheme();
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const candidates = useMyCandidates();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [days] = useState(() => upcomingDays(new Date()));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<(typeof TIMES)[number] | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    getVendor(vendorId)
      .then(setVendor)
      .catch(() => setToast('업체 정보를 불러오지 못했어요.'));
  }, [vendorId]);

  const canConfirm = selectedDay !== null && selectedTime !== null && !sending;
  const monthLabel = `${days[0].date.getFullYear()}년 ${days[0].date.getMonth() + 1}월`;
  const chosen = days.find((option) => option.day === selectedDay) ?? null;
  const dirty = selectedDay !== null || selectedTime !== null || note.length > 0;

  function closeSheet() {
    router.replace(`/search/${vendorId}` as never);
  }

  function requestClose() {
    if (sending) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function confirm() {
    if (!vendor || !chosen || !selectedTime || sending) return;

    if (!candidates.weddingId) {
      router.push('/login');
      return;
    }

    const { hour, minute } = parseTime(selectedTime);
    const startsAt = new Date(
      chosen.date.getFullYear(),
      chosen.date.getMonth(),
      chosen.day,
      hour,
      minute
    );

    setSending(true);
    try {
      await addWeddingEvent(candidates.weddingId, {
        title: `${vendor.name} 상담`,
        startsAt: startsAt.toISOString(),
        location: vendor.region,
        vendorId: vendor.id,
        vendorLabel: vendor.name,
        memo: note.trim() || undefined,
        notifyEnabled: true,
      });
      router.replace('/wedding');
    } catch {
      setToast('상담 일정을 등록하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  }

  const names = [candidates.me?.displayName ?? '우리', candidates.partnerName]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.host}>
      <VendorDetailScreen />

      <BottomSheet visible onRequestClose={requestClose} testID="consult-booking-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <ThemedText type="t4">{TITLE}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              업체 상세를 보면서 상담 날짜와 시간을 골라요.
            </ThemedText>
          </View>

          {vendor === null ? (
            <View style={styles.loading}>
              <DelayedLoader size={40} />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <ThemedText type="f30" style={styles.headline}>
                {HEADLINE}
              </ThemedText>

              <View style={[styles.vendorCard, { borderColor: theme.border }]}>
                <ThemedView type="backgroundElement" style={styles.vendorImage}>
                  <CategoryImage uri={vendor.imageUrl} />
                </ThemedView>
                <View style={styles.vendorText}>
                  <ThemedText type="f10" themeColor="textAssistive">
                    {VENDOR_CATEGORY_LABEL[vendor.category]}
                  </ThemedText>
                  <ThemedText type="f14" numberOfLines={1} style={styles.bold}>
                    {vendor.name}
                  </ThemedText>
                  <ThemedText type="f10" themeColor="textAssistive" numberOfLines={1}>
                    {vendor.region}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <View style={styles.sectionTitle}>
                    <ProductSymbol
                      name="calendar"
                      size={Layout.iconField}
                      color={theme.text}
                    />
                    <ThemedText type="f14" style={styles.bold}>
                      날짜 선택
                    </ThemedText>
                  </View>
                  <ThemedText type="f10" numeric themeColor="textAssistive">
                    {monthLabel}
                  </ThemedText>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dayRow}>
                  {days.map((option) => {
                    const selected = selectedDay === option.day;

                    return (
                      <Pressable
                        key={option.date.toISOString()}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${option.day}일 ${option.weekday}요일`}
                        onPress={() => setSelectedDay(option.day)}
                        style={[
                          styles.dayCell,
                          selected
                            ? { backgroundColor: theme.text, borderColor: theme.text }
                            : { backgroundColor: theme.background, borderColor: theme.border },
                        ]}>
                        <ThemedText
                          type="f10"
                          style={{
                            color: selected ? theme.onTint : theme.textAssistive,
                            opacity: selected ? 0.6 : 1,
                          }}>
                          {option.weekday}
                        </ThemedText>
                        <ThemedText
                          type="f16"
                          numeric
                          style={[styles.bold, { color: selected ? theme.onTint : theme.text }]}>
                          {option.day}일
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={[styles.section, styles.sectionDivided, { borderTopColor: theme.border }]}>
                <View style={[styles.sectionTitle, styles.sectionHead]}>
                  <ProductSymbol name="clock" size={Layout.iconField} color={theme.text} />
                  <ThemedText type="f14" style={styles.bold}>
                    시간 선택
                  </ThemedText>
                </View>
                <View style={styles.timeGrid}>
                  {TIMES.map((time) => {
                    const selected = selectedTime === time;

                    return (
                      <Pressable
                        key={time}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedTime(time)}
                        style={[
                          styles.timeCell,
                          selected
                            ? { backgroundColor: theme.text, borderColor: theme.text }
                            : { backgroundColor: theme.background, borderColor: theme.border },
                        ]}>
                        <ThemedText
                          type="f14"
                          numeric
                          style={[styles.bold, { color: selected ? theme.onTint : theme.text }]}>
                          {time}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.section, styles.sectionDivided, { borderTopColor: theme.border }]}>
                <ThemedText type="f14" style={[styles.bold, styles.sectionHead]}>
                  남기고 싶은 말{' '}
                  <ThemedText type="f14" themeColor="textAssistive">
                    (선택)
                  </ThemedText>
                </ThemedText>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  textAlignVertical="top"
                  placeholder={NOTE_PLACEHOLDER}
                  placeholderTextColor={theme.textAssistive}
                  accessibilityLabel="남기고 싶은 말"
                  style={[styles.note, { borderColor: theme.border, color: theme.text }]}
                />
              </View>

              <ThemedView type="backgroundElement" style={styles.sync}>
                <View style={styles.sectionTitle}>
                  <ProductSymbol
                    name="twoPeople"
                    size={Layout.iconField}
                    color={theme.text}
                  />
                  <ThemedText type="f14" style={styles.bold}>
                    커플 캘린더에 자동으로 공유돼요
                  </ThemedText>
                </View>
                <ThemedText type="f12" themeColor="textAssistive" style={styles.syncBody}>
                  {names} 두 분의 웨딩노트 캘린더에 상담 일정이 공유됩니다.
                </ThemedText>
              </ThemedView>
            </ScrollView>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canConfirm }}
            disabled={!canConfirm}
            onPress={() => void confirm()}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: canConfirm ? theme.tint : theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            {canConfirm && chosen ? (
              <>
                <SeedIcon name="checkFlowerFill" size={Layout.iconField} color={theme.onTint} />
                <ThemedText type="f14" themeColor="onTint" style={styles.bold}>
                  {chosen.date.getMonth() + 1}월 {chosen.day}일 · {selectedTime} 예약하기
                </ThemedText>
              </>
            ) : (
              <ThemedText type="f14" themeColor="textAssistive" style={styles.bold}>
                {sending ? '등록하는 중…' : '날짜와 시간을 선택해주세요'}
              </ThemedText>
            )}
          </Pressable>
        </SheetPanel>
      </BottomSheet>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHead: { gap: Spacing.one },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two },
  headline: { fontWeight: 700 },
  vendorCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    marginTop: Layout.sectionGap,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
  },
  vendorImage: {
    width: Layout.emptyMark,
    height: Layout.emptyMark,
    borderRadius: Radius.thumb,
    overflow: 'hidden',
  },
  vendorText: { flex: 1, minWidth: 0, gap: Spacing.one },
  section: { marginTop: Spacing.five },
  sectionDivided: { paddingTop: Spacing.four, borderTopWidth: Border.hairline },
  sectionHead: { marginBottom: Layout.sectionHeadGapCompact },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.sectionHeadGapCompact,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayRow: { flexDirection: 'row', gap: Spacing.two, paddingBottom: Spacing.one },
  dayCell: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Layout.inlineGap,
    paddingHorizontal: Layout.cardPadding,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
  },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  timeCell: {
    flexGrow: 1,
    flexBasis: '30%',
    height: Layout.controlLarge,
    borderRadius: Radius.hero,
    borderWidth: Border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    height: Layout.textarea + Spacing.two,
    paddingVertical: Layout.fieldPaddingX,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    fontSize: FontSize.f14,
    lineHeight: LineHeight.lh20,
  },
  sync: { marginTop: Layout.listGap, padding: Spacing.three, borderRadius: Radius.cardLarge },
  syncBody: { marginTop: Spacing.two, lineHeight: LineHeight.lh20 },
  cta: {
    height: Layout.ctaSheet,
    borderRadius: Radius.cardLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
});
