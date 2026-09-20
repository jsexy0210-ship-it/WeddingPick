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
import { PickSectionTabs } from '@/features/pick/pick-section-tabs';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import strings from '../../../../../../spec/strings.ko.json';
import {
  ErrorView,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
  SkeletonView,
  VendorImage,
} from '@weddingpick/ui';

/**
 * 비교 결과 · WP-CMP-002. 2026-09-14 대표 지시로 **표 형태**로 바꿨다
 * (피그마 `Pick.tsx` `CompareScreen`, 98행 — B등급이라 색·문구는 옮기지 않고
 * 구조만 가져온다). 이전 판단("좁은 화면에 표는 아무것도 안 읽힌다")은 지웠다.
 *
 * 좁은 화면에서 표가 읽히는 이유 — **라벨열을 고정하고 업체열만 가로로 민다.**
 * 세로로 길어지면 헤더(업체 사진·이름)가 위로 사라지므로, 라벨열은 왼쪽에
 * 고정된 채 화면 전체가 세로로 함께 스크롤되고 업체열만 별도로 가로 스크롤된다
 * — RN에서 두 방향 sticky는 안정적이지 않아, 고정열(왼쪽) + 가로 스크롤열(오른쪽)을
 * 나란히 둔 뒤 그 둘을 하나의 세로 ScrollView로 감싸는 방식을 쓴다.
 *
 * 단서(caveats)는 서버가 결과와 함께 내려준다 — 표만 그리고 «금액만으로는
 * 비교할 수 없다»는 말을 빠뜨리면 우리가 만든 표가 오해를 부추긴다.
 *
 * 값은 우세한 쪽만 #212124(text), 나머지는 #393a40(textStrong)이다. 금액이 없는 쪽(0층·1층)은 회색.
 * 웨딩픽은 비싸다 싸다를 판정하지 않는다 — 우세는 «정보가 더 있다»(실 제보 건수)로만 가른다.
 * BEST 배지는 그 우세(tone==='text') 칸에만 붙는다.
 */
const KEY_LETTERS = 'ABCDE';

/** 건수 차이가 이만큼(공개 사다리 한 단 · DISCLOSURE_THRESHOLDS.limited) 이상이면 «갈린다»고 말한다. */
const COUNT_GAP_NOTABLE = DISCLOSURE_THRESHOLDS.limited;

/** 문구. spec/strings.ko.json compare.* */
const BEST_BADGE = strings.compare.best;
const SUMMARY_TITLE = '웨딩픽 요약';
const ROW_PRICE = '제보 금액';
const ROW_MEDIAN = TERMS.baseAmount;
const ROW_COUNT = TERMS.verifiedData;
const ROW_CATEGORY = '업종 · 지역';
const ROW_SOURCE = '업체 정보 출처';
const SOURCE_FROM_DOCUMENT = '올려주신 문서에서 확인한 업체예요';

