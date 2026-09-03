import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 최종 결정 확인 시트. 핸드오프 WP-PICK-005.
 * 선택한 업체 정보 요약 + Pick Mark 체크 팝 애니메이션(460ms).
 * 이 화면은 decideCategory 성공 후에 온다 — 결정은 이미 완료된 상태.
 */

type ConfirmParams = {
  category?: string;
  vendorId?: string;
  vendorName?: string;
};

/** Pick Mark: 하트 안에 체크 — CLAUDE.md §2 확정본. */
function PickMark({ size = 64 }: { size?: number }) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 체크 팝 애니메이션: scale 0 → 1.18 → 1 / 460ms / cubic-bezier(.34,1.56,.64,1)
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.18,
        duration: 300,
        easing: Easing.out(Easing.back(2.5)),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Animated.View
        style={[
          styles.pickMark,
          { width: size, height: size, backgroundColor: theme.tint },
        ]}
      >
        {/* SVG path는 웹 전용 — React Native에서는 tint 원 위에 아이콘 대체 */}
        <ThemedText
          style={[styles.checkGlyph, { fontSize: size * 0.45, color: theme.onTint }]}
        >
          {'✓'}
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
}

export default function ConfirmScreen() {
  const params = useLocalSearchParams<ConfirmParams>();
  const { category, vendorName } = params;

  const categoryLabel = category
    ? (VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? category)
    : '';

  function goHome() {
    router.dismissAll();
    router.replace('/(tabs)/pick');
  }

  function goDetail() {
    if (params.vendorId) {
      router.push(`/search/${params.vendorId}`);
    } else {
      router.replace('/(tabs)/pick');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>
          {/* Pick Mark 팝 애니메이션 */}
          <PickMark size={80} />

          {/* 완료 메시지 */}
          <ThemedView style={styles.textBlock}>
            <ThemedText type="t2" style={styles.center}>
              {categoryLabel} 결정 완료
            </ThemedText>
            {vendorName ? (
              <ThemedText type="t6" themeColor="textSecondary" style={styles.center}>
                {vendorName}으로 정했어요
              </ThemedText>
            ) : null}
          </ThemedView>

          {/* 안내 */}
          <ThemedView type="backgroundElement" style={styles.infoCard}>
            <ThemedText type="t7" themeColor="textSecondary">
              우리웨딩 준비현황과 지출에 자동으로 반영돼요
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              결정은 언제든 바꿀 수 있어요
            </ThemedText>
          </ThemedView>

          {/* CTA */}
          <ThemedView style={styles.actions}>
            <ActionButton
              variant="primary"
              size="xlarge"
              label="Pick 목록으로"
              onPress={goHome}
            />
            {params.vendorId ? (
              <ActionButton
                variant="secondary"
                size="large"
                label="업체 상세 보기"
                onPress={goDetail}
              />
            ) : null}
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    flex: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickMark: {
    borderRadius: Radius.pick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    lineHeight: undefined,
    textAlign: 'center',
  },
  textBlock: { gap: Spacing.one, alignItems: 'center' },
  center: { textAlign: 'center' },
  infoCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
    width: '100%',
  },
  actions: { gap: Spacing.two, width: '100%', marginTop: Spacing.two },
});
