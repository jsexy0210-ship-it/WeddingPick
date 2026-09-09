import type { CandidateListResponse } from '@weddingpick/api-contract';
import { TERMS, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ErrorView,
  Layout,
  ProductSymbol,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { useDepthBack } from '@/features/navigation/depth-back';
import { getCurrentUser, getVendor, listCandidates } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

/**
 * 비교 후보 선택 · WP-CMP-001 · WP-SHT-004. 시안 17-sheets-states.dc.html SHT-004.
 *
 *   시트   공용 SheetPanel(그래버 40×4 · padding 12 24 28 · gap 20)
 *   제목   24 «비교할 곳을 골라주세요» · 본문 16 «같은 업종에서 2~3곳까지»
 *   행     56 · 이름 18 · «지역 · 업종» 14 · 체크 24 원 — 고정(A)은 코랄 A 칩 · 해제 불가
 *   CTA    52 coral «N곳 비교» — 2~3곳일 때만 산다
 *
 * 비교 화면은 WP-CMP-002 하나이고, 진입에 따라 **후보 초기값**만 다르다(SPEC §13.11).
 *
 *   Pick 탭에서    그 업종의 내 후보만 · 아무것도 체크되지 않은 채 2~3곳을 고른다
 *   업체 상세에서  `fixed`(vendorId)를 A로 고정 · 맨 앞 · 해제 불가 · B·C는 같은 업종 후보
 *
 * 고정 업체가 내 후보에 없어도 비교는 된다 — 업체 상세에서 온 사람은 그 업체를 견주고 싶은
 * 것이지 담고 싶은 것이 아니다. 후보를 바꾸는 건 이 시트에서만 하고, 결과 화면
 * (`/search/compare?ids=…`) 안에서는 교체하지 않는다.
 */

const MAX_COMPARE = 3;
const MIN_COMPARE = 2;

/** 문구. spec/strings.ko.json compare.selectTitle · screens.json WP-SHT-004 */
const TITLE = '비교할 곳을 골라주세요';
const BODY = `같은 업종에서 ${MIN_COMPARE}~${MAX_COMPARE}곳까지`;
const BODY_FIXED = `같은 업종 후보에서 1~${MAX_COMPARE - 1}곳을 더 골라주세요`;
const EMPTY_TITLE = '비교할 후보가 없어요';
const EMPTY_BODY = `먼저 이 업종에서 업체를 ${TERMS.pick}해주세요.`;

type CandidateItem = CandidateListResponse['groups'][number]['candidates'][number];

/** 목록 한 줄. 내 후보든 고정 업체든 같은 꼴로 그린다. */
type CompareOption = {
  vendorId: string;
  vendorName: string;
  category: string | null;
  region: string | null;
  addedByPartner: boolean;
  /** A로 고정 — 체크를 풀 수 없고 맨 앞에 선다. */
  locked: boolean;
};

function fromCandidate(c: CandidateItem, locked: boolean): CompareOption {
  return {
    vendorId: c.vendorId,
    vendorName: c.vendorName,
    category: c.category,
    region: c.region,
    addedByPartner: c.addedByPartner,
    locked,
  };
}

function RowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Skeleton height={19} width="60%" />
        <Skeleton height={15} width="35%" />
      </View>
    </View>
  );
}

