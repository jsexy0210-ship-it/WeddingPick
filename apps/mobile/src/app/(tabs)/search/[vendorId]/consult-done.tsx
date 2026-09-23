import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 상담 예약 완료 · WP-PICK-010.
 *
 * v3.29 정본 `docs/design/html/대메뉴_Pick.dc.html` 1-2번 화면(vtag 「상담 예약 완료」)이
 * 근거다 — tagDesc: 「상담 예약 신청 후 뜹니다. 결정 상태 대신 연락을 기다려달라는
 * 안내로 바꿨습니다.」 이 화면이 `search/[vendorId]/consult.tsx`(WP-PICK-009 상담 예약
 * 폼) 제출 성공 뒤 이어진다 — 예전에는 제출 즉시 `/wedding`으로 바로 넘어가 이 확인
 * 화면이 아예 없었다(2026-09-23 v3.29 대조로 발견 · 추가).
 *
 *   머리(56)  없음 — 정본에 뒤로가기·X가 없다. 나가는 길은 하단 CTA 하나뿐이다.
 *   마크      72 coral 원 + 체크 36 white(정본 icoCheckBig — Pick Mark 하트가 아니라
 *             일반 체크다. 하트+체크는 «최종 결정»(WeddingMark)에만 쓴다).
 *   제목      26/700 가운데 «상담 예약을\n요청했어요»(정본 문구 그대로)
 *   부제      15/400 가운데 «{업체명} · {날짜 시간}» — 정본 예시는 «블루밍 스튜디오 ·
 *             9월 20일 오후 2시», 여기서는 방금 고른 실제 값을 쓴다.
 *   요약 카드 정본 doneRows(웨딩노트/예산/배우자)는 «결정 완료» 화면 데이터를 그대로
 *             재사용한 목업이라 이 화면(예약)에는 안 맞는다 — 서버가 주지 않는 예산 값을
 *             지어 넣지 않는다. 실제로 있는 사실만 두 줄로 줄였다: 웨딩노트 반영 · 배우자
 *             알림(연동돼 있을 때만).
 *   안내 상자  «연락을 기다려주세요» + «영업일 기준 1~2일 안에 업체가 연락드려요»(정본 문구 그대로)
 *   CTA       56(tokens Layout.ctaSheet — 정본 dockSingle 92 안의 ctaFull 56과 같은 값)
 *             «웨딩노트에서 확인하기»(정본 문구 그대로) → `/wedding`
 */
export default function ConsultDoneScreen() {
  const theme = useTheme();
  const { vendorName, category, when, partnerLinked } = useLocalSearchParams<{
    vendorName?: string;
    category?: string;
    when?: string;
    partnerLinked?: string;
  }>();

  const name = vendorName ?? '';
  const categoryLabel = category ? (VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? category) : '';
  const sub = [name, when].filter(Boolean).join(' · ');
  const hasPartner = partnerLinked === '1';

  const rows = [
    { k: '웨딩노트', v: `${categoryLabel ? `${categoryLabel} ` : ''}상담 일정에 반영됐어요` },
    ...(hasPartner ? [{ k: '배우자', v: '알림 보냄' }] : []),
  ];

  function goWedding() {
    router.replace('/wedding');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <View style={[styles.mark, { backgroundColor: theme.tint }]}>
              <ProductSymbol name="check" size={MARK_ICON} color={theme.onTint} />
            </View>
            <ThemedText type="t2" style={styles.center}>상담 예약을{'\n'}요청했어요</ThemedText>
            {sub ? (
              <ThemedText type="body" themeColor="textSecondary" style={styles.center}>
                {sub}
              </ThemedText>
            ) : null}
          </View>

          <View style={[styles.cards, { backgroundColor: theme.backgroundElement }]}>
            {rows.map((row, i) => (
              <View
                key={row.k}
                style={[
                  styles.row,
                  i < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
                ]}>
                <ThemedText type="t7" themeColor="textAssistive" style={styles.rowKey}>{row.k}</ThemedText>
                <ThemedText type="t7" style={styles.bold}>{row.v}</ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.nextBox, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
            <ThemedText type="t5" style={styles.bold}>연락을 기다려주세요</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              영업일 기준 1~2일 안에 업체가 연락드려요
            </ThemedText>
          </View>
        </ScrollView>

        <ThemedView style={[styles.dock, { borderTopColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="웨딩노트에서 확인하기"
            onPress={goWedding}
            style={({ pressed }) => [styles.cta, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText type="t5" themeColor="onTint">웨딩노트에서 확인하기</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 정본 doneMark 72 · 안의 체크 36(icoCheckBig) — Layout에 없는 값, done.tsx MARK_ICON과 같은 관례. */
const MARK_SIZE = 72;
const MARK_ICON = 36;
/** 정본 doneScroll «padding:56px 24px 24px» — 머리 위쪽 56. Layout 사다리에 없는 값. */
const HEAD_PAD_TOP = 56;
/** 정본 doneRow «min-height:52px» — Layout.rowMinHeightCompact(48)과 다른 값이라 대신하지 않는다. */
const ROW_MIN_HEIGHT = 52;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', maxWidth: MaxContentWidth, width: '100%' },
  scroll: { flexGrow: 1, paddingBottom: Spacing.five },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },

  /* 정본 doneScroll padding 56 24 24 · gap 12 · 가운데. */
  head: {
    paddingTop: HEAD_PAD_TOP,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.rowPaddingY,
    alignItems: 'center',
    gap: Spacing.two,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },

  /* 정본 doneCards radius 10 · overflow hidden(테두리 없음) · 행 min-height 52 · padding 0 16. */
  cards: {
    marginTop: Layout.rowPaddingY,
    marginHorizontal: Layout.gutter,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
  },
  rowKey: { flex: 1, minWidth: 0 },

  /* 정본 nextBox padding 16 · radius 10 · gap 4(tint 면 — 테두리는 done.tsx nextBox 관례를 따른다). */
  nextBox: {
    marginTop: Layout.rowPaddingY,
    marginHorizontal: Layout.gutter,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    gap: Spacing.half,
  },

  /* 정본 dockSingle 92 · padding 12 20 — Layout.dock과 같은 값. */
  dock: {
    minHeight: Layout.dock,
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Layout.rowPaddingY,
    justifyContent: 'center',
  },
  /* 정본 ctaFull height 56 — Layout.ctaSheet와 같은 값. */
  cta: {
    height: Layout.ctaSheet,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
