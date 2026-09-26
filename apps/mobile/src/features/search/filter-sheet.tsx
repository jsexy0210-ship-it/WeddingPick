import type { VendorSort } from '@weddingpick/api-contract';
import {
  type BudgetBandKey,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
  WEDDING_STYLE_LABEL,
  WEDDING_STYLES,
} from '@weddingpick/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Border,
  Layout,
  LineHeight,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { SHEET_SORTS } from '@/features/search/sort-panel';

/**
 * 필터 — WP-SRCH-002(`docs/design/React_Native/search.jsx` frame-002 · `search.js` `groups` ·
 * `sorts`). tagDesc 「5그룹 단일 선택 · 정렬 4종 · CTA에 결과 수. 상단 우측에 초기화가 primary
 * 색 텍스트로 있습니다」. 제목 18/25 · «전체 해제» 12/17 코랄 · 묶음 제목 14/20 · 정렬 제목
 * 12/17 · CTA «{n}개 업체 보기».
 *
 * **2026-09-25 묶음 값을 정본 `groups` 그대로 바꿨다**(MASTER 후속 — 「업데이트된 앱 화면에 다
 * 맞추라」). 서버 질의(`vendorSearchQuerySchema`)는 건드리지 않았다. 서버가 거를 수 없는 칸은
 * 정본대로 보이되 잠근다(BACKEND_PENDING) — 눌러도 아무것도 안 걸리는 칩을 켜 두지 않는다.
 *   - 카테고리: 전체 · 웨딩홀 · 스드메 · 본식 · 예물 · 신혼. 서버 `category`는 한 업종만
 *     받아 여러 업종 묶음(스드메 · 본식 · 예물 · 신혼)은 BACKEND_PENDING. 정본 묶음 밖 업종(#522로 뺀 것 포함)은 되살리지 않는다.
 *   - 지역: 서버 지역 목록(시/도 짧은 꼴, `WEDDING_REGIONS`)을 정본 표기 «서울 전체» 꼴로
 *     보인다. 질의값은 그대로 «서울»이다. 정본의 구 단위(강남구 …)는 서버 질의가 시/도까지라
 *     BACKEND_PENDING — 구 목록을 지어내 그리지 않는다.
 *   - 예산: 정본은 총예산 구간(500만원 이하 …)이고 서버 `budget`은 업체 금액 구간
 *     (`BUDGET_BANDS`)이라 뜻이 다르다. «전체»만 살리고 나머지 넷은 BACKEND_PENDING.
 *   - 스타일: 네 이름(`WEDDING_STYLE_LABEL`). 서버 질의 칸이 없어 BACKEND_PENDING.
 *
 * 2026-09-24 RN 정본 대조로 정렬 묶음(`sortSec`)을 시트 맨 아래에 되살렸다 — 결과 위 정렬
 * 칩의 인라인 패널(WP-SRCH-003)과 같은 값을 본다. 예산 묶음 첫 칸 «전체»도 정본대로 둔다.
 *
 * **공통 바텀시트다**(2026-09-26 대표 지시 「검색 -> 필터도 공통 바텀시트 UX 적용한다」). 그래버 →
 * 공통 머리(`SheetHeader` — 타이틀 «필터» + «전체 해제» 12 코랄 + 우측 X, 끌어 닫기 손잡이) → 묶음
 * (위 선 1 · 제목 14/700 · 칩 12/700) → 정렬 줄 → CTA «{n}개 업체 보기». 본문만 굴러가고 머리와 CTA는
 * 제자리다. 정본 WP-SRCH-002는 X 없이 제목 18/25와 «전체 해제»만 두고 CTA까지 한 덩어리로 굴렀다 —
 * 공통 시트 규칙(CLAUDE.md v3.29 「바텀시트 = 타이틀 + 우측 X 닫기」)과 대표 지시가 이긴다
 * (DESIGN_UNRESOLVED: 제목 22/30 · X · 고정 CTA는 정본과 다르다). 전체 화면이 아니다 — 뒤의 결과가
 * 비쳐 보여야 무엇을 좁히는 중인지 알 수 있다.
 *
 * 닫는 길은 공통 시트의 것 그대로다 — X · 딤 · 끌어 내리기 · 안드로이드 뒤로가기 · 웹 브라우저
 * 뒤로가기(`closeOnBrowserBack`). 모두 «적용 전 취소»다: 열 때 조건으로 되돌린다(`useFilterSheetSession`).
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
 * 「스타일」 묶음(v3.29 · RN 정본 `groups[3]`)은 2026-09-25에 정본대로 그렸다. 서버 질의에
 * `style` 칸이 없어(`vendorSummarySchema.styleTags`는 있지만 검색 필터로는 안 쓰인다) 칩을
 * 잠가 둔다 — BACKEND_PENDING. 서버가 붙으면 `SearchFilterValue`에 칸을 더하고 잠금을 푼다.
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
  groupStyle: '스타일',
  groupSort: '정렬',
  /** 정본 «서울 전체». 질의값은 시/도 짧은 꼴 그대로다. */
  regionAll: (region: string) => `${region} 전체`,
};