export default function CompareScreen() {
  const depthBack = useDepthBack();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const theme = useTheme();
  const [result, setResult] = useState<VendorComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  /* Pick 전·후 — 검색 카드 · 업체 상세와 같은 후보 목록을 본다. */
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
    return <SkeletonView />;
  }

  /**
   * 바텀 독에서 Pick(SPEC §13.1). 세션이 사라지면 pending Pick만 남기고 로그인으로 복귀한다.
   * 비교 화면 안에 별도 로그인 UI를 겹쳐 띄우지 않는다.
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

  const vendors = result.vendors;
  const categoryLabel = VENDOR_CATEGORY_LABEL[vendors[0]!.category];
  const lines = vendors.map((vendor) => priceLine(vendor.prices.paidPrice, vendor.guidePrice));
  const counts = vendors.map((vendor) => vendor.prices.paidPrice.count);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);

  /*
   * 결론 한 줄 — 무엇이 가장 갈리는지. 가치판단(싸다·비싸다) 없이 정보량만 말한다.
   * 건수 차이가 공개 사다리 한 단(3건) 안이면 «비슷해요»다 — 한두 건 차이를 갈린다고 하지 않는다.
   */
  const hero = lines.some((line) => line.dim)
    ? `${TERMS.verifiedData}가 적은 곳이\n섞여 있어요`
    : maxCount - minCount >= COUNT_GAP_NOTABLE
      ? `가장 크게 갈리는 건\n${TERMS.verifiedData} 건수예요`
      : `${TERMS.verifiedData} 건수는\n비슷해요`;

  const keyTones = [
    theme.backgroundInk,
    theme.textStrong,
    theme.textAssistive,
    theme.tint,
    theme.textDisabled,
  ] as const;

  /** 속성 블록 한 줄의 값. tone: 우세(text) · 보통(textStrong) · 없음(textAssistive). */
  type Cell = { value: string; tone: 'text' | 'textStrong' | 'textAssistive' };
  const blocks: { label: string; cells: Cell[] }[] = [
    {
      label: ROW_PRICE,
      cells: lines.map((line, i) => ({
        value: line.text,
        tone: line.dim ? 'textAssistive' : counts[i] === maxCount ? 'text' : 'textStrong',
      })),
    },
    {
      label: ROW_MEDIAN,
      cells: vendors.map((vendor) => {
        const pp = vendor.prices.paidPrice;
        return pp.stage === 'detailed'
          ? { value: manwon(pp.median), tone: 'text' as const }
          : { value: COLLECTING_LABEL, tone: 'textAssistive' as const };
      }),
    },
    {
      label: ROW_COUNT,
      cells: counts.map((count) => ({
        value: `${formatCount(count)}건`,
        tone: count === maxCount && count > 0 ? 'text' : count === 0 ? 'textAssistive' : 'textStrong',
      })),
    },
    {
      label: ROW_CATEGORY,
      cells: vendors.map((vendor) => ({
        value: `${VENDOR_CATEGORY_LABEL[vendor.category]} · ${regionLabel(vendor.region)}`,
        tone: 'textStrong' as const,
      })),
    },
    {
      label: ROW_SOURCE,
      cells: vendors.map((vendor) => ({
        value: vendor.sourceNote ?? SOURCE_FROM_DOCUMENT,
        tone: 'textStrong' as const,
      })),
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <PickSectionTabs active="compare" />
        <DepthHeader title={`${categoryLabel} ${vendors.length}곳 비교`} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* hero · padding 12 24 24 · gap 14 · 후보 칩 3 */}
          <View style={styles.hero}>
            <ThemedText type="t2">{hero}</ThemedText>
            <View style={styles.chips}>
              {vendors.map((vendor, i) => (
                <View key={vendor.id} style={[styles.chip, { backgroundColor: keyTones[i] }]}>
                  <ThemedText type="t7" numberOfLines={1} style={[styles.bold, { color: theme.onTint }]}>
                    {KEY_LETTERS[i]} {vendor.name}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/*
            표 — 라벨열(왼쪽, 고정) + 업체열(오른쪽, 가로 스크롤). 둘 다 이 화면의 세로
            ScrollView 한 장 안에 있어 위아래로는 함께 움직이고, 좌우로는 업체열만 민다.
          */}
          <View style={styles.tableWrap}>
            <View style={styles.tableLabelCol}>
              {/* 업체 사진 헤더 행 자리를 라벨열에도 비워 둔다 — 안 비우면 첫 데이터 행이 사진과 나란해진다. */}
              <View style={styles.tableHeaderSpacer} />
              {blocks.map((block) => (
                <View key={block.label} style={[styles.tableRow, { borderBottomColor: theme.border }]}>
                  <ThemedText type="t7" themeColor="textSecondary" numberOfLines={3} style={styles.bold}>
                    {block.label}
                  </ThemedText>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* 업체 사진 · 키 · 이름 헤더 행 */}
                <View style={styles.tableHeaderRow}>
                  {vendors.map((vendor, i) => (
                    <View key={vendor.id} style={styles.tableCol}>
                      <View style={styles.tableThumbWrap}>
                        <VendorImage
                          source={vendor.imageUrl ? { uri: vendor.imageUrl } : undefined}
                          category={vendorImageCategory(vendor.category)}
                          width={COL_W}
                          height={COL_THUMB_H}
                          radius={Radius.medium}
                        />
                        <View style={[styles.keyChip, styles.tableThumbKey, { backgroundColor: keyTones[i] }]}>
                          <ThemedText type="t7" style={[styles.bold, { color: theme.onTint }]}>
                            {KEY_LETTERS[i]}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText type="t7" numberOfLines={1} style={styles.bold}>
                        {vendor.name}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {/* 데이터 행 — 항목마다 업체 수만큼 열 */}
                {blocks.map((block) => (
                  <View key={block.label} style={[styles.tableRow, { borderBottomColor: theme.border }]}>
                    {block.cells.map((cell, i) => (
                      <View key={vendors[i]!.id} style={styles.tableCol}>
                        <ThemedText
                          type="t6"
                          numeric
                          numberOfLines={3}
                          themeColor={cell.tone}
                          style={[styles.bold, styles.tableCellText]}>
                          {cell.value}
                        </ThemedText>
                        {/*
                          우세 배지 — 정보가 더 있다(실 제보 건수)는 뜻이지 값을 평가하지 않는다.
                          2026-09-15 대표 지시 「이딴 영문 싹다 없애」로 `BEST`를 한국어로 바꿨다.
                          문구는 `spec/strings.ko.json` `compare.best`다.
                        */}
                        {cell.tone === 'text' ? (
                          <View style={[styles.bestBadge, { backgroundColor: theme.tintSurface }]}>
                            <ThemedText type="micro" themeColor="tint" style={styles.bold}>
                              {BEST_BADGE}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* 밴드 → 웨딩픽 요약 — 단서는 서버가 준다 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.summary}>
            <ThemedText type="t4">{SUMMARY_TITLE}</ThemedText>
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

        {/* dock 92 — 후보별 Pick 버튼 3 · 56. 전: 흰 바탕 테두리 «A Pick» · 후: coral «A Pick했어요»(SPEC §13.1) */}
        <ThemedView style={[styles.dock, { borderTopColor: theme.border }]}>
          {vendors.map((vendor, i) => {
            const picked = candidates.candidateFor(vendor.id) !== null;
            const busy = candidates.busyVendorId === vendor.id;
            return (
              <Pressable
                key={vendor.id}
                accessibilityRole="button"
                accessibilityLabel={picked ? `${vendor.name} Pick했어요` : `${vendor.name} Pick하기`}
                accessibilityState={{ disabled: picked || busy }}
                disabled={picked || busy}
                onPress={() => void pickVendor(vendor)}
                style={({ pressed }) => [
                  styles.dockBtn,
                  picked
                    ? { backgroundColor: theme.tint }
                    : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.track },
                  pressed ? styles.pressed : null,
                  busy ? styles.busy : null,
                ]}>
                <ThemedText type="t6" numberOfLines={1} themeColor={picked ? 'onTint' : 'text'} style={styles.bold}>
                  {busy ? '담는 중…' : picked ? `${KEY_LETTERS[i]} ${TERMS.pick}했어요` : `${KEY_LETTERS[i]} ${TERMS.pick}`}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
      <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
    </ThemedView>
  );
}

/*
 * 시안 #10b — 후보 칩 36(component.chip.height) · 키 칩 22(component.badge.height) ·
 * 행 48(size.rowMinHeightCompact) · 목록 앞 점 6(spacing.bulletDot). 전부 토큰에 이름이 있다.
 */
const CAND_CHIP_HEIGHT = Layout.chip;
const KEY_CHIP = Layout.badgeHeight;
const ROW_HEIGHT = Layout.rowMinHeightCompact;
const BULLET = Layout.bulletDot;

/*
 * 표 칸 치수 — 토큰 사다리에 없는 이 화면 전용 로컬 값이다(디자인 정본 아님,
 * search/index.tsx의 CARD_IMAGE_HEIGHT와 같은 성격). 라벨열은 "제보 금액" 같은
 * 네 글자가 한 줄로, "업체 정보 출처"가 두 줄로 들어가는 폭이고, 업체열은 사진 +
 * 이름 한 줄 + 값 두 줄이 들어가는 폭이다.
 */
const LABEL_W = 88;
const COL_W = 118;
const COL_THUMB_H = 82;
const HEADER_ROW_H = COL_THUMB_H + Spacing.half + LineHeight.t7 + Spacing.two * 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  bold: { fontWeight: 700 },
  pressed: { transform: [{ scale: 0.98 }] },
  busy: { opacity: 0.6 },

  /* nav 56 · padding 0 20 0 12 · gap 4 */
  navBar: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.navPaddingRight,
  },
  navTitle: { flex: 1, minWidth: 0 },

  /* hero · padding 12 24 24 · gap 14 */
  hero: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.sectionHeadGap,
  },
  chips: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    flex: 1,
    minWidth: 0,
    height: CAND_CHIP_HEIGHT,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.rowPaddingY,
  },

  /* 표 — 라벨열(고정) + 업체열(가로 스크롤). 둘 다 padding 0 24. */
  tableWrap: { flexDirection: 'row', paddingLeft: Layout.gutter },
  tableLabelCol: { width: LABEL_W, flexShrink: 0 },
  tableHeaderSpacer: { height: HEADER_ROW_H },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: Spacing.two, paddingRight: Layout.gutter },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_HEIGHT,
    paddingVertical: Spacing.two,
    paddingRight: Layout.gutter,
    borderBottomWidth: 1,
  },
  tableCol: { width: COL_W, paddingRight: Spacing.two, justifyContent: 'center' },
  tableThumbWrap: { position: 'relative', marginBottom: Spacing.half },
  tableThumbKey: { position: 'absolute', top: 6, left: 6 },
  tableCellText: {},
  bestBadge: {
    marginTop: 3,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  keyChip: {
    width: KEY_CHIP,
    height: KEY_CHIP,
    borderRadius: Radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },

  /* 밴드 16 · margin 4 0 28 */
  band: { height: Layout.sectionBand, marginTop: Spacing.one, marginBottom: Layout.sectionGap },
  summary: { paddingHorizontal: Layout.gutter, gap: Layout.sectionHeadGap },
  summaryList: { gap: Layout.rowPaddingY },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Layout.cardGap },
  bullet: { width: BULLET, height: BULLET, borderRadius: Radius.pill, marginTop: (Spacing.four - BULLET) / 2, flexShrink: 0 },
  summaryText: { flex: 1 },
  bottomPad: { height: Spacing.four },

  /* dock 92 · border-top 1 · padding 12 24 · gap 8 · 버튼 56 */
  dock: {
    height: Layout.dock,
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dockBtn: {
    /*
     * 비교 dock의 버튼도 Pick CTA다 — 09-core-loop의 `flex:0 0 92px; padding:12px 24px;
     * gap:8px` dock 안 버튼이 `height:56px`이고, tokens.json이 그 자리를
     * `size.ctaPick`으로 이름 붙였다(「업체 상세·비교의 Pick CTA 전용」).
     */
    flex: 1,
    height: Layout.ctaPick,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
