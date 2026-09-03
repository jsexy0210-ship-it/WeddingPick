import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { decideCategory, getCurrentUser } from '@/api/client';
import { won } from '@/features/quotes/quote-result-view';
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
 * 최종 결정 확인 시트. WP-PICK-005.
 *
 * 업체명·카테고리·금액을 보여주고 "결정할게요"를 누르면 Pick Mark 체크 팝
 * 애니메이션(460ms, cubic-bezier(.34,1.56,.64,1))을 재생한 뒤 결정을 저장한다.
 *
 * **결정은 되돌릴 수 있다.** 바꾸는 화면이 따로 있고, 이 화면에서는 그 이야기를
 * 꺼내지 않는다 — 선택을 앞둔 사람에게 "취소할 수 있어요"를 먼저 말하면
 * 결정을 돕는 것이 아니라 미루게 만든다.
 */
export default function PickConfirmScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    category: string;
    vendorId: string;
    vendorName: string;
    amount?: string;
  }>();

  const category = params.category as VendorCategory;
  const vendorId = params.vendorId ?? '';
  const vendorName = params.vendorName ?? '';
  const amount = params.amount ? Number(params.amount) : null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 애니메이션이 재생 중이거나 끝난 상태 */
  const [decided, setDecided] = useState(false);

  const markScale = useRef(new Animated.Value(0)).current;

  function playCheckPop() {
    /*
      CLAUDE.md §7: 체크 팝 — scale 0 → 1.18 → 1, 460ms,
      cubic-bezier(.34,1.56,.64,1). React Native Animated에서 spring으로
      같은 효과를 낸다. Easing.elastic(1.2)은 과탄성 곡선으로 1.18→1을 흉내낸다.
    */
    Animated.sequence([
      Animated.timing(markScale, {
        toValue: 1.18,
        duration: 300,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(markScale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }

  async function decide() {
    if (loading || decided) return;
    setLoading(true);
    setError(null);

    try {
      const me = await getCurrentUser();
      if (!me.weddingId) throw new Error('결혼 정보가 없어요.');
      await decideCategory(me.weddingId, { category, vendorId });

      setDecided(true);
      playCheckPop();

      /* 460ms 뒤에 결정 완료 화면(WP-PICK-006)으로 넘어간다. */
      setTimeout(
        () =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.replace({
            pathname: '/(tabs)/pick/done' as any,
            params: { category, vendorName },
          }),
        460
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '정하지 못했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>
          {/* Pick Mark — scale 0 → 1.18 → 1 팝 애니메이션 (460ms) */}
          <Animated.View
            style={[
              styles.markWrap,
              { backgroundColor: theme.tint },
              { transform: [{ scale: markScale }] },
            ]}>
            <WeddingMark size={64} color="#ffffff" />
          </Animated.View>

          {/* 요약 카드 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t7" themeColor="textSecondary">
              {VENDOR_CATEGORY_LABEL[category]}
            </ThemedText>
            <ThemedText type="t4">{vendorName}</ThemedText>
            {amount !== null ? (
              <ThemedText type="t5" numeric themeColor="textSecondary">
                {won(amount)}
              </ThemedText>
            ) : null}
          </ThemedView>

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}

          {/* Primary CTA — 52h */}
          <ThemedView style={styles.cta}>
            <ActionButton
              variant="primary"
              label="결정할게요"
              disabled={loading || decided}
              onPress={() => void decide()}
            />
            <ActionButton label="취소" onPress={() => router.back()} />
          </ThemedView>
        </ThemedView>
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
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Layout.gutter,
    gap: Spacing.three,
    alignItems: 'center',
  },
  markWrap: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
    width: '100%',
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
