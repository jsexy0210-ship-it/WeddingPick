import type { CandidateListResponse } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, getVendor, listCandidates } from '@/api/client';

/**
 * 비교 후보 선택. WP-CMP-001(v3.22 SPEC 13.11).
 *
 * 비교 화면은 WP-CMP-002 하나이고, 진입에 따라 **후보 초기값**만 다르다.
 *
 *   Pick 탭에서    그 업종의 내 후보만 · 아무것도 체크되지 않은 채 2~3곳을 고른다
 *   업체 상세에서  `fixed`(vendorId)를 A로 고정 · 맨 앞 · 해제 불가 · B·C는 같은 업종 후보
 *
 * 고정 업체가 내 후보에 없어도 비교는 된다 — 업체 상세에서 온 사람은 그 업체를
 * 견주고 싶은 것이지 담고 싶은 것이 아니다. 업체 요약을 읽어 오고, 못 읽으면
 * `fixedName`으로 이름만 보여준다. 후보를 바꾸는 건 이 시트에서만 하고, 결과
 * 화면(`/search/compare?ids=…`) 안에서는 교체하지 않는다.
 */

const MAX_COMPARE = 3;
const MIN_COMPARE = 2;

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

function CandidateRowSkeleton() {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Skeleton height={19} width="60%" />
      <Skeleton height={15} width="35%" style={{ marginTop: 4 }} />
    </ThemedView>
  );
}

export default function PickCompareScreen() {
  const { category, fixed, fixedName } = useLocalSearchParams<{
    category?: string;
    /** 업체 상세에서 온 경우 — A로 고정할 업체. */
    fixed?: string;
    /** 고정 업체의 요약을 못 읽었을 때 보여줄 이름. */
    fixedName?: string;
  }>();

  const [options, setOptions] = useState<CompareOption[] | null>(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
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

        setCategoryLabel(
          groupCategory
            ? (VENDOR_CATEGORY_LABEL[groupCategory as VendorCategory] ?? groupCategory)
            : ''
        );
        setOptions([...head, ...rest]);
      })
      .catch((e: Error) => setError(e.message));
  }, [category, fixed, fixedName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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

    router.push({ pathname: '/search/compare', params: { ids: ordered.join(',') } });
  }

  const canCompare = selected.size >= MIN_COMPARE;
  /* 고정 업체 하나뿐이면 고를 후보가 없는 것이다. */
  const nothingToPick = options !== null && options.filter((o) => !o.locked).length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 안내 */}
          <ThemedView style={styles.header}>
            <ThemedText type="t2">{categoryLabel ? `${categoryLabel} 비교` : '비교'}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {fixed ? '같은 업종 후보에서 1~2곳을 더 골라주세요' : '같은 업종에서 2~3곳까지'}
            </ThemedText>
          </ThemedView>

          {/* 로딩 */}
          {options === null ? (
            <>
              <CandidateRowSkeleton />
              <CandidateRowSkeleton />
              <CandidateRowSkeleton />
            </>
          ) : nothingToPick ? (
            <>
              {options.map((o) => (
                <CandidateRow
                  key={o.vendorId}
                  option={o}
                  isSelected={selected.has(o.vendorId)}
                  isDisabled={false}
                  onToggle={() => toggle(o)}
                />
              ))}
              <ThemedView type="backgroundElement" style={styles.empty}>
                <ThemedText type="t6" themeColor="textSecondary">
                  비교할 후보가 없어요
                </ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  먼저 이 업종에서 업체를 Pick해주세요.
                </ThemedText>
              </ThemedView>
            </>
          ) : (
            options.map((o) => {
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
            })
          )}

          {/* Primary CTA — 2~3곳일 때만 산다. */}
          <ThemedView style={styles.cta}>
            <ActionButton
              variant="primary"
              size="xlarge"
              label={canCompare ? `${selected.size}곳 비교하기` : '2곳 이상 골라주세요'}
              disabled={!canCompare}
              onPress={startCompare}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
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
    o.category ? (VENDOR_CATEGORY_LABEL[o.category as VendorCategory] ?? o.category) : null,
    o.region,
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
          <ThemedView
            type="backgroundElement"
            style={[
              styles.row,
              isSelected && { borderColor: theme.tint, borderWidth: 1.5 },
              isDisabled && styles.rowDisabled,
              !isDisabled && !o.locked && hovered ? { backgroundColor: theme.backgroundSelected } : null,
              focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
            ]}
          >
            <View style={styles.rowContent}>
              <View style={styles.nameRow}>
                {o.locked ? (
                  /* A 고정 — 업체 상세에서 온 기준 업체. */
                  <View style={[styles.fixedBadge, { backgroundColor: theme.tint }]}>
                    <ThemedText type="badge" style={[styles.bold, { color: theme.onTint }]}>
                      A
                    </ThemedText>
                  </View>
                ) : null}
                <ThemedText type="t6" numberOfLines={1} style={styles.name}>
                  {o.vendorName}
                </ThemedText>
              </View>
              {meta ? (
                <ThemedText type="t7" themeColor="textSecondary" numberOfLines={1}>
                  {meta}
                </ThemedText>
              ) : null}
              {o.addedByPartner ? (
                <ThemedText type="tab" themeColor="positive">
                  배우자도 고른 곳
                </ThemedText>
              ) : null}
            </View>
            {/* 선택 인디케이터 */}
            <View
              style={[
                styles.check,
                { borderColor: isSelected ? theme.tint : theme.border },
                isSelected && { backgroundColor: theme.tint },
              ]}
            />
          </ThemedView>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.one,
    paddingTop: Layout.sectionGap,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    minHeight: Layout.rowMinHeight,
  },
  rowContent: { flex: 1, gap: Spacing.half },
  rowDisabled: { opacity: 0.4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flexShrink: 1 },
  /* A 배지 — 20 · radius 4. */
  fixedBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bold: { fontWeight: '700' },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  empty: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.one,
    alignItems: 'center',
  },
  cta: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
});
