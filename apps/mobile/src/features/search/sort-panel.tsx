import { VENDOR_SORT_LABEL, type VendorSort } from '@weddingpick/api-contract';
import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 검색 결과 정렬 — WP-SRCH-003(`docs/design/React_Native/search.jsx` frame-003 · `search.js`
 * `sortPanel` · `sortRows`). tagDesc 「정렬은 칩 아래 인라인 패널입니다」 — 결과 수 줄 오른쪽
 * 정렬 칩 바로 아래에 겹쳐 뜨는 작은 목록이다. 바텀시트가 아니다(2026-09-24 RN 정본 대조로
 * 바텀시트 `SortSheet`를 걷어냈다).
 *
 * 정본 정렬은 다섯이다 — 패널 `sortRows`(추천순 · 금액 낮은순 · 많이 확인된 순 · 최근 등록순)와
 * 필터 시트 `sorts`(추천순 · 금액 낮은순 · 금액 높은순 · 많이 확인된 순). 두 목록을 정본 그대로
 * 그린다. 서버가 잴 수 있는 것은 셋뿐이다(api-contract `VENDOR_SORTS`).
 *
 * **BACKEND_PENDING — 「많이 확인된 순」 · 「최근 등록순」.** 서버에 그 정렬이 없다(앞은 `data`와
 * 기준이 겹쳐 따로 잴 값이 없고, 뒤는 등록일 정렬이 없다). 줄은 정본대로 보이되 잠근다 —
 * 서버에 없는 값을 보내지 않고, 눌러서 다른 정렬로 조용히 떨어지지도 않는다. 서버가 붙으면
 * `sort`에 계약 값을 넣고 잠금을 푼다. 잠근 줄도 모양은 정본 그대로다 — 흐리게 하지 않는다
 * (2026-09-25 픽셀 대조: 정본 `sortRows`는 고르지 않은 줄을 모두 같은 보조색으로 그린다).
 */
export type SortOption = {
  label: string;
  /** null = BACKEND_PENDING. 보이되 고를 수 없다. */
  sort: VendorSort | null;
};

/**
 * 사용자 화면의 정렬 라벨. 계약의 `VENDOR_SORT_LABEL`은 내부 이름이라 화면에 그대로
 * 내보내지 않는다.
 *
 * 기본값(`data`)은 **«추천순»**이다 — RN 정본 `sortRows[0]` · `sorts[0]`과
 * `spec/strings.ko.json` `search.sort.recommended`가 그렇게 적는다. 금액 두 줄은 정본
 * 표기(「금액 낮은순」 · 「금액 높은순」, 붙여 쓴다)를 따른다.
 */
export const SORT_LABEL: Record<VendorSort, string> = {
  ...VENDOR_SORT_LABEL,
  data: '추천순',
  price_low: '금액 낮은순',
  price_high: '금액 높은순',
};

/** spec/strings.ko.json search.sort.mostVerified · search.sort.recent */
const MOST_VERIFIED: SortOption = { label: '많이 확인된 순', sort: null };
const RECENT: SortOption = { label: '최근 등록순', sort: null };

const option = (sort: VendorSort): SortOption => ({ label: SORT_LABEL[sort], sort });

/** 정본 `sortRows` — 결과 위 인라인 패널. */
export const PANEL_SORTS: readonly SortOption[] = [option('data'), option('price_low'), MOST_VERIFIED, RECENT];

/** 정본 `sorts` — 필터 시트 맨 아래 «정렬» 묶음. */
export const SHEET_SORTS: readonly SortOption[] = [
  option('data'),
  option('price_low'),
  option('price_high'),
  MOST_VERIFIED,
];

/**
 * 정렬 칩 아래 패널. 부모가 `position: relative` 줄 안에 두고 열림을 들고 있다.
 * 고르면 곧바로 닫힌다.
 *
 * 정본 `sortPanel`: 오른쪽 끝 정렬 · 칩 아래 52 · 최소 폭 140 · radius 16 · 테두리 1 ·
 * 흰 면 · 그림자 0 8 24 rgba(28,25,23,.12). `sortRow`: 안쪽 12/16 · 사이 8 · 줄 사이 선 1 ·
 * 14/20, 고른 줄은 700 잉크 + 오른쪽 체크 14, 나머지는 400 보조색.
 */
export function SortPanel({
  value,
  onSelect,
}: {
  value: VendorSort;
  onSelect: (sort: VendorSort) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {PANEL_SORTS.map(({ label, sort }, index) => {
        const selected = sort !== null && sort === value;
        const disabled = sort === null;
        const last = index === PANEL_SORTS.length - 1;

        return (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={label}
            disabled={disabled}
            onPress={sort === null ? undefined : () => onSelect(sort)}
            style={[
              styles.row,
              last ? null : { borderBottomWidth: Border.hairline, borderBottomColor: theme.line },
            ]}>
            <ThemedText
              type="f14"
              themeColor={selected ? undefined : 'textAssistive'}
              style={selected ? styles.bold : null}>
              {label}
            </ThemedText>
            {selected ? <ProductSymbol name="checkFill" size={Layout.iconSmall} color={theme.text} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** 정본 `sortPanel` 최소 폭 140 — 사다리 밖의 패널 전용 값이다. */
const PANEL_MIN_WIDTH = 140;

const styles = StyleSheet.create({
  panel: {
    minWidth: PANEL_MIN_WIDTH,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    overflow: 'hidden',
    /* 정본 box-shadow 0 8 24 rgba(28,25,23,.12). 같은 값의 Elevation 토큰이 없어 여기 적는다. */
    shadowColor: '#1c1917',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Layout.inlineGap,
    paddingHorizontal: Spacing.three,
  },
  bold: { fontWeight: 700 },
});
