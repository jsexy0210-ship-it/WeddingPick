import { withParticle } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Layout,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 상담 예약 완료 · WP-DONE-VEND.
 *
 * 정본은 RN `docs/design/React_Native/common.js` `esc({ code: 'WP-DONE-VEND' })`(472행) ·
 * 보드 `common.jsx` `s.done` 구역이다(2026-09-25 MASTER 후속 — 「업데이트된 앱 화면에 다
 * 맞추라」). 앞 PR에서 DESIGN_UNRESOLVED로 남긴 WP-PICK-010(pick.jsx, 「상담 예약을
 * 요청했어요」)과의 충돌을 common 쪽 확정 시각형으로 정리했다. `search/[vendorId]/consult.tsx`
 * (WP-PICK-009) 제출 성공 뒤 이어진다.
 *
 *   머리      없음 — `back: false` · `nav` 없음. 나가는 길은 dock 두 단추뿐이다.
 *   마크      64 원 · 면 #fff5f2(tintSurface) · 코랄 체크(`eCHK(64, '#fff5f2', coral)`, 글리프 31).
 *   제목      26/35 700 가운데 · 위 6 — «{시각}로 잡았어요». 시각은 방금 웨딩노트 일정으로
 *             저장한 값(`addConsultationEvent` `startsAt`)이다.
 *   부제      15/23 보조색 가운데 — «{업체명}». 정본 «· 김소연 작가»의 담당자 이름은 서버에
 *             없어 붙이지 않는다(BACKEND_PENDING).
 *   반영 목록 `itemBox` 위 12 · r12 · #f7f8fa · 안쪽 18 · 사이 14. 줄마다 코랄 체크 20 +
 *             키 13 보조색 / 값 15 700.
 *               웨딩노트 «일정에 들어갔어요» — 저장 성공 뒤라 사실이다.
 *               {배우자}님 «이 일정이 보여요» — 연결된 배우자가 있을 때만(같은 웨딩 일정).
 *             정본 «알림 · 하루 전과 두 시간 전에 알려드려요»는 **BACKEND_PENDING** — 일정의
 *             `notify_enabled`를 읽어 알림을 보내는 작업이 서버에 없다. 없는 약속을 적지 않는다.
 *   다음 카드 `nextCard`(«다음» + 정본 문구)는 **두지 않았다 — DESIGN_UNRESOLVED.** 정본 문구의
 *             «좋아요»를 카피 린트(`spec/glossary.json` 금지어 «좋아요» → «Pick»)가 막는다.
 *             문구를 바꾸지도, 린트 규칙을 고치지도 않고 대표님 판단으로 올린다.
 *   dock      92 · 안쪽 12 20 · 사이 8 · 위 선 1. «홈으로»(flex 1 · 56 · r6 · #f2f3f6 ·
 *             17/700) + «웨딩노트 보기»(flex 1.4 · 코랄 · 흰 글자).
 */
export default function ConsultDoneScreen() {
  const theme = useTheme();
  const { vendorName, when, partnerName } = useLocalSearchParams<{
    vendorName?: string;
    when?: string;
    partnerName?: string;
  }>();

  const title = when ? `${withParticle(when, '으로로')} 잡았어요` : '';
  const items = [
    { k: '웨딩노트', v: '일정에 들어갔어요' },
    ...(partnerName ? [{ k: `${partnerName}님`, v: '이 일정이 보여요' }] : []),
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.mark, { backgroundColor: theme.tintSurface }]}>
            <ProductSymbol name="check" size={MARK_ICON} color={theme.tint} />
          </View>
          {title ? (
            <ThemedText type="t2" style={[styles.center, styles.title]}>
              {title}
            </ThemedText>
          ) : null}
          {vendorName ? (
            <ThemedText type="f15" themeColor="textSecondary" style={[styles.center, styles.sub]}>
              {vendorName}
            </ThemedText>
          ) : null}

          <View style={[styles.itemBox, { backgroundColor: theme.backgroundElement }]}>
            {items.map((item) => (
              <View key={item.k} style={styles.itemRow}>
                <View style={[styles.itemMark, { backgroundColor: theme.tint }]}>
                  <ProductSymbol name="check" size={ITEM_ICON} color={theme.onTint} />
                </View>
                <View style={styles.itemCol}>
                  <ThemedText type="f13" themeColor="textSecondary">
                    {item.k}
                  </ThemedText>
                  <ThemedText type="f15" style={styles.bold}>
                    {item.v}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

        </ScrollView>

        <ThemedView style={[styles.dock, { borderTopColor: theme.line }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="홈으로"
            onPress={() => router.replace('/(tabs)')}
            style={({ pressed }) => [
              styles.button,
              styles.ghost,
              { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText type="f17" themeColor="textStrong" style={styles.bold}>
              홈으로
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="웨딩노트 보기"
            onPress={() => router.replace('/wedding')}
            style={({ pressed }) => [
              styles.button,
              styles.primary,
              { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText type="f17" themeColor="onTint" style={styles.bold}>
              웨딩노트 보기
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 정본 `markStyle` eCHK(64) · 글리프 64 × .48 = 31. Layout에 없는 값. */
const MARK_SIZE = 64;
const MARK_ICON = 31;
/** 정본 `itemMark` eCHK(20) · 글리프 20 × .48 = 10. */
const ITEM_MARK = 20;
const ITEM_ICON = 10;
/** 정본 `doneWrap` «padding:72px 24px 24px» — 위쪽 72. */
const WRAP_PAD_TOP = 72;
/** 정본 `itemBox` · `nextCard` radius 12 · 안쪽 18 · `itemBox` 사이 14. 사다리 밖의 값이다. */
const BOX_RADIUS = 12;
const BOX_PADDING = 18;
const ITEM_GAP = 14;
/** 정본 `doneTitle` padding-top 6. */
const TITLE_PAD_TOP = 6;
/** 정본 dock «padding:12px 20px» — 좌우 20(거터 24와 다르다). */
const DOCK_PAD_X = 20;
/** 정본 dock 두 단추 비율 1 : 1.4. */
const PRIMARY_FLEX = 1.4;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', maxWidth: MaxContentWidth, width: '100%' },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },

  /* 정본 doneWrap padding 72 24 24 · gap 12 · 가운데. */
  scroll: {
    flexGrow: 1,
    paddingTop: WRAP_PAD_TOP,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    alignItems: 'center',
    gap: Layout.rowPaddingY,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { paddingTop: TITLE_PAD_TOP },
  sub: { lineHeight: LineHeight.lh23 },

  itemBox: {
    alignSelf: 'stretch',
    marginTop: Layout.rowPaddingY,
    borderRadius: BOX_RADIUS,
    padding: BOX_PADDING,
    gap: ITEM_GAP,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two + Spacing.half },
  itemMark: {
    width: ITEM_MARK,
    height: ITEM_MARK,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCol: { flex: 1, minWidth: 0, gap: Spacing.half },


  /* 정본 dock 92 · padding 12 20 · gap 8 · 위 선 1. */
  dock: {
    minHeight: Layout.dock,
    borderTopWidth: 1,
    paddingHorizontal: DOCK_PAD_X,
    paddingVertical: Layout.rowPaddingY,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    height: Layout.ctaSheet,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { flex: 1 },
  primary: { flex: PRIMARY_FLEX },
});
