import type { VendorDetail } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addWeddingEvent, getVendor } from '@/api/client';
import {
  Border,
  FontSize,
  Layout,
  LetterSpacing,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { BackButton } from '@/components/back-button';
import { CategoryImage } from '@/features/home/category-image';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { useMyCandidates } from '@/features/pick/use-my-candidates';

/**
 * 상담 예약 — 규격서 docs/design/figma-export/05-vendor-detail.dc.html(= vendor-1-booking.txt · 2026-09-15 대표 지시
 * 「규격서의 수를 그대로」 · 「고지가 먼저」 파기 — 상담 · 예약 화면을 만든다).
 *
 *   header 430×56  flex · align center · pad 0 16 · bg #FFFFFF 95%
 *     button 40×40 r9999  svg 20×20        p "상담 예약" · 14/700 · lh 20 · pad 0 40 0 0
 *   main 430×889  pad 28 20 0 20
 *
 * **규격서의 영문 eyebrow는 옮겨 적지 않는다**(2026-09-15 대표 지시 「이런 형식에 맞지 않는
 * 화면 있으면 싹다 찾아서 삭제해」). 아래 규격서 옮김에 `BLOOMING STUDIO` · `YOUR CONSULTANT`가
 * 그대로 남아 있는 것은 **무엇을 안 넣었는지 알아보라고 남긴 기록**이지 만들 목록이 아니다.
 * 제목 위 여백은 그 줄이 차지하던 높이를 합쳐 둔다 — 로그인 · 온보딩과 같은 방식이다.
 *     p "BLOOMING STUDIO" · 10/400 #868B94 · lh 15 · ls 1.7px      ← **넣지 않는다**(영문 eyebrow)
 *     h1 "우리에게 편한 시간으로 상담을 예약해요." · 30/700 #1A1C20 · lh 38 · ls -0.6px · mar 8 0 0 0
 *     div 390×113  flex · gap 16 · pad 16 · mar 28 0 0 0 · r16 · border 1 #000000 6%     ← 담당자 카드
 *       img 64×64 r18   p "YOUR CONSULTANT"(← **넣지 않는다**) 10/400 ls1.2 · p "김소연 작가" 14/700 mt4 · 별 12 ×5 + "10년 경력 · 자연광 전문" 10/400 · p "평균 응답 30분 이내" 11/400 mt4
 *     section mar 32 0 0 0                                                             ← 날짜 선택
 *       div flex · space-between · center · mar 0 0 12 0
 *         div flex · gap 8 · center   svg 16×16   h2 "날짜 선택" · 14/700 · lh 20         span "2026년 9월" · 10/400 #868B94
 *       div flex · gap 8 · pad 0 0 4 0
 *         button 80×69  flex/column · gap 4 · center · pad 12 20 12 20 · r16 · border 1     span "금" 10/500 #868B94 · span "18 일" 16/700 · lh 24
 *     section pad 24 0 0 0 · mar 32 0 0 0 · border 1(위)                                 ← 시간 선택
 *       div flex · gap 8 · center · mar 0 0 12 0   svg 16×16   h2 "시간 선택" · 14/700
 *       div grid · cols ×3 · gap 8       button 125×48 "오전 10:00" · 14/700 · lh 20 · r22 · border 1
 *     section pad 24 0 0 0 · mar 32 0 0 0 · border 1(위)                                 ← 남기고 싶은 말
 *       h2 "남기고 싶은 말" · 14/700 · mar 0 0 12 0   span "(선택)" · 14/400 #868B94
 *       textarea 390×96  pad 14 16 14 16 · r16 · border 1
 *     section pad 16 · mar 20 0 0 0 · bg #F7F8F9 · r16                                    ← 커플 공유
 *       div flex · gap 8 · center   svg 16×16   p "커플 캘린더에 자동으로 공유돼요" · 14/700
 *       p "지윤 · 준혁 두 분의 우리웨딩 캘린더에 상담 일정이 공유됩니다." · 12/400 #868B94 · lh 20 · mar 8 0 0 0
 *   div 430×89  pad 16 · bg #FFFFFF 95% · border 1(위)
 *     button 398×56  "날짜와 시간을 선택해주세요" · 14/700 #868B94 · lh 20 · bg #F7F8F9 · r16
 *     (고르면 primary 면 · 흰 글자 · check 16 · «9월 18일 · 오전 10:00 예약하기»)
 *
 * **규격서와 다르게 둔 것과 근거.**
 * - 담당자(«김소연 작가» · 경력 · 별점 · 응답 시간)는 우리 계약에 없다 — 카드 자리에 업체(이름 · 업종 · 지역)를
 *   같은 수로 세운다. 없는 값을 지어내지 않는다.
 * - 날짜 일곱은 오늘 다음 날부터 이레다(피그마의 «18 · 19 · 20 · 22 …»는 시안용 가짜 값). 시간 여섯은 피그마 그대로다.
 * - 저장은 웨딩노트 일정(`POST /v1/weddings/:id/events`)에 «{업체} 상담»으로 적는다 — 서버에 «상담 예약» 자원이
 *   따로 없고, 피그마도 확인 뒤 `/our-wedding`(우리 `/wedding`)으로 간다. **이 기능은 약관 반영이 필요하다** —
 *   무엇을 모아 어디로 보내는지는 PR 본문에 적었다.
 * - 아이콘: 피그마는 lucide(`CalendarDays` · `Clock3` · `Users` · `Check`)라 SEED가 아니다 — 우리 심볼(`calendar` ·
 *   `clock` · `twoPeople` · `check`)로 같은 크기(16)에 그린다.
 */

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

/** «오전 10:00» → 시 · 분. 저장은 기기 시간대 그대로 ISO로 보낸다. */
function parseTime(label: string): { hour: number; minute: number } {
  const [meridiem, clock] = label.split(' ');
  const [rawHour, rawMinute] = clock.split(':').map(Number);
  const hour = meridiem === '오후' && rawHour !== 12 ? rawHour + 12 : rawHour;

  return { hour, minute: rawMinute };
}

export default function ConsultScreen() {
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

  async function confirm() {
    if (!vendor || !chosen || !selectedTime) return;
    if (!candidates.weddingId) {
      router.push('/login');
      return;
    }
    const { hour, minute } = parseTime(selectedTime);
    const startsAt = new Date(chosen.date.getFullYear(), chosen.date.getMonth(), chosen.day, hour, minute);

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

  const names = [candidates.me?.displayName ?? '우리', candidates.partnerName].filter(Boolean).join(' · ');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* «header 430×56 · pad 0 16» — 뒤로 40 + 제목 가운데(오른쪽 40 비움). */}
        <View style={styles.navBar}>
          <BackButton />
          <ThemedText type="f14" numberOfLines={1} style={[styles.bold, styles.navTitle]}>
            {TITLE}
          </ThemedText>
        </View>

        {vendor === null ? (
          <View style={styles.loading}>
            <DelayedLoader size={40} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="f10" themeColor="textAssistive" style={styles.eyebrow}>
              {vendor.name.toUpperCase()}
            </ThemedText>
            <ThemedText type="f30" style={styles.headline}>
              {HEADLINE}
            </ThemedText>

            {/* 담당자 카드 자리 — 업체(위 JSDoc). */}
            <View style={[styles.vendorCard, { borderColor: theme.border }]}>
              <ThemedView type="backgroundElement" style={styles.vendorImage}>
                <CategoryImage uri={vendor.imageUrl} />
              </ThemedView>
              <View style={styles.vendorText}>
                <ThemedText type="f10" themeColor="textAssistive" style={styles.eyebrowTight}>
                  {VENDOR_CATEGORY_LABEL[vendor.category]}
                </ThemedText>
                <ThemedText type="f14" numberOfLines={1} style={[styles.bold, styles.vendorName]}>
                  {vendor.name}
                </ThemedText>
                <ThemedText type="f10" themeColor="textAssistive" numberOfLines={1} style={styles.vendorMeta}>
                  {vendor.region}
                </ThemedText>
              </View>
            </View>

            {/* 날짜 선택 */}
            <View style={styles.section}>
              <View style={styles.sectionHeadRow}>
                <View style={styles.sectionTitle}>
                  <ProductSymbol name="calendar" size={Layout.iconField} color={theme.text} />
                  <ThemedText type="f14" style={styles.bold}>
                    날짜 선택
                  </ThemedText>
                </View>
                <ThemedText type="f10" numeric themeColor="textAssistive">
                  {monthLabel}
                </ThemedText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
                {days.map((option) => {
                  const on = selectedDay === option.day;

                  return (
                    <Pressable
                      key={option.day}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${option.day}일 ${option.weekday}요일`}
                      onPress={() => setSelectedDay(option.day)}
                      style={[
                        styles.dayCell,
                        on
                          ? { backgroundColor: theme.text, borderColor: theme.text }
                          : { backgroundColor: theme.background, borderColor: theme.border },
                      ]}>
                      <ThemedText
                        type="f10"
                        style={[styles.medium, on ? [{ color: theme.onTint }, styles.dim] : { color: theme.textAssistive }]}>
                        {option.weekday}
                      </ThemedText>
                      <ThemedText type="f16" numeric style={[styles.bold, { color: on ? theme.onTint : theme.text }]}>
                        {option.day}일
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* 시간 선택 */}
            <View style={[styles.section, styles.sectionDivided, { borderTopColor: theme.border }]}>
              <View style={[styles.sectionTitle, styles.sectionHead]}>
                <ProductSymbol name="clock" size={Layout.iconField} color={theme.text} />
                <ThemedText type="f14" style={styles.bold}>
                  시간 선택
                </ThemedText>
              </View>
              <View style={styles.timeGrid}>
                {TIMES.map((time) => {
                  const on = selectedTime === time;

                  return (
                    <Pressable
                      key={time}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setSelectedTime(time)}
                      style={[
                        styles.timeCell,
                        on
                          ? { backgroundColor: theme.text, borderColor: theme.text }
                          : { backgroundColor: theme.background, borderColor: theme.border },
                      ]}>
                      <ThemedText type="f14" numeric style={[styles.bold, { color: on ? theme.onTint : theme.text }]}>
                        {time}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 남기고 싶은 말 */}
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

            {/* 커플 공유 */}
            <ThemedView type="backgroundElement" style={styles.sync}>
              <View style={styles.sectionTitle}>
                <ProductSymbol name="twoPeople" size={Layout.iconField} color={theme.text} />
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

        {/* «div 430×89 · pad 16 · border 1(위)» — 고정 CTA. */}
        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
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
        </View>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /* «header 430×56 · pad 0 16». */
  navBar: { height: Layout.navBar, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three },
  navTitle: { flex: 1, minWidth: 0, textAlign: 'center', paddingRight: Layout.iconButton },
  /* «main · pad 28 20 0 20». 아래는 고정 CTA 89 + 여유. */
  content: { paddingTop: Layout.sectionGap, paddingHorizontal: Layout.pageX, paddingBottom: Spacing.four },
  /* «10/400 · ls 1.7px». */
  eyebrow: { letterSpacing: LetterSpacing.p17 },
  /* 담당자 카드 «10/400 · ls 1.2px». */
  eyebrowTight: { letterSpacing: LetterSpacing.p12 },
  /* «30/700 · lh 38 · ls -0.6px · mar 8 0 0 0». */
  headline: { fontWeight: 700, letterSpacing: LetterSpacing.n06, marginTop: Spacing.two },
  /* «flex · gap 16 · pad 16 · mar 28 0 0 0 · r16 · border 1». */
  vendorCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    marginTop: Layout.sectionGap,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
  },
  /* «img 64×64 · r18». */
  vendorImage: { width: Layout.emptyMark, height: Layout.emptyMark, borderRadius: Radius.thumb, overflow: 'hidden' },
  vendorText: { flex: 1, minWidth: 0 },
  /* «14/700 · mar 4 0 0 0». */
  vendorName: { marginTop: Spacing.one },
  /* «10/400 · mar 4 0 0 0». */
  vendorMeta: { marginTop: Spacing.one },
  /* «mar 32 0 0 0». */
  section: { marginTop: Spacing.five },
  /* «pad 24 0 0 0 · border 1(위)». */
  sectionDivided: { paddingTop: Spacing.four, borderTopWidth: Border.hairline },
  /* «mar 0 0 12 0». */
  sectionHead: { marginBottom: Layout.sectionHeadGapCompact },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.sectionHeadGapCompact,
  },
  /* «flex · gap 8 · center». */
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  /* «flex · gap 8 · pad 0 0 4 0». */
  dayRow: { flexDirection: 'row', gap: Spacing.two, paddingBottom: Spacing.one },
  /* «button 80×69 · gap 4 · pad 12 20 · r16 · border 1». */
  dayCell: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Layout.inlineGap,
    paddingHorizontal: Layout.cardPadding,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
  },
  /* 고른 칸의 요일 «text-white/60». */
  dim: { opacity: 0.6 },
  /* «grid · cols ×3 · gap 8». */
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  /* «button 125×48 · r22 · border 1». */
  timeCell: {
    flexGrow: 1,
    flexBasis: '30%',
    height: Layout.controlLarge,
    borderRadius: Radius.hero,
    borderWidth: Border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* «textarea 390×96 · pad 14 16 · r16 · border 1» — 글자 14. */
  note: {
    height: Layout.textarea + Spacing.two,
    paddingVertical: Layout.fieldPaddingX,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    fontSize: FontSize.f14,
    lineHeight: LineHeight.lh20,
  },
  /* «pad 16 · mar 20 0 0 0 · r16». */
  sync: { marginTop: Layout.listGap, padding: Spacing.three, borderRadius: Radius.cardLarge },
  /* «12/400 · lh 20 · mar 8 0 0 0». */
  syncBody: { marginTop: Spacing.two, lineHeight: LineHeight.lh20 },
  /* «pad 16 · border 1(위)». */
  footer: { padding: Spacing.three, borderTopWidth: Border.hairline },
  /* «button 398×56 · r16 · gap 8». */
  cta: {
    height: Layout.ctaSheet,
    borderRadius: Radius.cardLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  bold: { fontWeight: 700 },
  medium: { fontWeight: 500 },
  pressed: { opacity: 0.8 },
});
