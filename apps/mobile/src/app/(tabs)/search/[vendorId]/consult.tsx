import type { VendorDetail } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, addWeddingEvent, getCurrentUser, getVendor, listCandidates } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
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
type DecisionState = 'loading' | 'allowed' | 'blocked' | 'error';

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
  const submitLock = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<DecisionState>('loading');

  useEffect(() => {
    if (!vendorId) return;
    getVendor(vendorId)
      .then(setVendor)
      .catch(() => setToast('업체 정보를 불러오지 못했어요.'));
  }, [vendorId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      // 의존값 변경 직후의 loading 전환도 effect 본문과 같은 tick에서 강제하지 않는다.
      await Promise.resolve();
      if (!active) return;
      setDecisionState('loading');

      if (!vendorId) {
        if (active) setDecisionState('blocked');
        return;
      }
      const me = await getCurrentUser();
      if (!me.weddingId) {
        if (active) setDecisionState('blocked');
        return;
      }
      const page = await listCandidates(me.weddingId, { force: true });
      const allowed = page.groups.some((group) => group.decidedVendorId === vendorId);
      if (active) setDecisionState(allowed ? 'allowed' : 'blocked');
    })().catch(() => {
      if (active) setDecisionState('error');
    });

    return () => {
      active = false;
    };
  }, [vendorId]);

  const canConfirm = selectedDay !== null && selectedTime !== null && !sending;
  const monthLabel = `${days[0].date.getFullYear()}년 ${days[0].date.getMonth() + 1}월`;
  const chosen = days.find((option) => option.day === selectedDay) ?? null;
  const dirty = selectedDay !== null || selectedTime !== null || note.length > 0;

  function closeSheet() {
    dismissToOrReplace(`/search/${vendorId}`);
  }

  function requestClose() {
    if (sending) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function confirm() {
    if (!vendor || !chosen || !selectedTime || sending || submitLock.current) return;

    // 재검증이 끝나기 전 연속 탭도 막는다. state 반영 한 프레임을 기다리면 중복 INSERT가 가능하다.
    submitLock.current = true;
    setSending(true);
    let decisionVerified = false;

    try {
      const me = await getCurrentUser();
      if (!me.weddingId) {
        router.replace('/login');
        return;
      }

      // 배우자가 방금 결정을 바꿨을 수 있으므로 공용 30초 GET 캐시를 우회한다.
      const latestCandidates = await listCandidates(me.weddingId, { force: true });
      const stillDecided = latestCandidates.groups.some((group) => group.decidedVendorId === vendor.id);
      if (!stillDecided) {
        setDecisionState('blocked');
        setToast('최종 Pick을 완료한 업체만 상담 예약을 이어갈 수 있어요.');
        return;
      }
      decisionVerified = true;

      const { hour, minute } = parseTime(selectedTime);
      const startsAt = new Date(
        chosen.date.getFullYear(),
        chosen.date.getMonth(),
        chosen.day,
        hour,
        minute
      );

      await addWeddingEvent(me.weddingId, {
        title: `${vendor.name} 상담`,
        startsAt: startsAt.toISOString(),
        location: vendor.region,
        vendorId: vendor.id,
        vendorLabel: vendor.name,
        memo: note.trim() || undefined,
        notifyEnabled: true,
      });
      router.replace('/wedding');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }
      if (caught instanceof ApiError && caught.status === 403) {
        setDecisionState('blocked');
        setToast('최종 Pick 상태가 바뀌었어요. 나의 Pick에서 다시 확인해주세요.');
        return;
      }
      setToast(
        decisionVerified
          ? '상담 일정을 등록하지 못했어요. 잠시 후 다시 시도해주세요.'
          : '최종 Pick 상태를 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.'
      );
    } finally {
      submitLock.current = false;
      setSending(false);
    }
  }

  const names = [candidates.me?.displayName ?? '우리', candidates.partnerName]
    .filter(Boolean)
    .join(' · ');
  const decisionMessage =
    decisionState === 'error'
      ? '최종 Pick 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.'
      : '최종 Pick을 완료한 뒤 상담 예약을 이어갈 수 있어요.';

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

          {vendor === null || decisionState === 'loading' ? (
            <View style={styles.loading}>
              <DelayedLoader size={40} />
            </View>
          ) : decisionState !== 'allowed' ? (
            <View style={styles.guard}>
              <ThemedText type="f16" style={styles.bold}>최종 Pick 확인이 필요해요</ThemedText>
              <ThemedText type="f13" themeColor="textAssistive" style={styles.guardText}>
                {decisionMessage}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="나의 Pick 보기"
                onPress={() => router.replace('/pick')}
                style={({ pressed }) => [
                  styles.guardButton,
                  { backgroundColor: theme.text },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="f14" style={[styles.bold, { color: theme.onInk }]}>나의 Pick 보기</ThemedText>
              </Pressable>
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

          {decisionState === 'allowed' ? (
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
                    {chosen.date.getMonth() + 1}월 {chosen.day}일 · {selectedTime} 일정 등록하기
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="f14" themeColor="textAssistive" style={styles.bold}>
                  {sending ? '등록하는 중…' : '날짜와 시간을 선택해주세요'}
                </ThemedText>
              )}
            </Pressable>
          ) : null}
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
  guard: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  guardText: { textAlign: 'center' },
  guardButton: {
    minHeight: Layout.ctaInCard,
    marginTop: Spacing.two,
    paddingHorizontal: Layout.cardPadding,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
