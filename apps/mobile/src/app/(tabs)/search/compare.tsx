import type { VendorComparisonResponse, VendorDetail } from '@weddingpick/api-contract';
import {
  COLLECTING_LABEL,
  DISCLOSURE_THRESHOLDS,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  formatCount,
  regionLabel,
  manwon,
  priceLine,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { compareVendors, getCurrentUser, recordComparison } from '@/api/client';
import { DepthHeader } from '@/components/depth-header';
import { useDepthBack } from '@/features/navigation/depth-back';
import { savePendingAction } from '@/features/auth/pending-action';
import { PickDoneSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import {
  ErrorView,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
  Skeleton,
  VendorImage,
} from '@weddingpick/ui';

/**
 * 비교 결과 · WP-CMP-002 (v3.29 `대메뉴_Pick.dc.html` 1-1 «비교» WP-PICK-006).
 *
 * **v3.29가 바꾼 것 — 표 → 카드 랭킹.** tagDesc 원문: 「스프레드시트형 표를 카드
 * 랭킹형으로 바꿨습니다. 항목별 승수를 세어 가장 많이 앞선 카드를 위에 두고, 각
 * 카드 안에서 이긴 지표에 점을 찍습니다. 좌우 스와이프 없이 세로로만 봅니다.」
 * 옛 v3.28 구현(가로 스크롤 스프레드시트 표, 라벨열 고정)은 이 화면이 실제로는
 * 이미 폐기된 레이아웃이었다 — 2026-09-23 `837c7797` 커밋이 "v3.29가 Pick 파일에서
 * 바꾼 것은 헤더뿐"이라 적었는데, WP-PICK-006 tagDesc를 놓친 오판이었다. 이번
 * 세션이 `--wp WP-PICK-006`으로 직접 열어 재확인하고 고쳤다.
 *
 * 카드 구조(정본 `rank()` 헬퍼 그대로): 사진 72×72 radius10(+결정 표시 체크뱃지) ·
 * 이름/업종 · 「N개 앞서요」뱃지 · 지표 목록(라벨 + 값, 우세값만 700 진하게 + 점) ·
 * 카드 전용 CTA. **승수(winCount) 내림차순 정렬**이 랭킹의 핵심이라 이 화면은
 * 더 이상 입력 순서를 그대로 보여주지 않는다.
 *
 * 헤더는 v3.28대로 back 화살이었으나, PROJECT_RULES.md 공통 헤더 규격 — 「풀팝업은
 * 회색 원형 X」와 정본 cmpHead(closeBtn)가 이 화면을 닫기형으로 그린다.
 * `DepthHeader variant="close"`로 바꿨다. 타이틀도 정본 그대로 «비교» 한 글자다 —
 * 예전엔 업종·업체 수를 붙였는데 문구를 임의로 늘린 것이었다.
 *
 * **카드 CTA — 두 콜러를 함께 섬긴다.** 정본 `rank().cta`는 언제나 «상담 예약»/
 * «상담 예약함»이다 — Pick 탭(이미 후보로 담은 곳끼리 비교)만 가정한 그림이다.
 * 그런데 이 라우트는 홈의 «웨딩픽 추천» 비교(`(tabs)/index.tsx` `onPressCompare`,
 * 아직 Pick 전인 추천 후보를 비교)도 같이 쓴다 — 그 화면은 건드리지 말라는 지시가
 * 있어(2026-09-23) 손대지 않았다. 그래서 카드별로 **이미 Pick한 후보면 정본대로
 * «상담 예약»**(최종 결정된 곳이면 코랄 강조), **아직 Pick 전이면 «Pick»**을 보여준다
 * — 후자는 정본에 없는 그림이지만, 지우면 홈 추천 비교에서 후보를 담을 길이
 * 없어져 다른 화면군의 기존 기능을 깨뜨린다(CLAUDE.md 「공용 컴포넌트·다른 화면군이
 * 같이 쓰는 라우트인지 먼저 확인」).
 *
 * **DESIGN_UNRESOLVED — 「상담 예약함」.** 정본은 이미 예약을 넣은 카드를 다르게
 * 표시한다(`o.confirmed`). 이 화면엔 업체별 기존 예약 여부를 읽을 자료원이 없어
 * (상담 일정 조회 API가 업체 단위로 없다) 항상 «상담 예약»만 보여준다 — 없는 값을
 * 지어 넣지 않는다.
 *
 * 2026-09-14 대표 지시로 표를 만들 때 세운 원칙은 카드형으로 옮긴 뒤에도 그대로다 —
 * 비교 기준은 제보 금액 · 실 제보 · 기준금액 순, 우세 표시는 **우세값만 700
 * 진하게**(배경 · 배지 없음 — 가치판단 표현 금지), 결론 한 줄은 상단 힌트에, 최대
 * 3곳(`PICK_COMPARE_MAX`).
 *
 * 단서(caveats)는 서버가 결과와 함께 내려준다 — 카드만 그리고 «금액만으로는
 * 비교할 수 없다»는 말을 빠뜨리면 우리가 만든 카드가 오해를 부추긴다. 정본
 * WP-PICK-006에는 이 요약 카드가 그려져 있지 않지만, 사업계획서가 꼽은 법적/신뢰
 * 고지라 지우지 않는다(hint 두 번째 줄에도 첫 caveat을 요약해 보여준다).
 *
 * 값은 우세한 쪽만 text 색 · 700, 나머지는 textAssistive · 400이다(v3.28 «우세
 * 표시», v3.29도 그대로). 웨딩픽은 비싸다 싸다를 판정하지 않는다 — 우세는
 * «정보가 더 있다»(실 제보 건수)로만 가른다.
 */
const COUNT_GAP_NOTABLE = DISCLOSURE_THRESHOLDS.limited;

const HEADER_TITLE = '비교';
const ROW_PRICE = '제보 금액';
const ROW_MEDIAN = TERMS.baseAmount;
const ROW_COUNT = TERMS.verifiedData;
const ROW_CATEGORY = '업종 · 지역';
const ROW_SOURCE = '업체 정보 출처';
const SOURCE_FROM_DOCUMENT = '올려주신 문서에서 확인한 업체예요';
const CTA_CONSULT = '상담 예약';

export default function CompareScreen() {
  const depthBack = useDepthBack();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const theme = useTheme();
  const [result, setResult] = useState<VendorComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  /* Pick 전·후 — 검색 카드 · 업체 상세와 같은 후보 목록을 본다. 이미 Pick한 곳인지 ·
     그 업종의 최종 결정인지를 여기서도 함께 읽는다(카드 CTA · 강조색 근거). */
  const candidates = useMyCandidates();

  // 두 곳이 안 되면 서버를 부를 것도 없다.
  const tooFew = (ids ?? '').split(',').filter(Boolean).length < 2;

  useEffect(() => {
    if (tooFew) return;

    compareVendors((ids ?? '').split(',').filter(Boolean))
      .then((response) => {
        setResult(response);

        /*
         * 비교했다는 사실을 남긴다(미션 ③). 화면을 실제로 연 이때가 그 사실이
         * 생기는 순간이다 — 후보를 담은 때가 아니다.
         */
        const category = response.vendors[0]?.category;
        if (!category) return;

        void getCurrentUser()
          .then((me) => (me.weddingId ? recordComparison(me.weddingId, category) : undefined))
          .catch(() => undefined);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [ids, tooFew]);

  if (tooFew || error) {
    return (
      <ErrorView
        title="비교할 수 없어요"
        message={error ?? '견줄 업체를 두 곳 이상 골라주세요.'}
        onBack={depthBack}
      />
    );
  }

  if (!result) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <DepthHeader title={HEADER_TITLE} variant="close" />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.hint}>
              <Skeleton width="72%" height={24} />
              <Skeleton width="90%" height={20} />
            </View>
            <View style={styles.loadingCards}>
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} width="100%" height={CARD_SKELETON_H} radius={Radius.pickCard} />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  /**
   * 홈 추천 비교(Pick 전 후보)에서만 쓰는 길 — 바텀 독 없이 카드 CTA에서 바로
   * Pick한다. Pick 탭 비교(이미 Pick한 후보끼리)에서는 모든 카드가 이미 Pick돼
   * 있어 이 분기를 타지 않는다.
   */
  async function pickVendor(vendor: VendorDetail) {
    if (candidates.candidateFor(vendor.id)) return;
    const outcome = await candidates.pick(vendor.id);
    if (outcome === 'picked') setPickDoneOpen(true);
    else if (outcome === 'login') {
      await savePendingAction({ kind: 'pick', vendorId: vendor.id, vendorName: vendor.name });
      router.replace('/login');
    } else setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  function goConsult(vendorId: string) {
    router.push(`/search/${vendorId}/consult`);
  }

  const vendors = result.vendors;
  const lines = vendors.map((vendor) => priceLine(vendor.prices.paidPrice, vendor.guidePrice));
  const counts = vendors.map((vendor) => vendor.prices.paidPrice.count);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);

  /*
   * 힌트 첫 줄 — 무엇이 가장 갈리는지. 가치판단(싸다·비싸다) 없이 정보량만
   * 말한다. 건수 차이가 공개 사다리 한 단(3건) 안이면 «비슷해요»다 — 한두 건
   * 차이를 갈린다고 하지 않는다. 정본 hintTitle(18/700, 한 줄 문장) 자리다.
   */
  const heroTitle = lines.some((line) => line.dim)
    ? `${TERMS.verifiedData}가 적은 곳이 섞여 있어요`
    : maxCount - minCount >= COUNT_GAP_NOTABLE
      ? `가장 크게 갈리는 건 ${TERMS.verifiedData} 건수예요`
      : `${TERMS.verifiedData} 건수는 비슷해요`;

  /* 지표 5행 — 정본 rank() 목업의 원본 제공·보정·5월 주말은 서버 값이 없어 만들어 넣지
     않는다(v3.28 대조 때 정한 실 데이터 대체: 제보 금액·실 제보·기준금액·업종·지역·출처). */
  type Cell = { value: string; best: boolean };
  const blocks: { label: string; cells: Cell[] }[] = [
    {
      label: ROW_PRICE,
      cells: lines.map((line, i) => ({
        value: line.text,
        best: !line.dim && counts[i] === maxCount,
      })),
    },
    {
      label: ROW_COUNT,
      cells: counts.map((count) => ({
        value: `${formatCount(count)}건`,
        best: count === maxCount && count > 0,
      })),
    },
    {
      label: ROW_MEDIAN,
      cells: vendors.map((vendor) => {
        const pp = vendor.prices.paidPrice;
        return pp.stage === 'detailed'
          ? { value: manwon(pp.median), best: true }
          : { value: COLLECTING_LABEL, best: false };
      }),
    },
    {
      label: ROW_CATEGORY,
      cells: vendors.map((vendor) => ({
        value: `${VENDOR_CATEGORY_LABEL[vendor.category]} · ${regionLabel(vendor.region)}`,
        best: false,
      })),
    },
    {
      label: ROW_SOURCE,
      cells: vendors.map((vendor) => ({
        value: vendor.sourceNote ?? SOURCE_FROM_DOCUMENT,
        best: false,
      })),
    },
  ];

  /* 카드별 지표 · 승수 — 정본 rank(): 「항목별 승수를 세어 가장 많이 앞선 카드를 위에 둔다」. */
  const cards = vendors.map((vendor, i) => {
    const metrics = blocks.map((block) => ({ label: block.label, ...block.cells[i]! }));
    const winCount = metrics.filter((metric) => metric.best).length;
    const group = candidates.page?.groups.find((g) => g.candidates.some((c) => c.vendorId === vendor.id));
    return {
      vendor,
      metrics,
      winCount,
      picked: candidates.candidateFor(vendor.id) !== null,
      decided: group?.decidedVendorId === vendor.id,
    };
  });
  const ranked = [...cards].sort((a, b) => b.winCount - a.winCount);

  /* hint 둘째 줄 — 정본 hintText(14/400)는 서버 caveats의 첫 문장(항상 1개 이상 보장)을 쓴다.
     정본 예시 문장(«금액은 30만원 안에서 비슷해요»)은 문턱값이 없는 Figma 목업이라 지어내지 않는다. */
  const heroSub = result.caveats[0] ?? '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <DepthHeader title={HEADER_TITLE} variant="close" />

        <View style={styles.hint}>
          <ThemedText type="t5">{heroTitle}</ThemedText>
          {heroSub ? (
            <ThemedText type="f14" themeColor="textAssistive">
              {heroSub}
            </ThemedText>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.rankWrap}>
            {ranked.map((entry) => (
              <View
                key={entry.vendor.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.background,
                    borderColor: entry.decided ? theme.tint : theme.border,
                    borderWidth: entry.decided ? 1.5 : 1,
                  },
                ]}>
                <View style={styles.cardHead}>
                  <View style={styles.photoWrap}>
                    <VendorImage
                      source={entry.vendor.imageUrl ? { uri: entry.vendor.imageUrl } : undefined}
                      category={vendorImageCategory(entry.vendor.category)}
                      width={RANK_PHOTO}
                      height={RANK_PHOTO}
                      radius={Radius.medium}
                    />
                    {entry.decided ? (
                      <View style={[styles.checkDot, { backgroundColor: theme.tint }]}>
                        <ProductSymbol name="check" size={Layout.iconMicro} color={theme.onTint} />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.nameCol}>
                    <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
                      {entry.vendor.name}
                    </ThemedText>
                    <ThemedText type="f11" themeColor="textAssistive">
                      {VENDOR_CATEGORY_LABEL[entry.vendor.category]}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.winBadge,
                      { backgroundColor: entry.decided ? theme.tint : theme.backgroundSelected },
                    ]}>
                    <ThemedText
                      type="f12"
                      numberOfLines={1}
                      themeColor={entry.decided ? 'onTint' : 'textSecondary'}
                      style={styles.bold}>
                      {entry.winCount}개 앞서요
                    </ThemedText>
                  </View>
                </View>

                <View style={[styles.metrics, { backgroundColor: theme.backgroundElement }]}>
                  {entry.metrics.map((metric) => (
                    <View key={metric.label} style={styles.metricRow}>
                      <ThemedText type="f12" themeColor="textAssistive" style={styles.metricLabel}>
                        {metric.label}
                      </ThemedText>
                      <ThemedText
                        type="f13"
                        numeric
                        numberOfLines={2}
                        themeColor={metric.best ? 'text' : 'textAssistive'}
                        style={[styles.metricValue, metric.best ? styles.bold : null]}>
                        {metric.value}
                      </ThemedText>
                      {metric.best ? (
                        <View style={[styles.bestDot, { backgroundColor: theme.tint }]} />
                      ) : (
                        <View style={styles.bestDotSpacer} />
                      )}
                    </View>
                  ))}
                </View>

                {entry.picked ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.vendor.name} ${CTA_CONSULT}`}
                    onPress={() => goConsult(entry.vendor.id)}
                    style={({ pressed }) => [
                      styles.cta,
                      {
                        backgroundColor: entry.decided ? theme.tint : theme.backgroundSelected,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <ThemedText type="f14" themeColor={entry.decided ? 'onTint' : 'text'} style={styles.bold}>
                      {CTA_CONSULT}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.vendor.name} ${TERMS.pick}`}
                    disabled={candidates.busyVendorId === entry.vendor.id}
                    onPress={() => void pickVendor(entry.vendor)}
                    style={({ pressed }) => [
                      styles.cta,
                      styles.ctaGhost,
                      { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                    ]}>
                    <ThemedText type="f14" style={styles.bold}>
                      {candidates.busyVendorId === entry.vendor.id ? '담는 중…' : TERMS.pick}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* 밴드 → 웨딩픽 요약 — 정본엔 없지만 caveats 전문은 법적/신뢰 고지라 유지한다. */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.summary}>
            <ThemedText type="t4">웨딩픽 요약</ThemedText>
            <View style={styles.summaryList}>
              {result.caveats.map((caveat) => (
                <View key={caveat} style={styles.summaryRow}>
                  <View style={[styles.bullet, { backgroundColor: theme.tint }]} />
                  <ThemedText type="body" themeColor="textStrong" style={styles.summaryText}>{caveat}</ThemedText>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
      <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
    </ThemedView>
  );
}

/* 정본 rankPhotoWrap — 사진 72×72 radius10. Layout 사다리에 72가 없다(가장 가까운 값은
   avatarLarge 88). */
const RANK_PHOTO = 72;
/* 정본 rankWrap padding 16 20 24 — Layout.gutter(24)와 다른 좌우 20이라 로컬 값. */
const RANK_WRAP_PAD_X = 20;
const RANK_WRAP_PAD_TOP = 16;
const RANK_WRAP_PAD_BOTTOM = 24;
/* 정본 winBadge height 26 · padding 0 10 — Layout.badgeHeight(22)와 다른 값. */
const WIN_BADGE_H = 26;
const WIN_BADGE_PAD_X = 10;
/* 정본 rankMetrics background REC · radius 8 · padding 4 12 — Radius 사다리에 8이 없다. */
const METRICS_RADIUS = 8;
const METRICS_PAD_Y = 4;
/* 정본 rankMRow min-height 36 — Layout 사다리에 없는 값(controlMedium 40과 다르다). */
const METRIC_ROW_H = 36;
/* 정본 rankMLabel flex:0 0 68px. */
const METRIC_LABEL_W = 68;
/* 카드 스켈레톤 — 사진72 + 이름줄 + 지표3줄 + CTA44 정도의 어림 높이. */
const CARD_SKELETON_H = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  bold: { fontWeight: 700 },

  /* 정본 hint — padding 16 24 · gap 4 · border-bottom 1. */
  hint: {
    paddingTop: Spacing.three,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Spacing.half,
  },

  loadingCards: { paddingHorizontal: Layout.gutter, gap: Layout.sectionHeadGap },

  /* 정본 rankWrap — padding 16 20 24 · gap 14(Layout.sectionHeadGap). */
  rankWrap: {
    paddingTop: RANK_WRAP_PAD_TOP,
    paddingHorizontal: RANK_WRAP_PAD_X,
    paddingBottom: RANK_WRAP_PAD_BOTTOM,
    gap: Layout.sectionHeadGap,
  },

  /* 정본 cardStyle — radius 14(Radius.pickCard) · padding 16(Spacing.three) · gap 12(Layout.inlineGap). */
  card: {
    borderRadius: Radius.pickCard,
    padding: Spacing.three,
    gap: Layout.inlineGap,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap },
  photoWrap: { position: 'relative' },
  checkDot: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
    width: Layout.badgeHeight,
    height: Layout.badgeHeight,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCol: { flex: 1, minWidth: 0, gap: Layout.rowGap },
  winBadge: {
    height: WIN_BADGE_H,
    paddingHorizontal: WIN_BADGE_PAD_X,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 정본 rankMetrics — background REC · radius 8 · padding 4 12(Layout.inlineGap). */
  metrics: {
    borderRadius: METRICS_RADIUS,
    paddingVertical: METRICS_PAD_Y,
    paddingHorizontal: Layout.inlineGap,
  },
  metricRow: {
    minHeight: METRIC_ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metricLabel: { width: METRIC_LABEL_W, flexShrink: 0 },
  metricValue: { flex: 1, textAlign: 'right' },
  bestDot: {
    width: Layout.bulletDot,
    height: Layout.bulletDot,
    borderRadius: Radius.pill,
  },
  bestDotSpacer: { width: Layout.bulletDot },

  /* 정본 카드 cta — height 44(Layout.ctaInCard) · radius 6(Radius.input). */
  cta: {
    height: Layout.ctaInCard,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhost: { borderWidth: 1 },

  /* 밴드 16 · margin 4 0 28 */
  band: { height: Layout.sectionBand, marginTop: Spacing.one, marginBottom: Layout.sectionGap },
  summary: { paddingHorizontal: Layout.gutter, gap: Layout.sectionHeadGap },
  summaryList: { gap: Layout.rowPaddingY },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Layout.cardGap },
  bullet: {
    width: Layout.bulletDot,
    height: Layout.bulletDot,
    borderRadius: Radius.pill,
    marginTop: (Spacing.four - Layout.bulletDot) / 2,
    flexShrink: 0,
  },
  summaryText: { flex: 1 },
  bottomPad: { height: Spacing.four },
});
