import { VENDOR_SORT_LABEL, type VendorSort } from '@weddingpick/api-contract';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';

/**
 * 검색 결과 정렬 — WP-SRCH-006. 결과 상단의 «정렬» 셀렉트를 누르면 뜨는
 * 바텀시트. 라디오 한 줄에 하나, 고르면 바로 닫힌다.
 *
 * 핸드오프는 5개(추천순·최근 등록순 포함)를 적었지만 서버가 잴 수 있는 것은
 * 결제인증 건수와 금액뿐이다 — 없는 정렬에 이름만 붙이지 않는다(api-contract
 * `VENDOR_SORTS` 주석). 이름 순은 사람이 고를 이유가 없어 빼둔다.
 */
export const SELECTABLE_SORTS: readonly VendorSort[] = ['data', 'price_low', 'price_high'];

export function SortSheet({
  visible,
  value,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  value: VendorSort;
  onSelect: (sort: VendorSort) => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
        <ThemedView style={[SHEET_PANEL, styles.sheet, { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) }]}>
          <ThemedText type="t4">정렬</ThemedText>

          <View>
            {SELECTABLE_SORTS.map((sort) => {
              const selected = sort === value;

              return (
                <Pressable
                  key={sort}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(sort)}
                  style={[styles.row, { borderBottomColor: theme.line }]}>
                  <ThemedText type={selected ? 't5' : 't6'} style={selected ? { color: theme.tint } : undefined}>
                    {VENDOR_SORT_LABEL[sort]}
                  </ThemedText>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: selected ? theme.tint : theme.fieldBorder },
                    ]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: theme.tint }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 광고 분리 안내 — 어떤 정렬을 골라도 광고는 결과 순위에 섞이지 않는다(CLAUDE.md §9). */}
          <ThemedText type="t7" themeColor="textAssistive">
            광고는 정렬과 상관없이 따로 표시돼요
          </ThemedText>
        </ThemedView>
    </BottomSheet>
  );
}

/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항. */
const SHEET_BOTTOM_PADDING = 28;

const styles = StyleSheet.create({
  sheet: {
    padding: Layout.gutter,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    borderBottomWidth: 1,
  },
  /* 시안 고정 22 — 8단계 타이포와 무관한 라디오 지름이라 토큰이 아닌 값이다. */
  radio: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: Radius.pill },
});
