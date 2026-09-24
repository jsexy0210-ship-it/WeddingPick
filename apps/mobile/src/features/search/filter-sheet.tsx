import type { VendorSort } from '@weddingpick/api-contract';
import {
  BUDGET_BANDS,
  type BudgetBandKey,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  FilterChip,
  Layout,
  ProductSymbol,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { SELECTABLE_SORTS, SORT_LABEL } from '@/features/search/sort-panel';

/**
 * 필터 — WP-SRCH-002(`docs/design/React_Native/search.jsx` frame-002 · `search.js` `groups` ·
 * `sorts`). tagDesc 「5그룹 단일 선택 · 정렬 4종 · CTA에 결과 수. 상단 우측에 초기화가 primary
 * 색 텍스트로 있습니다」. 제목 18/25 · «전체 해제» 12/17 코랄 · 묶음 제목 14/20 · 정렬 제목
 * 12/17 · CTA «{n}개 업체 보기».
 *
 * 2026-09-24 RN 정본 대조로 정렬 묶음(`sortSec`)을 시트 맨 아래에 되살렸다 — 결과 위 정렬
 * 칩의 인라인 패널(WP-SRCH-003)과 같은 값을 본다. 예산 묶음 첫 칸 «전체»도 정본대로 둔다.
 *
 * **바텀시트다.** 그래버 → 제목 24/32 ↔ «초기화» 16/700 #4D5159 → 조건 묶음(제목 16/22 700 ·
 * 칩 38/16) → «실 제보가 있는 곳만» 토글 → 아래 붙은 dock의 CTA «{n}곳 보기». 전체 화면이
 * 아니다 — 뒤의 결과가 비쳐 보여야 무엇을 좁히는 중인지 알 수 있다.
 *
 * CTA의 수는 **고르는 대로 바뀐다**(시안 «조건을 바꿀 때마다 하단 버튼의 결과 수가 함께
 * 바뀝니다»). 그 수는 시트가 스스로 세지 않고 부모가 넘긴다 — 결과 화면이 이미 같은
 * 조건으로 서버를 부르고 있어서, 여기서 또 부르면 같은 질의를 두 번 한다.
 *
 * **「실 제보가 있는 곳만」 토글을 뺐다**(2026-09-23 대표 지시 「정본과 다른 기능은 제거한다」).
 * v3.28 WP-SRCH-002가 그리는 묶음은 카테고리 · 지역 · 예산 · 스타일 넷뿐이고, 이 토글은
 * 6개 `.dc.html` 어디에도 없다. 서버의 `onlyVerified` 질의값은 그대로 두고 화면에서만 뺀다.
 *
 * 시안의 「촬영일」 · 「조건(원본 전체 · 야외 포함 …)」 두 묶음은 두지 않는다. 업체의
 * 촬영 가능일도 상품 구성도 아직 어디에도 모아둔 것이 없다 — 눌러도 아무것도 걸리지
 * 않는 칩을 두는 것이 빠뜨리는 것보다 나쁘다.
 *
 * **DESIGN_UNRESOLVED — 「스타일」 그룹(2026-09-23 v3.29 재대조).** v3.29 정본
 * (`대메뉴_검색.dc.html` WP-SRCH-002)은 카테고리 · 지역 · 예산 다음에 스타일(도시적인 ·
 * 자연스러운 · 로맨틱한 · 화려한, 단일 선택) 넷째 묶음을 그린다. 여기서는 만들지
 * 않았다 — `vendorSearchQuerySchema`(packages/api-contract)에 `style` 질의 칸이
 * 없고 서버도 이 조건으로 거르지 않는다. 바로 위 문단의 원칙과 같다: 화면에서만
 * 칩을 만들면 눌러도 아무것도 안 걸린다. 서버 질의·저장(`vendorSummarySchema.styleTags`는
 * 있지만 검색 필터로는 안 쓰인다)까지 잇는 것은 이 화면군(검색 목록·필터) 범위를
 * 넘는 API 작업이라 여기서 만들지 않는다.
 */

/** spec/strings.ko.json search.filter.* */
const S = {
  title: '필터',
  reset: '전체 해제',
  /** «{n}개 업체 보기» — 정본 `sheetCta` «7개 업체 보기». */
  apply: (count: number) => `${count}개 업체 보기`,
  groupCategory: '카테고리',
  allCategories: '전체',
  groupRegion: '지역',
  groupBudget: '예산',
  allBudgets: '전체',
  groupSort: '정렬',
};

export type SearchFilterValue = {
  /** 업종 한 칸. 피그마 `Search.tsx` 필터 시트의 첫 그룹(2026-09-14 정본). 고르지 않았으면 null = 전체. */
  category: VendorCategory | null;
  region: string | null;
  budget: BudgetBandKey | null;
  /** 정렬 — 시트 맨 아래 «정렬» 묶음(정본 `sortSec`). 결과 위 정렬 패널과 같은 값이다. */
  sort: VendorSort;
};

export function FilterSheet({
  visible,
  value,
  regions,
  count,
  onChange,
  onApply,
  onDismiss,
}: {
  visible: boolean;
  value: SearchFilterValue;
  regions: readonly string[];
  /** 지금 조건으로 몇 곳인가. CTA 라벨에 그대로 들어간다. */
  count: number;
  onChange: (next: SearchFilterValue) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  /*
   * 열려 있는 동안에는 부모의 값을 그대로 보여준다. 시트가 자기 사본을 들고 있으면
   * 결과 수와 칩이 어긋나는 순간이 생긴다 — CTA는 부모가 센 수를 적는데 칩은 사본을
   * 그리기 때문이다.
   */
  const set = (patch: Partial<SearchFilterValue>) => onChange({ ...value, ...patch });

  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetPanel style={styles.panel}>
        <View style={styles.head}>
          <ThemedText type="f18" style={styles.bold}>{S.title}</ThemedText>
          <View style={styles.headActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={S.reset}
              hitSlop={Spacing.three}
              onPress={() => onChange({ ...value, category: null, region: null, budget: null })}>
              <ThemedText type="f12" style={[styles.bold, { color: theme.tint }]}>
                {S.reset}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="필터 닫기"
              onPress={onDismiss}
              style={styles.closeButton}>
              <ProductSymbol name="close" size={16} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}>
          {/*
            카테고리 — 피그마 `Search.tsx` 필터 시트의 첫 그룹(«전체 · 웨딩홀 · 스튜디오 …»).
            결과 위 «카테고리 ▾» 칩이 이 시트를 연다. 업종은 열셋 전부 두고 이름은
            VENDOR_CATEGORY_LABEL 하나만 본다(본식스냅 · 헤어변형 · 결정사 — CLAUDE.md).
          */}
          <View style={styles.group}>
            <ThemedText type="f14" style={styles.bold}>
              {S.groupCategory}
            </ThemedText>
            <View style={styles.chips}>
              <FilterChip
                label={S.allCategories}
                size="sheet"
                accent="tint"
                role="radio"
                selected={value.category === null}
                onPress={() => set({ category: null })}
              />
              {VENDOR_CATEGORIES.map((category) => (
                <FilterChip
                  key={category}
                  label={VENDOR_CATEGORY_LABEL[category]}
                  size="sheet"
                  accent="tint"
                  role="radio"
                  selected={value.category === category}
                  onPress={() => set({ category: value.category === category ? null : category })}
                />
              ))}
            </View>
          </View>

          {/* 지역 */}
          <View style={styles.group}>
            <ThemedText type="f14" style={styles.bold}>
              {S.groupRegion}
            </ThemedText>
            <View style={styles.chips}>
              {regions.map((region) => (
                <FilterChip
                  key={region}
                  label={region}
                  size="sheet"
                  accent="tint"
                  role="radio"
                  selected={value.region === region}
                  onPress={() => set({ region: value.region === region ? null : region })}
                />
              ))}
            </View>
          </View>

          {/* 예산 — 구간 칩 넷(BUDGET_BANDS). 만원 숫자 입력이 아니다. */}
          <View style={styles.group}>
            <ThemedText type="f14" style={styles.bold}>
              {S.groupBudget}
            </ThemedText>
            <View style={styles.chips}>
              <FilterChip
                label={S.allBudgets}
                size="sheet"
                accent="tint"
                role="radio"
                selected={value.budget === null}
                onPress={() => set({ budget: null })}
              />
              {BUDGET_BANDS.map((band) => (
                <FilterChip
                  key={band.key}
                  label={band.label}
                  size="sheet"
                  accent="tint"
                  role="radio"
                  selected={value.budget === band.key}
                  onPress={() => set({ budget: value.budget === band.key ? null : band.key })}
                />
              ))}
            </View>
          </View>

          {/* 정렬 — 정본 `sortSec` · `sorts`: 한 줄 가로 스크롤, 켠 칸은 잉크 면(`sortPill`). */}
          <View style={styles.sortGroup}>
            <ThemedText type="f12" style={styles.bold}>
              {S.groupSort}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SELECTABLE_SORTS.map((sort) => (
                <FilterChip
                  key={sort}
                  label={SORT_LABEL[sort]}
                  size="sheet"
                  role="radio"
                  selected={value.sort === sort}
                  onPress={() => set({ sort })}
                />
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* dock — 화면당 Primary CTA 하나. 고른 조건으로 몇 곳인지 그대로 적는다. */}
        <ThemedView style={[styles.dock, { borderTopColor: theme.line }]}>
          <ActionButton variant="primary" size="xlarge" label={S.apply(count)} onPress={onApply} />
        </ThemedView>
      </SheetPanel>
    </BottomSheet>
  );
}

/** 시안 06-search #16d — 시트 본문 «max-height:440px». 8단 사다리 밖의 시트 전용 값이다. */
const BODY_MAX_HEIGHT = 440;

const styles = StyleSheet.create({
  /* SheetPanel이 padding 12 24 (28+safe) · gap 20을 준다. 여기서는 dock만 좌우로 늘린다. */
  panel: { gap: Spacing.three },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  /* 시안: 조건 묶음은 440까지만 늘고 그 안에서 스크롤한다 — dock이 밀려 내려가지 않게. */
  body: { maxHeight: BODY_MAX_HEIGHT },
  bodyContent: { gap: Layout.sectionGap, paddingBottom: Spacing.one },
  group: { gap: Layout.cardGap },
  /* 정본 `sortSec` 사이 8. */
  sortGroup: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.chipGap },
  dock: {
    borderTopWidth: 1,
    paddingTop: Layout.sheetPaddingTop,
  },
  bold: { fontWeight: 700 },
});