export default function PickCompareScreen() {
  const depthBack = useDepthBack();
  const theme = useTheme();
  const { category, fixed, fixedName } = useLocalSearchParams<{
    category?: string;
    /** 업체 상세에서 온 경우 — A로 고정할 업체. */
    fixed?: string;
    /** 고정 업체의 요약을 못 읽었을 때 보여줄 이름. */
    fixedName?: string;
  }>();

  const [options, setOptions] = useState<CompareOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  /* 기본 체크는 없다 — Pick 탭에서 오면 빈 채로, 업체 상세에서 오면 고정 업체 하나만. */
  const [selected, setSelected] = useState<Set<string>>(() => new Set(fixed ? [fixed] : []));

  const load = useCallback(() => {
    setError(null);
    setOptions(null);
    getCurrentUser()
      .then(async (me) => {
        if (!me.weddingId) throw new Error('결혼 정보가 없어요.');

        const [res, fixedVendor] = await Promise.all([
          listCandidates(me.weddingId),
          /* 고정 업체 요약. 못 읽어도 비교는 막지 않는다 — 이름은 파라미터로도 온다. */
          fixed ? getVendor(fixed).catch(() => null) : Promise.resolve(null),
        ]);

        /* 업종은 파라미터가 먼저, 없으면 고정 업체의 업종을 따른다. */
        const groupCategory = category ?? fixedVendor?.category ?? null;
        const group = res.groups.find((g) => g.category === groupCategory);
        const candidates = group?.candidates ?? [];

        const rest = candidates
          .filter((c) => c.vendorId !== fixed)
          .map((c) => fromCandidate(c, false));

        let head: CompareOption[] = [];

        if (fixed) {
          const inCandidates = candidates.find((c) => c.vendorId === fixed);

          head = [
            inCandidates
              ? fromCandidate(inCandidates, true)
              : {
                  vendorId: fixed,
                  vendorName: fixedVendor?.name ?? fixedName ?? '고른 업체',
                  category: fixedVendor?.category ?? groupCategory,
                  region: fixedVendor?.region ?? null,
                  addedByPartner: false,
                  locked: true,
                },
          ];
        }

        setOptions([...head, ...rest]);
      })
      .catch((e: Error) => setError(e.message));
  }, [category, fixed, fixedName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /* 결과 화면에서 뒤로 오면 시트를 다시 올린다 — 비교를 시작할 때 내려놓았기 때문이다. */
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
    }, [])
  );

  /* 시트를 닫는 것은 «연 자리로 되돌아가기»라 History Back이다. 되돌아갈 곳이 없을 때만
     Depth Back 규칙이 한 단계 위(Pick 탭)로 내려놓는다. */
  function dismiss() {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else depthBack();
  }

  if (error) {
    return (
      <ErrorView
        title="후보를 불러오지 못했어요"
        message={error}
        onRetry={load}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  function toggle(option: CompareOption) {
    if (option.locked) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option.vendorId)) {
        next.delete(option.vendorId);
      } else if (next.size < MAX_COMPARE) {
        next.add(option.vendorId);
      }
      return next;
    });
  }

  function startCompare() {
    /* 고정 업체가 A — 결과 화면의 A·B·C 순서는 ids 순서다. */
    const ordered = [
      ...(fixed && selected.has(fixed) ? [fixed] : []),
      ...Array.from(selected).filter((id) => id !== fixed),
    ];

    /*
     * 시트를 먼저 내린다 — 이 화면이 스택에 남아 있는 동안 Modal 시트가 결과 위에 그대로 떠
     * 있지 않게. 결과에서 뒤로 오면 useFocusEffect가 다시 올린다.
     */
    setVisible(false);
    router.push({ pathname: '/search/compare', params: { ids: ordered.join(',') } });
  }

  const canCompare = selected.size >= MIN_COMPARE;
  /* 고정 업체 하나뿐이면 고를 후보가 없는 것이다. */
  const nothingToPick = options !== null && options.filter((o) => !o.locked).length === 0;

  return (
    <ThemedView style={styles.container}>
      <BottomSheet visible={visible} onRequestClose={dismiss}>
        <SheetPanel>
          <View style={styles.headline}>
            <ThemedText type="t3">{TITLE}</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">{fixed ? BODY_FIXED : BODY}</ThemedText>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {options === null ? (
              <>
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </>
            ) : (
              <>
                {options.map((o) => {
                  const isSelected = selected.has(o.vendorId);
                  const isDisabled = !isSelected && selected.size >= MAX_COMPARE;
                  return (
                    <CandidateRow
                      key={o.vendorId}
                      option={o}
                      isSelected={isSelected}
                      isDisabled={isDisabled}
                      onToggle={() => toggle(o)}
                    />
                  );
                })}
                {nothingToPick ? (
                  <View style={[styles.empty, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="t6" themeColor="textSecondary">{EMPTY_TITLE}</ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive">{EMPTY_BODY}</ThemedText>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          {/* Primary CTA 52 — 2~3곳일 때만 산다. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCompare }}
            disabled={!canCompare}
            onPress={startCompare}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: theme.tint, opacity: !canCompare ? 0.4 : pressed ? 0.8 : 1 },
            ]}>
            <ThemedText type="t5" themeColor="onTint">
              {`${Math.max(selected.size, MIN_COMPARE)}곳 비교`}
            </ThemedText>
          </Pressable>
        </SheetPanel>
      </BottomSheet>
    </ThemedView>
  );
}

function CandidateRow({
  option: o,
  isSelected,
  isDisabled,
  onToggle,
}: {
  option: CompareOption;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const meta = [
    o.region,
    o.category ? (VENDOR_CATEGORY_LABEL[o.category as VendorCategory] ?? o.category) : null,
    o.addedByPartner ? '둘 다 고른 곳' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onToggle}
      disabled={isDisabled || o.locked}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled || o.locked }}
      accessibilityLabel={o.locked ? `${o.vendorName} · 고정` : o.vendorName}>
      {(state) => {
        const { hovered, focused } = readWebInteractionState(state);
        return (
          <View>
            <View
              style={[
                styles.row,
                isDisabled && styles.rowDisabled,
                !isDisabled && !o.locked && hovered ? { backgroundColor: theme.backgroundSelected } : null,
                focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
              ]}>
              {o.locked ? (
                /* A 고정 — 업체 상세에서 온 기준 업체. 시안 keyChip 22 · radius 4. */
                <View style={[styles.keyChip, { backgroundColor: theme.tint }]}>
                  <ThemedText type="t7" themeColor="onTint" style={styles.bold}>A</ThemedText>
                </View>
              ) : null}
              <View style={styles.rowBody}>
                <ThemedText type="t5" numberOfLines={1}>{o.vendorName}</ThemedText>
                {meta ? (
                  <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>{meta}</ThemedText>
                ) : null}
              </View>
              {/* 체크 24 원 — 골랐으면 coral 채움 */}
              <View
                style={[
                  styles.check,
                  isSelected
                    ? { backgroundColor: theme.tint }
                    : { borderWidth: CHECK_BORDER, borderColor: theme.track },
                ]}>
                {isSelected ? <ProductSymbol name="check" size={Layout.iconChipClose} color={theme.onTint} /> : null}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          </View>
        );
      }}
    </Pressable>
  );
}

/** 시안 키 칩 22 · 체크 테두리 1.5 — Layout에 이름이 없는 값. 체크 한 변은 Layout.checkbox(24). */
const CHECK_BORDER = 1.5;
const KEY_CHIP = 22;
/** 시트 안 목록 최대 높이 — 시안 필터 시트의 440. */
const LIST_MAX_HEIGHT = 440;

const styles = StyleSheet.create({
  container: { flex: 1 },
  headline: { gap: Layout.sheetHeadGap },
  list: { maxHeight: LIST_MAX_HEIGHT, flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  rowBody: { flex: 1, minWidth: 0, gap: Spacing.half },
  rowDisabled: { opacity: 0.4 },
  keyChip: {
    width: KEY_CHIP,
    height: KEY_CHIP,
    borderRadius: Radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bold: { fontWeight: 700 },
  check: {
    width: Layout.checkbox,
    height: Layout.checkbox,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },
  empty: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.one,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  cta: {
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