/** 정본 `groups[0]` — 카테고리. `category`가 null이면 서버에 없는 묶음(BACKEND_PENDING). */
const CATEGORY_OPTIONS: readonly { label: string; category: VendorCategory | null }[] = [
  { label: VENDOR_CATEGORY_LABEL.hall, category: 'hall' },
  { label: '스드메', category: null },
  { label: '본식', category: null },
  { label: '예물 · 신혼', category: null },
];

/** 정본 `groups[2]` — 예산(총예산 구간). 서버 `budget`과 뜻이 달라 전부 BACKEND_PENDING. */
const BUDGET_OPTIONS = ['500만원 이하', '500~1,000만원', '1,000~2,000만원', '2,000만원 이상'] as const;

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
    <BottomSheet visible={visible} onRequestClose={onDismiss} closeOnBrowserBack testID="search-filter-sheet">
      {/*
       * 공통 바텀시트(2026-09-26 대표 지시 「검색 -> 필터도 공통 바텀시트 UX 적용한다」): 그래버 →
       * 머리(타이틀 + 우측 X · 끌어 닫기 손잡이) → 본문 스크롤 → CTA. 머리와 CTA는 굴러가지 않는다 —
       * 390×844에서 CTA가 스크롤 맨 아래에 묻혀 보이지 않았다(2026-09-26 캡처).
       */}
      <SheetPanel>
        <SheetHeader
          title={S.title}
          onClose={onDismiss}
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={S.reset}
              hitSlop={Spacing.three}
              onPress={() => onChange({ ...value, category: null, region: null, budget: null })}>
              <ThemedText type="f12" style={[styles.bold, styles.small, { color: theme.tint }]}>
                {S.reset}
              </ThemedText>
            </Pressable>
          }
        />

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} testID="search-filter-body">
          {/* 카테고리 — 정본 `groups[0]`. */}
          <View style={[styles.group, { borderTopColor: theme.border }]}>
            <ThemedText type="f14" style={[styles.bold, styles.label]}>
              {S.groupCategory}
            </ThemedText>
            <View style={styles.chips}>
              <OptChip label={S.allCategories} selected={value.category === null} onPress={() => set({ category: null })} />
              {CATEGORY_OPTIONS.map(({ label, category }) => (
                <OptChip
                  key={label}
                  label={label}
                  disabled={category === null}
                  selected={category !== null && value.category === category}
                  onPress={() =>
                    category === null ? undefined : set({ category: value.category === category ? null : category })
                  }
                />
              ))}
            </View>
          </View>

          {/* 지역 */}
          <View style={[styles.group, { borderTopColor: theme.border }]}>
            <ThemedText type="f14" style={[styles.bold, styles.label]}>
              {S.groupRegion}
            </ThemedText>
            <View style={styles.chips}>
              {regions.map((region) => (
                <OptChip
                  key={region}
                  label={S.regionAll(region)}
                  selected={value.region === region}
                  onPress={() => set({ region: value.region === region ? null : region })}
                />
              ))}
            </View>
          </View>

          {/* 예산 — 정본 `groups[2]`. «전체» 외 넷은 BACKEND_PENDING. */}
          <View style={[styles.group, { borderTopColor: theme.border }]}>
            <ThemedText type="f14" style={[styles.bold, styles.label]}>
              {S.groupBudget}
            </ThemedText>
            <View style={styles.chips}>
              <OptChip label={S.allBudgets} selected={value.budget === null} onPress={() => set({ budget: null })} />
              {BUDGET_OPTIONS.map((label) => (
                <OptChip key={label} label={label} disabled selected={false} onPress={() => undefined} />
              ))}
            </View>
          </View>

          {/* 스타일 — 정본 `groups[3]`. 서버 질의 칸이 없어 BACKEND_PENDING. */}
          <View style={[styles.group, { borderTopColor: theme.border }]}>
            <ThemedText type="f14" style={[styles.bold, styles.label]}>
              {S.groupStyle}
            </ThemedText>
            <View style={styles.chips}>
              {WEDDING_STYLES.map((style) => (
                <OptChip key={style} label={WEDDING_STYLE_LABEL[style]} disabled selected={false} onPress={() => undefined} />
              ))}
            </View>
          </View>

          {/* 정렬 — 정본 `sortSec` · `sorts`: 한 줄 가로 스크롤, 켠 칸은 잉크 면(`sortPill`). */}
          <View style={styles.sortGroup}>
            <ThemedText type="f12" style={[styles.bold, styles.small]}>
              {S.groupSort}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
              {SHEET_SORTS.map(({ label, sort }) => (
                <OptChip
                  key={label}
                  label={label}
                  pill
                  disabled={sort === null}
                  selected={sort !== null && value.sort === sort}
                  onPress={() => (sort === null ? undefined : set({ sort }))}
                />
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* 정본 `sheetCta` — 화면당 Primary CTA 하나. 고른 조건으로 몇 곳인지 그대로 적는다. */}
        <View style={styles.cta}>
          <ActionButton variant="primary" size="xlarge" label={S.apply(count)} onPress={onApply} />
        </View>
      </SheetPanel>
    </BottomSheet>
  );
}

