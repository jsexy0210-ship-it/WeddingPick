import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
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
 */
export default function PickDoneScreen() {
  const theme = useTheme();
  const { category, vendorName } = useLocalSearchParams<{
    category: string;
    vendorName: string;
  }>();

  const categoryLabel = VENDOR_CATEGORY_LABEL[(category as VendorCategory) ?? 'venue'] ?? category ?? '';
  const vendor = vendorName ?? '';

  // ── 애니메이션 값 ──────────────────────────────────────────
  const markScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  const riseY = [
    useRef(new Animated.Value(10)).current,
    useRef(new Animated.Value(10)).current,
    useRef(new Animated.Value(10)).current,
  ];
  const riseOpacity = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

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
  }, []);

  // ── 반영 3건 ────────────────────────────────────────────────
  const reflectItems = [
    vendor ? `${vendor}로 결정했어요` : '결정했어요',
    '우리웨딩 준비현황과 지출에 자동으로 반영돼요',
    '결정은 언제든 바꿀 수 있어요',
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          scrollEnabled={false}>

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
              <WeddingMark size={64} color="#ffffff" />
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

          {/* ── 3. 다음 카테고리 추천 ───────────────────── */}
          <ActionButton
            variant="primary"
            size="xlarge"
            label="완료"
            onPress={() => router.replace('/(tabs)/pick')}
          />
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
    lineHeight: 20,
  },
});
