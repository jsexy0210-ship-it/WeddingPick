import type { CandidateListResponse, VendorDetail } from '@weddingpick/api-contract';
import { withInstrument } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, addConsultationEvent, getCurrentUser, getVendor, listCandidates } from '@/api/client';
import { FullPopupHeader } from '@/components/full-popup-header';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { OsDateField, OsTimeField } from '@/features/common/os-picker-field';
import { dateOfDay, dayOf } from '@/features/common/os-picker-field.shared';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import {
  Border,
  CanonGray,
  FontSize,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';

const TITLE = '상담 예약';
/* 정본 pick.jsx WP-PICK-009 h1 «언제 만나면 / 좋을까요?». */
const HEADLINE = '언제 만나면\n좋을까요?';
/* 정본 textarea 문구. */
const NOTE_PLACEHOLDER = '원하는 분위기나 궁금한 점을 적어주세요';
/* 상담 날짜는 내일부터 7일 안에서 고른다 — 날짜 칩 7개이던 때의 범위를 그대로 선택기에 건다. */
const DAY_COUNT = 7;

type DecisionState = 'loading' | 'allowed' | 'blocked' | 'error';

/** `HH:MM` → 「오후 2시」 · 「오전 11시 반」 — 완료 화면과 CTA의 말투(시안 WP-PICK-009 `times`)를 잇는다. */
function spokenTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const meridiem = hour! < 12 ? '오전' : '오후';
  const hour12 = hour! % 12 === 0 ? 12 : hour! % 12;
  const tail = minute === 0 ? '' : minute === 30 ? ' 반' : ` ${minute}분`;

  return `${meridiem} ${hour12}시${tail}`;
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

/**
 * 상담 예약 — WP-PICK-009. **공통 풀팝업**이다(2026-09-25 대표 지시 「상담 예약은 공통
 * 풀팝업 UX로 변경한다」). 예전에는 업체 상세 위 DLG-D BottomSheet였다.
 *
 *   머리   `FullPopupHeader` — 56 · 좌우 16 · 좌측 36 회색 원형 X(16) · 가운데 «상담 예약» ·
 *          우측 36 빈 칸 · 아래 1px 선. 약관 상세(WP-AUTH-011)와 같은 머리다.
 *   본문   스크롤. 좌우 거터 24.
 *   도크   아래 고정 — «…잡기» CTA 하나. 홈 표시줄 inset을 도크가 챙긴다.
 *
 * 업체 상세를 밑에 깔지 않고 이 화면 하나가 전체를 차지한다. X · 안드로이드 뒤로는 입력이
 * 있으면 DLG-B(`requestDirtySheetClose`)를 거쳐 업체 상세로 닫는다.
 * /booking은 이 route를 그대로 re-export하므로 같은 규칙을 공유한다.
 */
export default function ConsultRoute() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const candidates = useMyCandidates();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [range] = useState(() => {
    const today = new Date();
    return {
      min: dayOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
      max: dayOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAY_COUNT)),
    };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
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
  const chosen = dateOfDay(selectedDay);
  const dirty = selectedDay !== null || selectedTime !== null || note.length > 0;

  function closeSheet() {
    dismissToOrReplace(`/search/${vendorId}`);
  }

  function requestClose() {
    if (sending) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  /* 안드로이드 뒤로 — X와 같은 닫기(입력이 있으면 한 번 묻는다). 시트일 때 Modal이 하던 일이다. */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!sending) requestDirtySheetClose(dirty, () => dismissToOrReplace(`/search/${vendorId}`));
      return true;
    });
    return () => subscription.remove();
  }, [dirty, sending, vendorId]);

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

      const [hour, minute] = selectedTime.split(':').map(Number);
      const startsAt = new Date(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), hour, minute);

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
          when: `${chosen.getMonth() + 1}월 ${chosen.getDate()}일 ${spokenTime(selectedTime)}`,
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
    <ThemedView style={styles.container} testID="consult-booking-popup">
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* 정본 navTitle «상담 예약» 자리 — 공통 풀팝업 머리(좌측 회색 원형 X · 가운데 제목). */}
        <FullPopupHeader title={TITLE} onClose={requestClose} closeDisabled={sending} />

        {/* 메모 칸에서 키보드가 올라오면 본문 · 도크를 그만큼 밀어 올린다 — 시트일 때 BottomSheet가
            하던 일이다. 안드로이드는 창 크기 조절을 시스템이 해서 따로 밀지 않는다. */}
        <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

              {/* 정본 sec «날짜» · «시간» — 날짜 칩 7개 · 시간 칩 6개를 OS 날짜 · 시간 선택기로
                  바꿨다(2026-09-25 대표 지시 「OS 데이트피커 · 타임피커」). */}
              <View style={styles.section}>
                <OsDateField
                  label="날짜"
                  value={selectedDay}
                  placeholder="날짜를 골라주세요"
                  min={range.min}
                  max={range.max}
                  onChange={setSelectedDay}
                />
                <OsTimeField label="시간" value={selectedTime} placeholder="시간을 골라주세요" onChange={setSelectedTime} />
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

          {/* 정본 dockSingle ctaFull — 높이 56 · radius 6 · 18/700. 고르기 전 상태는 정본에 없다(PR 본문).
              도크는 아래에 고정하고 홈 표시줄 inset을 직접 챙긴다(약관 상세 도크와 같은 값). */}
          {decisionState === 'allowed' ? (
            <ThemedView
              style={[
                styles.dock,
                { borderTopColor: CanonGray.gray200, paddingBottom: Math.max(DOCK_BOTTOM, Layout.gutter + insets.bottom) },
              ]}>
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
                    {chosen.getMonth() + 1}월 {chosen.getDate()}일 {withInstrument(spokenTime(selectedTime ?? ''))} 잡기
                  </ThemedText>
                ) : (
                  <ThemedText type="f18" themeColor="textAssistive" style={styles.bold}>
                    {sending ? '등록하는 중…' : '날짜와 시간을 선택해주세요'}
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

/* 도크 아래 여백 — 약관 상세(WP-AUTH-011) 도크와 같은 48. 홈 인디케이터 기기는 24 + inset이 더 크면 그것. */
const DOCK_BOTTOM = 48;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  body: { flex: 1 },
  loading: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  guard: { flex: 1, minHeight: 220, paddingHorizontal: Layout.gutter, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  guardText: { textAlign: 'center' },
  guardButton: {
    minHeight: Layout.ctaInCard,
    marginTop: Spacing.two,
    paddingHorizontal: Layout.cardPadding,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  /* 정본 마지막 «height:24px» 여백 · 좌우 거터 24. */
  content: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  /* 정본 h1 26/35(t2 줄높이 — 같은 값). */
  headline: { lineHeight: LineHeight.t2 },
  /* 정본 secTop · sec — 위아래 20 · 안쪽 사이 14 / 12. 좌우는 `content`의 거터가 맡는다. */
  secTop: { paddingVertical: Layout.listGap, gap: Layout.sectionHeadGap },
  section: { paddingVertical: Layout.listGap, gap: Layout.inlineGap },
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
  /* 도크 — 위 선 1 · 위 12 · 좌우 거터 · 아래는 inset 계산(위 DOCK_BOTTOM). */
  dock: { paddingHorizontal: Layout.gutter, paddingTop: 12, borderTopWidth: 1 },
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