/**
 * 필터 시트 한 번 열림 — **적용 전 취소**를 지킨다(2026-09-26).
 *
 * 시트 안에서 칩을 누르면 부모 조건이 곧바로 바뀐다 — CTA의 수(«{n}개 업체 보기»)를 부모가 같은
 * 조건으로 세기 때문이다(위 `FilterSheet` 머리말). 그래서 열 때의 조건을 적어 두고
 *
 *   CTA(적용)                          → 바뀐 조건을 그대로 둔다
 *   X · 딤 · 끌어 닫기 · 뒤로가기(안드로이드 · 웹) → 열 때의 조건으로 되돌린다
 *
 * 무엇을 적어 두고 되돌릴지는 부르는 쪽이 정한다(`capture` · `restore`). 검색 화면은 시트가 만지는
 * 칸(카테고리 · 지역 · 예산 · 정렬 — `pickFilterValue`)과 결과 보기 상태만 되돌리고 검색어는 건드리지 않는다.
 */
export function useFilterSheetSession<T>(capture: () => T, restore: (before: T) => void) {
  const [visible, setVisible] = useState(false);
  const snapshot = useRef<{ value: T } | null>(null);
  const captureRef = useRef(capture);
  const restoreRef = useRef(restore);
  useEffect(() => {
    captureRef.current = capture;
    restoreRef.current = restore;
  }, [capture, restore]);

  const open = useCallback(() => {
    snapshot.current = { value: captureRef.current() };
    setVisible(true);
  }, []);

  /* X · 딤 · 끌기 · 뒤로가기 — 열 때로 되돌린다. 두 번 불려도 한 번만 되돌린다. */
  const dismiss = useCallback(() => {
    const before = snapshot.current;
    snapshot.current = null;
    setVisible(false);
    if (before) restoreRef.current(before.value);
  }, []);

  /* CTA — 바뀐 조건을 그대로 둔다. */
  const apply = useCallback(() => {
    snapshot.current = null;
    setVisible(false);
  }, []);

  return { visible, open, dismiss, apply };
}

/** 시트가 만지는 칸만 떼어 낸다. */
export function pickFilterValue(value: SearchFilterValue): SearchFilterValue {
  return { category: value.category, region: value.region, budget: value.budget, sort: value.sort };
}

/**
 * 시트 안 조건 칩 — 정본 `opt`(search.js): padding 10/14 · radius 999 · 12/700 · 켜지면 코랄 면 +
 * 흰 글자 + 체크 14(`optCheck` · check-fill), 꺼지면 회색 면(`SEC`) + 보조색 글자.
 * `pill`은 정렬 줄의 `sortPill`: padding 10/16 · 켜지면 잉크 면. 공용 `FilterChip`(36 · 14px)과
 * 규격이 달라 이 시트에 둔다. 서버가 거를 수 없는 칸은 같은 모양으로 두고 누름만 잠근다.
 */
function OptChip({
  label,
  selected,
  disabled = false,
  pill = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  pill?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const on = selected ? (pill ? theme.text : theme.tint) : theme.backgroundElement;
  const color = selected ? theme.onTint : theme.textAssistive;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.opt, pill ? styles.pill : null, { backgroundColor: on }]}>
      {selected && !pill ? <ProductSymbol name="checkFill" size={Layout.iconSmall} color={color} /> : null}
      <ThemedText type="f12" numberOfLines={1} style={[styles.bold, styles.small, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * 본문만 굴러간다 — 머리(끌기 손잡이 · X)와 CTA는 제자리다. 패널 높이는 공통 시트가 90%로 묶는다
   * (정본 `sheet` max-height 760 — 844 화면의 90%와 같다). 줄 수 있는 만큼만 줄어든다.
   */
  scroll: { flexGrow: 0, flexShrink: 1 },
  /* 정본 `resetBtn` · `sortLabel` · `opt` 12/17. */
  small: { lineHeight: LineHeight.lh17 },
  /* 정본 `fLabel` 14/20. */
  label: { lineHeight: LineHeight.lh20 },
  /* 정본 `fGroup`: 위 선 1 · padding 20 0 · 사이 12. */
  group: {
    borderTopWidth: Border.hairline,
    paddingVertical: Spacing.three + Spacing.one,
    gap: Layout.inlineGap,
  },
  /* 정본 `sortSec`: 위 28 · 사이 8. */
  sortGroup: { paddingTop: Layout.sectionGap, gap: Spacing.two },
  /* 정본 `sortRow`: 사이 8 · 아래 4. */
  sortRow: { flexDirection: 'row', gap: Spacing.two, paddingBottom: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.chipGap },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Layout.chipPaddingX,
    borderRadius: Radius.pill,
  },
  pill: { paddingHorizontal: Spacing.three },
  /* 정본 `sheetCta` margin-top 32 — 공통 시트의 요소 간격 12가 이미 있어 그만큼 뺀다. 줄지 않는다. */
  cta: { marginTop: Spacing.five - Layout.sheetGap, flexShrink: 0 },
  bold: { fontWeight: 700 },
});
