import type { DecisionListResponse, WeddingNote } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listDecisions, listWeddingNotes } from '@/api/client';
import { formatDateDot } from '@/features/common/format-date';
import { useDepthBack } from '@/features/navigation/depth-back';
import { ActionButton, Border, ErrorView, Layout, LineHeight, Radius, SkeletonView, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { Hero, NavBar, Screen } from '@/features/wedding/screen-kit';

/** `spec/strings.ko.json` `ourWedding.decided.*`. */
const S = {
  title: '예약현황',
  memo: '메모',
} as const;

/**
 * 예약현황. WP-OUR-003 · `docs/design/React_Native/note.jsx` frame-008.
 *
 *   nav     «예약현황» · 좌측 X 닫기(공통 풀팝업)
 *   업종마다  `sec`(`padding:0 24px 20px;gap:12px`) — 업종 이름 13/700(`secLabelC`) +
 *           카드(`decidedCard` — `margin:0 20px;padding:16px 18px;radius 10;REC;gap:5px`)
 *   카드     업체명 16/700 · «2026.08.20 결정» 12 · 메모(`memoAlwaysBox`) — 링크 없이 항상 펼친다
 *
 * 정본에 없는 Hero 요약 · «결정» 배지 · 관련 일정 · 관련 지출 · «메모 남기기» 링크는 지웠다.
 * 메모는 그 업체에 매단 웨딩 메모 중 가장 최근 것이다(`/v1/weddings/:id/notes`).
 * 정본 `decidedNote`(«보증 250명 · 계약금 500만원» 같은 계약 요약 한 줄)는 담을 서버 값이
 * 없어 그리지 않는다 — `DESIGN_UNRESOLVED`.
 */
export default function DecidedVendorsScreen() {
  const depthBack = useDepthBack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<DecisionListResponse | null>(null);
  const [notes, setNotes] = useState<WeddingNote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listDecisions(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
    // 메모는 보조 줄이다 — 못 받아도 결정 목록은 그린다.
    listWeddingNotes(id)
      .then((result) => setNotes(result.notes))
      .catch(() => undefined);
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={depthBack} onRetry={load} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  function latestMemo(vendorId: string): string | null {
    const mine = notes
      .filter((note) => note.vendorId === vendorId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return mine[0]?.body ?? null;
  }

  return (
    <Screen>
      <NavBar title={S.title} variant="close" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {page.decisions.length === 0 ? (
          <>
            <Hero title="아직 정한 곳이 없어요" sub="업종마다 마음에 드는 곳을 정하면 여기 모여요" />
            <View style={styles.emptyAction}>
              <ActionButton variant="ghost" size="large" label="Pick 보러 가기" onPress={() => router.push('/pick' as never)} />
            </View>
          </>
        ) : (
          page.decisions.map((decision) => {
            const memo = latestMemo(decision.vendor.id);
            return (
              <View key={decision.category} style={styles.sec}>
                <ThemedText type="f13" themeColor="textAssistive" style={[styles.bold, styles.label]}>
                  {decision.categoryLabel}
                </ThemedText>
                <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.top}>
                    <ThemedText type="f16" numberOfLines={1} style={[styles.bold, styles.grow]}>
                      {decision.vendor.name}
                    </ThemedText>
                    <ThemedText type="f12" themeColor="textAssistive" numeric>
                      {`${formatDateDot(decision.decidedAt).slice(0, 10)} 결정`}
                    </ThemedText>
                  </View>
                  {memo ? (
                    <View style={[styles.memo, { borderTopColor: theme.border }]}>
                      <ThemedText type="f12" themeColor="textAssistive" style={styles.bold}>
                        {S.memo}
                      </ThemedText>
                      <ThemedText type="f13" themeColor="textSecondary" style={styles.memoText}>
                        {memo}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* 프레임 끝 `height:24px` 빈 칸. */
  content: { paddingBottom: Spacing.four },
  emptyAction: { paddingHorizontal: Layout.gutter },
  /* note.js `sec` — `padding:0 24px 20px;gap:12px`. */
  sec: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.listGap, gap: Layout.inlineGap },
  /* `secLabelC` — `padding:0 20px`. */
  label: { paddingHorizontal: Layout.cardPadding },
  card: {
    marginHorizontal: Layout.cardPadding,
    paddingVertical: Spacing.three,
    paddingHorizontal: 18,
    borderRadius: Radius.medium,
    gap: 5,
  },
  /* `decidedTop` — baseline · 양끝 · gap 12. */
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Layout.inlineGap },
  /* `memoAlwaysBox` — `margin-top:8px;padding-top:8px;gap:3px`, 위 선. */
  memo: { marginTop: Spacing.two, paddingTop: Spacing.two, borderTopWidth: Border.hairline, gap: 3 },
  /* `memoAlwaysText` 13/19. 19는 같은 값의 `LineHeight.t7`. */
  memoText: { lineHeight: LineHeight.t7 },
  grow: { flex: 1, minWidth: 0 },
  bold: { fontWeight: 700 },
});
