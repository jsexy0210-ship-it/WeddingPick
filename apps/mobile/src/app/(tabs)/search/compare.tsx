import type { VendorComparisonResponse, VendorDetail } from '@weddingpick/api-contract';
import {
  COLLECTING_LABEL,
  DISCLOSURE_THRESHOLDS,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  manwon,
  priceLine,
  withParticle,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { compareVendors, getCurrentUser, recordComparison } from '@/api/client';
import { BackButton } from '@/components/back-button';
import { LoginSheet } from '@/features/auth/login-sheet';
import { savePendingAction } from '@/features/auth/pending-action';
import { PickDoneSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import {
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';

/**
 * 비교 결과 · WP-CMP-002. 시안 09-core-loop.dc.html #10b.
 *
 *   nav 56     뒤로 · «스튜디오 3곳 비교» 18
 *   hero       26 «가장 크게 갈리는 건 … 예요» + 후보 칩 3(A #212124 / B #393a40 / C #868b94 · 36 · pill)
 *   속성 블록   라벨 18 700 → 행 48(키 칩 22 · 이름 16 · 값 16 700 우측 기준선) — 제보 금액 · 기준금액 · 실 제보 · 업종 · 출처
 *   밴드 → «웨딩픽 요약» 20 + 단서
 *   dock 92    후보별 Pick 버튼 3 · 52(tokens size.ctaPrimary)
 *
 * 좁은 화면에 세 칸짜리 표를 그리면 아무것도 읽히지 않는다. 항목을 위에서 아래로 두고,
 * 각 항목 안에서 A·B·C를 행으로 놓는다. 단서(caveats)는 서버가 결과와 함께 내려준다 — 표만
 * 그리고 «금액만으로는 비교할 수 없다»는 말을 빠뜨리면 우리가 만든 표가 오해를 부추긴다.
 *
 * 값은 우세한 쪽만 #212124(text), 나머지는 #393a40(textStrong)이다. 금액이 없는 쪽(0층·1층)은 회색.
 * 웨딩픽은 비싸다 싸다를 판정하지 않는다 — 우세는 «정보가 더 있다»(실 제보 건수)로만 가른다.
 */
const KEYS = ['A', 'B', 'C'] as const;

/** 건수 차이가 이만큼(공개 사다리 한 단 · DISCLOSURE_THRESHOLDS.limited) 이상이면 «갈린다»고 말한다. */
const COUNT_GAP_NOTABLE = DISCLOSURE_THRESHOLDS.limited;

/** 문구. spec/strings.ko.json compare.* */
const SUMMARY_TITLE = '웨딩픽 요약';
const ROW_PRICE = '제보 금액';
const ROW_MEDIAN = TERMS.baseAmount;
const ROW_COUNT = TERMS.verifiedData;
const ROW_CATEGORY = '업종 · 지역';
const ROW_SOURCE = '업체 정보 출처';
const SOURCE_FROM_DOCUMENT = '올려주신 문서에서 확인한 업체예요';

export default function CompareScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const theme = useTheme();
  const [result, setResult] = useState<VendorComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** 로그인 전에 Pick을 눌렀을 때, 로그인 후 이어서 저장할 업체. */
  const [loginTarget, setLoginTarget] = useState<VendorDetail | null>(null);
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
        onBack={() => router.back()}
      />
    );
  }

  if (!result) {
    return <SkeletonView />;
  }

  /**
   * 바텀 독에서 Pick(SPEC §13.1). 첫 Pick이 대표 로그인 트리거다 — 로그인 전이면 누른 것을
   * 적어두고 시트를 연다. 업체상세와 같은 흐름.
   */
  async function pickVendor(vendor: VendorDetail) {
    if (candidates.candidateFor(vendor.id)) return;
    const outcome = await candidates.pick(vendor.id);
    if (outcome === 'picked') setPickDoneOpen(true);
    else if (outcome === 'login') {
      await savePendingAction({ kind: 'pick', vendorId: vendor.id, vendorName: vendor.name });
      setLoginTarget(vendor);
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

  const keyTones = [theme.backgroundInk, theme.textStrong, theme.textAssistive] as const;

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
        value: `${count}건`,
        tone: count === maxCount && count > 0 ? 'text' : count === 0 ? 'textAssistive' : 'textStrong',
      })),
    },
    {
      label: ROW_CATEGORY,
      cells: vendors.map((vendor) => ({
        value: `${VENDOR_CATEGORY_LABEL[vendor.category]} · ${vendor.region}`,
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
        {/* nav 56 · 뒤로 + «스튜디오 3곳 비교» */}
        <View style={styles.navBar}>
          <BackButton />
          <ThemedText type="t5" numberOfLines={1} style={styles.navTitle}>
            {categoryLabel} {vendors.length}곳 비교
          </ThemedText>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* hero · padding 12 24 24 · gap 14 · 후보 칩 3 */}
          <View style={styles.hero}>
            <ThemedText type="t2">{hero}</ThemedText>
            <View style={styles.chips}>
              {vendors.map((vendor, i) => (
                <View key={vendor.id} style={[styles.chip, { backgroundColor: keyTones[i] }]}>
                  <ThemedText type="t7" numberOfLines={1} style={[styles.bold, { color: theme.onTint }]}>
                    {KEYS[i]} {vendor.name}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* 속성 블록 · padding 0 24 24 · 라벨→행 10 · 행 48 · 키 칩 22 */}
          {blocks.map((block) => (
            <View key={block.label} style={styles.block}>
              <ThemedText type="t5">{block.label}</ThemedText>
              <View style={styles.rows}>
                {block.cells.map((cell, i) => (
                  <View key={vendors[i]!.id}>
                    <View style={styles.row}>
                      <View style={[styles.keyChip, { backgroundColor: keyTones[i] }]}>
                        <ThemedText type="t7" style={[styles.bold, { color: theme.onTint }]}>{KEYS[i]}</ThemedText>
                      </View>
                      <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1} style={styles.rowName}>
                        {vendors[i]!.name}
                      </ThemedText>
                      <ThemedText
                        type="t6"
                        numeric
                        numberOfLines={2}
                        themeColor={cell.tone}
                        style={[styles.bold, styles.rowValue]}>
                        {cell.value}
                      </ThemedText>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  </View>
                ))}
              </View>
            </View>
          ))}

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
                  {busy ? '담는 중…' : picked ? `${KEYS[i]} ${TERMS.pick}했어요` : `${KEYS[i]} ${TERMS.pick}`}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
      <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
      <LoginSheet
        visible={loginTarget !== null}
        reason={
          loginTarget ? `로그인하면 ${withParticle(loginTarget.name, '을를')} 바로 Pick해드려요.` : ''
        }
        onSignedIn={(outcome) => {
          setLoginTarget(null);

          if (outcome.needsSignup) {
            router.push('/setup');
            return;
          }

          candidates.reload().catch(() => undefined);
          if (outcome.completed) setPickDoneOpen(true);
          else if (outcome.weddingError) setToast(outcome.weddingError);
        }}
        onDismiss={() => setLoginTarget(null)}
      />
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

  /* 속성 블록 · padding 0 24 24 · gap 10 */
  block: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.cardGap,
  },
  rows: { gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: ROW_HEIGHT,
    paddingVertical: Spacing.two,
  },
  keyChip: {
    width: KEY_CHIP,
    height: KEY_CHIP,
    borderRadius: Radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, minWidth: 0 },
  rowValue: { flexShrink: 1, maxWidth: '55%', textAlign: 'right' },
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
    flex: 1,
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
