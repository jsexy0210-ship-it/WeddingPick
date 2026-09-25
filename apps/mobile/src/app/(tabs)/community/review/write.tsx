import type { VendorSummary } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL, regionLabel } from '@weddingpick/domain';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { searchVendors } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import {
  Border,
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

const DEBOUNCE_MS = 250;

/**
 * 라운지 후기 글쓰기 진입.
 *
 * 예전 주소는 리얼후기 화면으로 보낸다. 업체 선택 시트는 리얼후기 화면이 직접 렌더해
 * 숨은 하위 탭 아래로 HOME이 비치지 않게 한다. 업체를 고르기 전에는 후기 계약을
 * 만들 수 없으므로 샘플 업체나 임의 vendorId를 지어내지 않는다.
 */
export default function LoungeReviewWriteRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const href = `/community/review?write=review${from === 'my' ? '&from=my' : ''}`;

  return <Redirect href={href as never} />;
}

export function LoungeReviewVendorSheet({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (vendorId: string) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [vendors, setVendors] = useState<VendorSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const timer = setTimeout(() => {
      void searchVendors({ q: trimmed, limit: 12 })
        .then((response) => setVendors(response.vendors))
        .catch(() => {
          setVendors([]);
          setFailed(true);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function changeQuery(text: string) {
    setQuery(text);
    if (!text.trim()) {
      setVendors(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
  }

  return (
    <BottomSheet visible onRequestClose={onClose} testID="lounge-review-write-sheet">
        <SheetPanel style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.headRow}>
              <ThemedText type="t4">후기 쓰기</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="후기 작성 닫기"
                hitSlop={12}
                onPress={onClose}
                style={styles.close}>
                <ProductSymbol name="close" size={20} color={theme.textAssistive} />
              </Pressable>
            </View>
            <ThemedText type="t7" themeColor="textSecondary">
              이용한 업체를 먼저 골라주세요.
            </ThemedText>
          </View>

          <TextInput
            autoFocus
            value={query}
            onChangeText={changeQuery}
            placeholder="업체 이름 검색"
            placeholderTextColor={theme.textAssistive}
            accessibilityLabel="후기 작성 업체 검색"
            returnKeyType="search"
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
          />

          <ScrollView
            style={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loader}><DelayedLoader active size={28} /></View>
            ) : query.trim().length === 0 ? (
              <ThemedText type="t7" themeColor="textSecondary" style={styles.empty}>
                업체 이름을 입력하면 바로 찾을게요.
              </ThemedText>
            ) : failed ? (
              <ThemedText type="t7" themeColor="negative" style={styles.empty}>
                업체를 불러오지 못했어요. 다시 입력해주세요.
              </ThemedText>
            ) : vendors?.length === 0 ? (
              <ThemedText type="t7" themeColor="textSecondary" style={styles.empty}>
                해당 이름의 업체가 아직 없어요.
              </ThemedText>
            ) : (
              vendors?.map((vendor) => (
                <Pressable
                  key={vendor.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${vendor.name} 후기 쓰기`}
                  onPress={() => onChoose(vendor.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.rowText}>
                    <ThemedText type="t6" numberOfLines={1}>
                      {vendor.name}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                      {VENDOR_CATEGORY_LABEL[vendor.category]} · {regionLabel(vendor.region)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </SheetPanel>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { flexShrink: 1 },
  head: { gap: Spacing.one },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  input: {
    minHeight: Layout.field,
    borderWidth: Border.hairline,
    borderRadius: Radius.input,
    paddingHorizontal: Layout.cardPadding,
  },
  results: { flexGrow: 0, maxHeight: 420 },
  loader: { minHeight: 120 },
  empty: { paddingVertical: Spacing.four },
  row: {
    minHeight: 64,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: Border.hairline,
  },
  rowText: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.75 },
});
