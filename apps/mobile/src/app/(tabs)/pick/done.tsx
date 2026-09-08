import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUser } from '@/api/client';
import {
  ActionButton,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';

/**
 * 결정 완료 축하 화면. WP-PICK-006.
 *
 * confirm.tsx(WP-PICK-005)가 decideCategory 성공 후 navigate 한다.
 *
 * 애니메이션 순서 (CLAUDE.md §7):
 * 1. checkPop  — scale 0→1.18→1, 460ms, cubic-bezier(.34,1.56,.64,1)
 * 2. ringSpread — 체크 링 뒤 원형 scale 1→2.5 & opacity 1→0, 600ms
 * 3. rise×3    — 반영 3건 각각 translateY 10→0 & opacity 0→1, 420ms,
 *               cubic-bezier(.16,1,.3,1), 200/320/440ms 딜레이로 순차 등장
 *
 * **결정 직후가 지출을 넣을 때다(v3.22 SPEC 13.10).** 반영 3건 아래에 «지출을
 * 넣어두시겠어요?» 카드를 두고 WP-OUR-014로 보낸다 — 그 순간이 사용자가 금액을
 * 기억하고 있는 유일한 때다. 화면의 coral Primary는 이 «지출 넣기» 하나이고
 * «홈으로»는 보조다.
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
  const ringScale = useMemo(() => new Animated.Value(1), []);
  const ringOpacity = useMemo(() => new Animated.Value(0), []);

  const riseY0 = useMemo(() => new Animated.Value(10), []);
  const riseY1 = useMemo(() => new Animated.Value(10), []);
  const riseY2 = useMemo(() => new Animated.Value(10), []);
  const riseOp0 = useMemo(() => new Animated.Value(0), []);
  const riseOp1 = useMemo(() => new Animated.Value(0), []);
  const riseOp2 = useMemo(() => new Animated.Value(0), []);
  const riseY = useMemo(() => [riseY0, riseY1, riseY2], [riseY0, riseY1, riseY2]);
  const riseOpacity = useMemo(() => [riseOp0, riseOp1, riseOp2], [riseOp0, riseOp1, riseOp2]);

  useEffect(() => {
    // 1. checkPop — 460ms, cubic-bezier(.34,1.56,.64,1) (CLAUDE.md §7)
    // 단일 timing으로 구현: bezier의 Y값이 1을 넘어 자연스러운 overshoot을 만든다.
    Animated.timing(markScale, {
      toValue: 1,
      duration: 460,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start();

    // ringSpread — 마크와 동시에 시작, 페이드아웃과 확장
    Animated.sequence([
      Animated.timing(ringOpacity, {
        toValue: 0.35,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2.5,
          duration: 540,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 540,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 2. rise×3 — 200ms 딜레이 후 순차 등장
    riseY.forEach((y, i) => {
      Animated.sequence([
        Animated.delay(200 + i * 120),
        Animated.parallel([
          Animated.timing(y, {
            toValue: 0,
            duration: 420,
            easing: Easing.bezier(0.16, 1, 0.3, 1), // cubic-bezier(.16,1,.3,1) — CLAUDE.md §7
            useNativeDriver: true,
          }),
          Animated.timing(riseOpacity[i], {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, [markScale, ringOpacity, ringScale, riseOpacity, riseY]);

  // ── 반영 3건 ────────────────────────────────────────────────
  const reflectItems = [
    vendor ? `${vendor}로 결정했어요` : '결정했어요',
    '홈 준비 현황과 웨딩일정 지출에 자동으로 반영돼요',
    '결정은 언제든 바꿀 수 있어요',
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {/* ── 1. 체크 링 ─────────────────────────────── */}
          <View style={styles.markArea}>
            {/* ringSpread 원형 */}
            <Animated.View
              style={[
                styles.ring,
                {
                  borderColor: theme.tint,
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity,
                },
              ]}
            />
            {/* Pick Mark */}
            <Animated.View
              style={[
                styles.markWrap,
                { backgroundColor: theme.tint },
                { transform: [{ scale: markScale }] },
              ]}>
              <WeddingMark size={64} color={theme.onTint} />
            </Animated.View>
          </View>

          {/* ── 타이틀 ─────────────────────────────────── */}
          <ThemedText type="t2" style={styles.title}>
            {categoryLabel} 준비 완료
          </ThemedText>

          {/* ── 2. 반영 3건 ────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.card}>
            {reflectItems.map((item, i) => (
              <Animated.View
                key={i}
                style={{
                  transform: [{ translateY: riseY[i] }],
                  opacity: riseOpacity[i],
                }}>
                <ThemedText type="t7" themeColor="textSecondary" style={styles.reflectRow}>
                  {item}
                </ThemedText>
              </Animated.View>
            ))}
          </ThemedView>

          {/* ── 3. 지출 넣기 — 금액을 기억하는 지금이 가장 정확하다(WP-OUR-014로). ── */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t5">지출을 넣어두시겠어요?</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              금액을 기억하는 지금이 가장 정확해요
            </ThemedText>
            <ActionButton
              variant="primary"
              size="xlarge"
              label="지출 넣기"
              onPress={() => void goAddExpense()}
            />
          </ThemedView>

          {/* ── 4. 홈으로 — 보조. Primary는 위의 «지출 넣기» 하나다. ── */}
          <View style={styles.footer}>
            <ActionButton
              variant="ghost"
              size="xlarge"
              label="홈으로"
              onPress={() => router.replace('/')}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scroll: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.four,
    alignItems: 'center',
  },
  markArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  markWrap: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
  },
  reflectRow: {
    lineHeight: LineHeight.t7,
  },
  footer: {
    width: '100%',
  },
});
