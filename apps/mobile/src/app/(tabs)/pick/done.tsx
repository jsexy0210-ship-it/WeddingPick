import { VENDOR_CATEGORY_LABEL, withInstrument, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUser } from '@/api/client';
import {
  Layout,
  MaxContentWidth,
  Motion,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';

/**
 * 결정 완료 · WP-PICK-006. 시안 07-pick.dc.html #17d · 09-core-loop.dc.html #10e.
 *
 *   머리     padding 64 24 40 · 가운데 · gap 24 — 체크 원 72(coral · Pick Mark 36 white) + 링
 *   제목     26 «스튜디오 준비 완료» + 16/24 «강남 A 스튜디오로 결정했어요»
 *   반영 카드 bg gray50 · radius 10 · padding 18 20 · 라벨 14 gray / 글 18 700 / chevron — 웨딩일정 · 지출
 *   다음 준비 brand 카드 — v3.24 «지출을 넣어두시겠어요?» + CTA 52 «지출 넣기»(화면의 유일한 coral CTA · tokens size.ctaPrimary)
 *   «홈으로»  16 700 gray · 가운데
 *
 * 모션(SPEC §13.2 · tokens.json motion.*):
 *   1. 체크 원  scale 0 → 1.18 → 1 · 460ms · cubic-bezier(.34,1.56,.64,1)   checkPop
 *   2. 링 확산  scale .5 opacity .45 → scale 2.4 opacity 0 · 1000ms · (.16,1,.3,1)  ringSpread
 *   3. 제목     translateY 10 → 0 · opacity 0 → 1 · 420ms · delay 150         rise
 *   4. 반영 카드 같은 모션 · delay 260
 *   5. 다음 준비 같은 모션 · delay 380
 *
 * **결정 직후가 지출을 넣을 때다(SPEC §13.10 · CHANGELOG v3.24).** 지출 카드가 WP-OUR-014로 보낸다 —
 * 그 순간이 사용자가 금액을 기억하고 있는 유일한 때다.
 */
export default function PickDoneScreen() {
  const theme = useTheme();
  const { category, vendorName } = useLocalSearchParams<{
    category: string;
    vendorName: string;
  }>();

  const categoryLabel = VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? category ?? '';
  const vendor = vendorName ?? '';

  /** 지출 추가 화면이 웨딩 id를 경로에 쓴다. 없으면(아직 못 읽었으면) 누를 때 한 번 더 읽는다. */
  const [weddingId, setWeddingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getCurrentUser()
      .then((me) => {
        if (alive) setWeddingId(me.weddingId ?? null);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  async function goAddExpense() {
    const target = weddingId ?? (await getCurrentUser().then((me) => me.weddingId ?? null).catch(() => null));

    if (!target) {
      router.replace('/');

      return;
    }

    router.push({
      pathname: `/wedding/${target}/expenses/add`,
      params: {
        ...(vendor ? { vendorName: vendor } : {}),
        ...(category ? { category } : {}),
      },
    } as never);
  }

  // ── 애니메이션 값 — useMemo로 생성해 렌더 중 ref 접근을 피한다 ──────
  const markScale = useMemo(() => new Animated.Value(0), []);
  const ringScale = useMemo(() => new Animated.Value(RING_FROM_SCALE), []);
  const ringOpacity = useMemo(() => new Animated.Value(RING_FROM_OPACITY), []);
  const riseY = useMemo(() => RISE_DELAYS.map(() => new Animated.Value(Motion.rise.from)), []);
  const riseOpacity = useMemo(() => RISE_DELAYS.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    // 1. checkPop
    Animated.timing(markScale, {
      toValue: 1,
      duration: Motion.checkPop.duration,
      easing: Easing.bezier(...Motion.checkPop.bezier),
      useNativeDriver: true,
    }).start();

    // 2. ringSpread — 마크와 동시에 시작
    Animated.parallel([
      Animated.timing(ringScale, {
        toValue: RING_TO_SCALE,
        duration: RING_DURATION,
        easing: Easing.bezier(...Motion.ringSpread.bezier),
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: RING_DURATION,
        easing: Easing.bezier(...Motion.ringSpread.bezier),
        useNativeDriver: true,
      }),
    ]).start();

    // 3~5. rise — 제목 150 · 반영 카드 260 · 다음 준비 380
    RISE_DELAYS.forEach((delay, i) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(riseY[i]!, {
            toValue: 0,
            duration: Motion.rise.duration,
            easing: Easing.bezier(...Motion.sheetEnter.bezier),
            useNativeDriver: true,
          }),
          Animated.timing(riseOpacity[i]!, {
            toValue: 1,
            duration: Motion.rise.duration,
            easing: Easing.bezier(...Motion.sheetEnter.bezier),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, [markScale, ringOpacity, ringScale, riseOpacity, riseY]);

  const rise = (i: number) => ({ transform: [{ translateY: riseY[i]! }], opacity: riseOpacity[i]! });

  // ── 반영 카드 — 무엇이 자동으로 반영됐는지. 있는 사실만 적는다. ────
  const reflected = [
    {
      key: 'wedding',
      label: '웨딩일정',
      text: `준비 현황에 ${categoryLabel} 결정 완료로 반영됐어요`,
      onPress: () => router.replace('/wedding'),
    },
    {
      key: 'expense',
      label: '지출',
      text: 'Pick 인증하면 지출에 연결돼요',
      onPress: () => void goAddExpense(),
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {/* ── 1·2. 체크 원 72 + 링 · 3. 제목 ─────────────────── */}
          <View style={styles.head}>
            <View style={styles.markArea}>
              <Animated.View
                style={[
                  styles.ring,
                  { backgroundColor: theme.tint, transform: [{ scale: ringScale }], opacity: ringOpacity },
                ]}
              />
              <Animated.View
                style={[styles.markWrap, { backgroundColor: theme.tint, transform: [{ scale: markScale }] }]}>
                <WeddingMark size={MARK_ICON} color={theme.onTint} />
              </Animated.View>
            </View>
            <Animated.View style={[styles.titleBlock, rise(0)]}>
              <ThemedText type="t2" style={styles.center}>{categoryLabel} 준비 완료</ThemedText>
              {vendor ? (
                <ThemedText type="body" themeColor="textSecondary" style={styles.center}>
                  {withInstrument(vendor)} 결정했어요
                </ThemedText>
              ) : null}
            </Animated.View>
          </View>

          {/* ── 4. 반영 카드 ──────────────────────────────── */}
          <Animated.View style={[styles.cards, rise(1)]}>
            {reflected.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`${item.label} · ${item.text}`}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
                ]}>
                <View style={styles.cardBody}>
                  <ThemedText type="t7" themeColor="textAssistive">{item.label}</ThemedText>
                  <ThemedText type="t5">{item.text}</ThemedText>
                </View>
                <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
              </Pressable>
            ))}
          </Animated.View>

          {/* ── 5. 다음 준비 — 지출 넣기(WP-OUR-014). 화면의 유일한 coral CTA. ── */}
          <Animated.View style={[styles.next, rise(2)]}>
            <View style={[styles.nextBox, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
              <View style={styles.nextText}>
                <ThemedText type="t7" themeColor="tint" style={styles.bold}>다음 준비 · 지출</ThemedText>
                <ThemedText type="t5">지출을 넣어두시겠어요? 금액을 기억하는 지금이 가장 정확해요</ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="지출 넣기"
                onPress={() => void goAddExpense()}
                style={({ pressed }) => [styles.cta, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
                <ThemedText type="t5" themeColor="onTint">지출 넣기</ThemedText>
              </Pressable>
            </View>
          </Animated.View>

          {/* ── 홈으로 — 보조 ───────────────────────────────── */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="홈으로"
            onPress={() => router.replace('/')}
            style={styles.homeLink}>
            <ThemedText type="t6" themeColor="textAssistive" style={styles.bold}>홈으로</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 시안 doneMark 72 · 안의 마크 36 · 링은 같은 원이 .5 → 2.4로 퍼진다(tokens.json motion.ringSpread). */
const MARK_SIZE = 72;
const MARK_ICON = 36;
const RING_FROM_SCALE = 0.5;
const RING_TO_SCALE = 2.4;
const RING_FROM_OPACITY = 0.45;
const RING_DURATION = Motion.ringSpread.duration;
/** rise 딜레이 — 제목 150 · 반영 카드 260 · 다음 준비 380(SPEC §13.2 · Motion.rise.delays). */
const RISE_DELAYS = Motion.rise.delays;
/** 시안: 머리 padding 64 24 40. */
const HEAD_PAD_TOP = 64;
const HEAD_PAD_BOTTOM = 40;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scroll: {
    paddingBottom: Spacing.five,
  },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },

  head: {
    paddingTop: HEAD_PAD_TOP,
    paddingHorizontal: Layout.gutter,
    paddingBottom: HEAD_PAD_BOTTOM,
    alignItems: 'center',
    gap: Spacing.four,
  },
  markArea: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: Radius.pill,
  },
  markWrap: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { gap: Spacing.two, alignItems: 'center' },

  /* 반영 카드 · padding 0 24 · 카드 사이 12 · 카드 padding 18 20 · gap 14 */
  cards: { paddingHorizontal: Layout.gutter, gap: Layout.rowPaddingY },
  card: {
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three + Spacing.half,
    paddingHorizontal: Layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
  },
  cardBody: { flex: 1, minWidth: 0, gap: Spacing.half + 1 },

  /* 다음 준비 · padding 28 24 0 · 카드 radius 10 · 테두리 1 · padding 20 · gap 14 */
  next: { paddingTop: Layout.sectionGap, paddingHorizontal: Layout.gutter },
  nextBox: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  nextText: { gap: Spacing.one + Spacing.half },
  cta: {
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 홈으로 · padding 20 24 32 · 가운데 */
  homeLink: {
    paddingTop: Layout.cardPadding,
    paddingBottom: Spacing.five,
    minHeight: Layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
