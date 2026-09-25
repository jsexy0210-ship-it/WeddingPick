import type { CandidateListResponse, VendorDetail } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, addConsultationEvent, getCurrentUser, getVendor, listCandidates } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import {
  Border,
  FontSize,
  Layout,
  LineHeight,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';

import VendorDetailScreen from './index';

const TITLE = '상담 예약';
/* 정본 pick.jsx WP-PICK-009 h1 «언제 만나면 / 좋을까요?». */
const HEADLINE = '언제 만나면\n좋을까요?';
/*
 * 시간은 «숫자 대신 말로» 적는다 — 시안 WP-PICK-009 `times`가 그대로 이 여섯이다.
 * 「오전 10:00」 꼴은 Figma 원본이고 정본 대조표가 「오전 10시」로 바꿔 적었다.
 */
const TIMES = ['오전 10시', '오전 11시 반', '오후 1시', '오후 2시', '오후 3시 반', '오후 5시'] as const;
/* 정본 textarea 문구. */
const NOTE_PLACEHOLDER = '원하는 분위기나 궁금한 점을 적어주세요';
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

/* 2026-09-25 대표 결정(안 A) — 상담 예약은 최종 결정이 아니라 Pick(후보 담기)을 요구한다. */
const PICK_REQUIRED_TITLE = 'Pick 확인이 필요해요';
const PICK_REQUIRED = 'Pick에 담은 업체만 상담 예약을 할 수 있어요.';

/**
 * 이 업체가 이 웨딩의 Pick 후보이거나 이미 결정한 업체인가. 서버
 * (`POST /v1/weddings/{id}/consultation-events`)도 같은 두 조건으로 다시 확인한다.
 */
function isPickedVendor(page: CandidateListResponse, vendorId: string): boolean {
  return page.groups.some(
    (group) =>
      group.decidedVendorId === vendorId || group.candidates.some((candidate) => candidate.vendorId === vendorId)
  );
}

/** 「오전 11시 반」처럼 말로 적은 라벨을 24시간 시각으로 읽는다. 「반」은 30분이다. */
function parseTime(label: string): { hour: number; minute: number } {
  const [meridiem, ...rest] = label.split(' ');
  const rawHour = Number(rest[0].replace('시', ''));
  const minute = rest.includes('반') ? 30 : 0;
  const hour = meridiem === '오후' && rawHour !== 12 ? rawHour + 12 : rawHour;
  return { hour, minute };
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
      // 2026-09-25 대표 결정(안 A) — 최종 결정 없이도 Pick에 담은 업체(후보)면 상담 예약을 연다.
      const allowed = isPickedVendor(page, vendorId);
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

      // 배우자가 방금 Pick에서 뺐을 수 있으므로 공용 30초 GET 캐시를 우회한다.
      const latestCandidates = await listCandidates(me.weddingId, { force: true });
      const stillPicked = isPickedVendor(latestCandidates, vendor.id);
      if (!stillPicked) {
        setDecisionState('blocked');
        setToast(PICK_REQUIRED);
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

      await addConsultationEvent(me.weddingId, {
        title: `${vendor.name} 상담`,
        startsAt: startsAt.toISOString(),
        location: vendor.region,
        vendorId: vendor.id,
        vendorLabel: vendor.name,
        idempotencyKey: `consult:${vendor.id}:${startsAt.toISOString()}`,
        memo: note.trim() || undefined,
        notifyEnabled: true,
      });
      showResultToast('상담 예약을 요청했어요');
      /* 제출 성공 뒤 WP-DONE-VEND(상담 예약 완료)으로 넘긴다 — 예전에는 곧장
         /wedding으로 가서 이 확인 화면이 없었다(2026-09-23 v3.29 대조로 추가). */
      router.replace({
        pathname: '/search/[vendorId]/consult-done',
        params: {
          vendorId: vendor.id,
          vendorName: vendor.name,
          when: `${chosen.date.getMonth() + 1}월 ${chosen.day}일 ${selectedTime}`,
          partnerName: candidates.partnerName ?? '',
        },
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }
      if (caught instanceof ApiError && caught.status === 403) {
        setDecisionState('blocked');
        setToast('Pick 상태가 바뀌었어요. 나의 Pick에서 다시 확인해주세요.');
        return;
      }
      setToast(
        decisionVerified
          ? '상담 일정을 등록하지 못했어요. 잠시 후 다시 시도해주세요.'
          : 'Pick 상태를 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.'
      );
    } finally {
      submitLock.current = false;
      setSending(false);
    }
  }

  const decisionMessage =
    decisionState === 'error'
      ? 'Pick 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.'
      : PICK_REQUIRED;

  return (
    <View style={styles.host}>
      <VendorDetailScreen />

      <BottomSheet visible onRequestClose={requestClose} testID="consult-booking-sheet">
        <SheetPanel>
          {/* 정본 navTitle «상담 예약» 자리. 정본에 없는 설명 줄(«업체 상세를 보면서…»)은 지웠다. */}
          <View style={styles.sheetHead}>
            <ThemedText type="t4">{TITLE}</ThemedText>
          </View>

          {vendor === null || decisionState === 'loading' ? (
            <View style={styles.loading}>
              <DelayedLoader size={40} />
            </View>
          ) : decisionState !== 'allowed' ? (
            <View style={styles.guard}>
              <ThemedText type="f16" style={styles.bold}>{PICK_REQUIRED_TITLE}</ThemedText>
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
              {/* 정본 secTop — h1 26/35/700 · 부제 14/20 회색 · 사이 14. 부제의 «· 김소연 작가»(담당자)는
                  서버에 값이 없어 업체 이름만 적는다(PR 본문 DESIGN_UNRESOLVED). */}
              <View style={styles.secTop}>
                <ThemedText type="f26" style={[styles.bold, styles.headline]}>
                  {HEADLINE}
                </ThemedText>
                <ThemedText type="f14" themeColor="textAssistive" numberOfLines={1}>
                  {vendor.name}
                </ThemedText>
              </View>

              {/* 정본 sec «날짜» — 머리 17/700 · 달 13 회색, 칸 60×72 · radius 10 · 사이 8. */}
              <View style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <ThemedText type="f17" style={styles.bold}>날짜</ThemedText>
                  <ThemedText type="f13" numeric themeColor="textAssistive">
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
                          { backgroundColor: selected ? theme.tint : theme.backgroundElement },
                        ]}>
                        <ThemedText
                          type="f12"
                          style={selected ? [styles.dayWeekOn, { color: theme.onTint }] : { color: theme.textAssistive }}>
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

              {/* 정본 sec «시간» — 3열 · 사이 8, 칸 높이 48 · radius 6 · 15/700. */}
              <View style={styles.section}>
                <ThemedText type="f17" style={styles.bold}>시간</ThemedText>
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
                          { backgroundColor: selected ? theme.tint : theme.backgroundElement },
                        ]}>
                        <ThemedText
                          type="f15"
                          numeric
                          themeColor={selected ? 'onTint' : 'textSecondary'}
                          style={styles.bold}>
                          {time}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 정본 sec «남기고 싶은 말» — 입력 최소 96 · radius 6 · 1px #d1d3d8 · 안쪽 14 · 15px. */}
              <View style={styles.section}>
                <ThemedText type="f17" style={styles.bold}>남기고 싶은 말</ThemedText>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  textAlignVertical="top"
                  placeholder={NOTE_PLACEHOLDER}
                  placeholderTextColor={theme.textDisabled}
                  accessibilityLabel="남기고 싶은 말"
                  style={[styles.note, { borderColor: theme.fieldBorder, color: theme.text }]}
                />
              </View>

              {/* 정본 syncBox — radius 10 · 안쪽 16 · 사이 4, 15/700 + 13 회색. */}
              <View style={styles.section}>
                <ThemedView type="backgroundElement" style={styles.sync}>
                  <ThemedText type="f15" style={styles.bold}>
                    웨딩노트에 같이 올라가요
                  </ThemedText>
                  {candidates.partnerName ? (
                    <ThemedText type="f13" themeColor="textAssistive">
                      {candidates.partnerName}님에게도 이 일정이 보여요
                    </ThemedText>
                  ) : null}
                </ThemedView>
              </View>
            </ScrollView>
          )}

          {/* 정본 dockSingle ctaFull — 높이 56 · radius 6 · 18/700. 고르기 전 상태는 정본에 없다(PR 본문). */}
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
                <ThemedText type="f18" themeColor="onTint" style={styles.bold}>
                  {chosen.date.getMonth() + 1}월 {chosen.day}일 {selectedTime}로 잡기
                </ThemedText>
              ) : (
                <ThemedText type="f18" themeColor="textAssistive" style={styles.bold}>
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
  /* 정본 마지막 «height:24px» 여백. */
  content: { paddingBottom: Spacing.four },
  /* 정본 h1 26/35(t2 줄높이 — 같은 값). */
  headline: { lineHeight: LineHeight.t2 },
  /* 정본 secTop · sec — 위아래 20 · 안쪽 사이 14 / 12. 좌우는 시트 거터가 맡는다. */
  secTop: { paddingVertical: Layout.listGap, gap: Layout.sectionHeadGap },
  section: { paddingVertical: Layout.listGap, gap: Layout.inlineGap },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  dayRow: { flexDirection: 'row', gap: Spacing.two },
  /* 정본 dt().cell — 60×72 · radius 10 · 사이 4. */
  dayCell: {
    width: 60,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.medium,
  },
  /* 정본 고른 요일 rgba(255,255,255,.72). */
  dayWeekOn: { opacity: 0.72 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  /* 정본 tm() — 3열(1fr) · 높이 48 · radius 6. 3열 폭은 (100% − 사이 8×2) ÷ 3. */
  timeCell: {
    width: '31%',
    flexGrow: 1,
    height: Layout.controlLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 정본 textarea — 최소 96 · radius 6 · 1px · 안쪽 14 · 15px. */
  note: {
    minHeight: 96,
    padding: Layout.fieldPaddingX,
    borderRadius: Radius.input,
    borderWidth: Border.hairline,
    fontSize: FontSize.f15,
  },
  /* 정본 syncBox — radius 10 · 안쪽 16 · 사이 4. */
  sync: { padding: Spacing.three, gap: Spacing.one, borderRadius: Radius.medium },
  /* 정본 ctaFull — 높이 56 · radius 6. */
  cta: {
    height: Layout.ctaSheet,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
});
