import type { VendorDetail } from '@weddingpick/api-contract';
import {
  TERMS,
  VENDOR_CATEGORY_LABEL,
  priceLine,
  withInstrument,
  withParticle,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { decideCategory, getCurrentUser, getVendor } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import {
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  VendorImage,
  useTheme,
} from '@weddingpick/ui';
import { useDepthBack } from '@/features/navigation/depth-back';

/**
 * 최종 결정 확인 · WP-PICK-005 · WP-SHT-005. 시안 09-core-loop.dc.html #10d.
 *
 *   시트   공용 SheetPanel(그래버 40×4 · padding 12 24 28 · gap 20)
 *   머리   썸네일 64 radius 10 · 업체명 24 · «제보 금액 152~184만원» 16
 *   제목   24 «스튜디오는 강남 A 스튜디오로 결정할까요?»
 *   항목   체크 18 + 16/24 — «준호님도 Pick한 곳이에요» · «웨딩일정 준비현황과 지출에 자동으로 반영돼요» ·
 *          «결정은 언제든 바꿀 수 있어요»
 *   버튼   «다시 볼게요»(gray · flex 1) + «최종 결정»(coral · flex 1.4) · 52(tokens size.ctaPrimary — 시안 56보다 토큰이 우선)
 *
 * 결정은 **여기서만** 저장한다 — 목록(WP-PICK-002)이 먼저 저장하고 이 화면이 또 저장하던 것을
 * 하나로 모았다. 저장이 끝나면 결정 완료(WP-PICK-006)로 바꿔 끼운다.
 *
 * 문구는 spec/strings.ko.json pick.decideTitle · pick.decideNote1~3.
 */
export default function PickConfirmScreen() {
  const depthBack = useDepthBack();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    category: string;
    vendorId: string;
    vendorName: string;
    /** 배우자도 Pick한 곳이면 '1'. 첫 항목 문장을 켠다. */
    shared?: string;
  }>();

  const category = params.category as VendorCategory;
  const vendorId = params.vendorId ?? '';
  const vendorName = params.vendorName ?? '';
  const shared = params.shared === '1';
  const categoryLabel = VENDOR_CATEGORY_LABEL[category] ?? category ?? '';

  /** 시트 머리의 금액·이미지. 못 읽어도 시트는 뜬다 — 이름은 파라미터로 왔다. */
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alive = true;
    getVendor(vendorId)
      .then((loaded) => {
        if (alive) setVendor(loaded);
      })
      .catch(() => undefined);
    getCurrentUser()
      .then((me) => {
        if (alive) setPartner(me.spouseLinked ? (me.partnerDisplayName ?? TERMS.spouse) : null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [vendorId]);

  /* 시트를 닫는 것은 «연 자리로 되돌아가기»라 History Back이다. 되돌아갈 곳이 없을 때만
     Depth Back 규칙이 한 단계 위(Pick 탭)로 내려놓는다. */
  function dismiss() {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else depthBack();
  }

  async function decide() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const me = await getCurrentUser();
      if (!me.weddingId) throw new Error('결혼 정보가 없어요.');
      await decideCategory(me.weddingId, { category, vendorId });
      router.replace({
        pathname: '/(tabs)/pick/done',
        params: { category, vendorName },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '정하지 못했어요. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  const line = vendor ? priceLine(vendor.prices.paidPrice, vendor.guidePrice) : null;
  const who = partner ? (partner === TERMS.spouse ? partner : `${partner}님`) : null;
  const notes = [
    shared && who ? `${who}도 ${TERMS.pick}한 곳이에요` : null,
    '웨딩일정 준비현황과 지출에 자동으로 반영돼요',
    '결정은 언제든 바꿀 수 있어요',
  ].filter((note): note is string => note !== null);

  return (
    <ThemedView style={styles.container}>
      <BottomSheet visible={visible} onRequestClose={dismiss}>
        <SheetPanel>

          {/* 머리 — 썸네일 64 · 업체명 24 · 제보 금액 16 */}
          <View style={styles.head}>
            <View style={styles.thumb}>
              <VendorImage
                source={vendor?.imageUrl ? { uri: vendor.imageUrl } : undefined}
                category={vendorImageCategory(category)}
                width={THUMB}
                height={THUMB}
                radius={Radius.medium}
              />
            </View>
            <View style={styles.headBody}>
              <ThemedText type="t3" numberOfLines={1}>{vendorName}</ThemedText>
              {line ? (
                <ThemedText type="t6" themeColor={line.dim ? 'textAssistive' : 'textSecondary'} numeric numberOfLines={1}>
                  {line.guide ? line.text : `제보 금액 ${line.text}`}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <ThemedText type="t3">
            {`${withParticle(categoryLabel, '은는')} ${withInstrument(vendorName)} 결정할까요?`}
          </ThemedText>

          <View style={styles.notes}>
            {notes.map((note) => (
              <View key={note} style={styles.note}>
                <View style={styles.noteIcon}>
                  <ProductSymbol name="check" size={Layout.iconInline} color={theme.textAssistive} />
                </View>
                <ThemedText type="body" themeColor="textStrong" style={styles.noteText}>{note}</ThemedText>
              </View>
            ))}
          </View>

          {error ? (
            <ThemedText type="t7" themeColor="negative">{error}</ThemedText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다시 볼게요"
              disabled={loading}
              onPress={dismiss}
              style={({ pressed }) => [
                styles.button,
                styles.ghost,
                { backgroundColor: pressed ? theme.border : theme.backgroundSelected },
              ]}>
              <ThemedText type="t5" themeColor="textStrong">다시 볼게요</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="최종 결정"
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              onPress={() => void decide()}
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                { backgroundColor: theme.tint, opacity: loading ? 0.6 : pressed ? 0.8 : 1 },
              ]}>
              <ThemedText type="t5" themeColor="onTint">{loading ? '정하는 중…' : '최종 결정'}</ThemedText>
            </Pressable>
          </View>
        </SheetPanel>
      </BottomSheet>
    </ThemedView>
  );
}

/** 시안 #10d 썸네일 64 — Layout 썸네일 토큰(52·44)에 없는 값. */
const THUMB = 64;

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Layout.sectionHeadGap },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radius.medium, overflow: 'hidden' },
  headBody: { flex: 1, minWidth: 0, gap: Spacing.half + 1 },
  notes: { gap: Spacing.two },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Layout.cardGap },
  noteIcon: { width: Layout.iconInline, height: Layout.iconInline, marginTop: Spacing.half + 1 },
  noteText: { flex: 1 },
  actions: { flexDirection: 'row', gap: Layout.cardGap },
  button: {
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { flex: 1 },
  primary: { flex: 1.4 },
});
