/**
 * Pick — Pick한 업체 목록. WP-PICK-001.
 *
 * v3.29.1 정본 `docs/design/React_Native/pick.jsx` frame-001을 따른다. 헤더(«Pick») → 업종 칩 →
 * 비교 배너(2곳 이상 담으면 «N곳 담았어요 · 비교하기») → 카드 목록.
 * 카드는 검색 결과와 같은 틀(썸네일 104×116 · 정보 안쪽 14)이고 아래에 CTA 띠가 붙는다.
 *
 * **v3.29 대조로 정한 것.**
 * - Pick 탭 안에 «추천 · 내 Pick»(Figma 원본) 같은 상단 탭을 두지 않는다 — v3.29 diffs
 *   «탭 구성»이 명시한다. 추천 → 비교 → 결정이 한 화면에서 끝난다. 준비 현황(웨딩픽 추천)은
 *   홈에서만 들어오는 별도 화면이라 `/pick?section=recommendations` 딥링크만 받아 그린다
 *   (홈의 `(home)/recommendations.tsx`가 그리로 보낸다).
 * - Pick = 후보 담기 · 최종 결정은 별도(v3.29 diffs «Pick 의미»). 최종 결정은 확인 시트
 *   (`/pick/confirm`)에서 저장하고, 서버가 결정 상태로 돌려준 후보에서만 상담 예약으로 이어진다.
 *   후보 담기만으로 예약할 수 없다(v3.29 diffs «상담 진입»).
 * - 카드 CTA는 Primary 1개(«결정하기»)이고 비교는 텍스트 링크(«비교에 담기»)다(v3.29 diffs
 *   «카드 CTA» — 화면당 Primary 1개).
 * - 삭제(WP-PICK-008)는 확인 시트 없이 «빼기»로 즉시 지우고 «되돌리기» 토스트만 띄운다.
 *
 * **정본을 그대로 옮기지 않은 것.**
 * - 카드의 태그 · 제보 금액 · 실 제보 건수는 서버가 후보에 주지 않는다
 *   (`vendorCandidateSchema`) — 만들어 넣지 않는다. 그 자리에는 후보 메모(`note`)가 있으면 적는다.
 * - 배지 «인기»는 우리 값이 없다. 같은 자리에 **«함께»**(배우자도 고른 곳)를 세운다.
 * - 결정 취소는 되돌릴 수 있는 조작이라 한 번 더 묻는다(위험한 조작).
 * - **별점은 다르다**(v3.28 2026-09-23 「후기 별점 UI를 되살린다」) — `vendorCandidateSchema`에
 *   추가됐다. 검색·상세와 같은 관문(`scored_reviews`)에서 오고, 확인된 후기가 모자라거나
 *   체크리스트 업종(결정사)이면 null이라 그때 카드는 별점 줄을 안 그린다.
 */
import type { CandidateListResponse, CurrentUser, VendorCandidate } from '@weddingpick/api-contract';
import {
  TERMS,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  withParticle,
  type VendorCategory,
  regionLabel,
} from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Border,
  Layout,
  LetterSpacing,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  RatingStars,
  Spacing,
  ThemedText,
  ThemedView,
  VendorImage,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import {
  addCandidate,
  decideCategory,
  getCurrentUser,
  listCandidates,
  removeCandidate,
  removeDecision,
} from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { DialogToast } from '@/components/confirm-alert-toast';
import { showResultToast } from '@/features/navigation/result-toast';
import {
  PICK_COMPARE_ADD_LABEL,
  PICK_COMPARE_BANNER_HINT,
  PICK_COMPARE_MAX,
  PICK_COMPARE_REMOVE_LABEL,
  compareBasketLabel,
} from '@/features/pick/canonical-rules';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';
import { RecommendationsContent } from '../(home)/recommendations';

/* 문구 — spec/strings.ko.json `pick` · features/pick/canonical-rules. */
const COMPARE_HINT = PICK_COMPARE_BANNER_HINT;
const COMPARE_ALL = '비교하기';
const CHIP_ALL = '전체';
const ACTION_COMPARE = PICK_COMPARE_ADD_LABEL;
const ACTION_COMPARING = PICK_COMPARE_REMOVE_LABEL;
const ACTION_DECIDE = '결정하기';
const ACTION_UNDECIDE = '결정 취소';
const ACTION_CONSULT = '상담 예약하기';
const BADGE_SHARED = '함께';
const EMPTY_TITLE = '아직 담은 곳이 없어요';
const EMPTY_BODY = '담아두면 여기서 비교할 수 있어요';
const EMPTY_CTA = '추천 보기';
const UNDECIDE_TITLE = '결정을 취소할까요?';
const UNDECIDE_BODY = '웨딩노트의 결정 상태가 풀려요. 언제든 다시 결정할 수 있어요.';
const MIN_COMPARE = 2;
/** 정본 catMeta — «3개 · 최신순». */
function groupMetaLabel(count: number): string {
  return `${count}개 · 최신순`;
}

type Filter = VendorCategory | 'all';

type Row = {
  candidate: VendorCandidate;
  /** 이 업종이 결정됐는가. */
  groupDecided: boolean;
  /** 이 후보가 그 결정인가. */
  isDecided: boolean;
};

type UndoCandidate = {
  candidate: VendorCandidate;
  /** 후보 삭제의 FK cascade로 같이 풀린 최종 결정을 되살려야 하는가. */
  wasDecided: boolean;
};

export default function PickScreen() {
  const { section: sectionParam, category: categoryParam } = useLocalSearchParams<{
    section?: string | string[];
    category?: string | string[];
  }>();
  const requestedSection = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
  const rawCategory = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
  const requestedCategory =
    rawCategory && VENDOR_CATEGORIES.includes(rawCategory as VendorCategory)
      ? (rawCategory as VendorCategory)
      : null;
  /* 홈의 «웨딩픽 추천» 딥링크만 받는다. Pick 탭 자체에는 상단 탭이 없다(v3.29 diffs «탭 구성»). */
  const showRecommendations = requestedSection === 'recommendations';
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  /** 비교함에 담은 업체(vendorId). 최대 PICK_COMPARE_MAX. */
  const [compare, setCompare] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [undoCandidate, setUndoCandidate] = useState<UndoCandidate | null>(null);

  const load = useCallback(() => {
    // 하이브리드 웹뷰 쉘 POC로 이 화면을 대체할 때는 이 밑 자료를 안 쓴다 —
    // 훅 순서를 지키려고 호출 자체는 남기고, 몸통만 건너뛴다.
    if (isWebShellScreen('pick')) return;

    getCurrentUser()
      .then(async (current) => {
        setError(null);
        setMe(current);
        setPage(current.weddingId ? await listCandidates(current.weddingId) : null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  /* 결정 시트에서 돌아오면 목록이 바뀌어 있다 — 화면에 올 때마다 다시 읽는다. */
  useFocusEffect(load);

  // 하이브리드 웹뷰 쉘 POC. `EXPO_PUBLIC_WEBSHELL_SCREENS`에 "pick"이 없으면
  // (기본값) 이 분기는 타지 않고 기존 네이티브 화면 그대로다.
  if (isWebShellScreen('pick')) {
    return <WebShellView path="/pick" />;
  }

  const rows: Row[] = (page?.groups ?? []).flatMap((group) =>
    group.candidates.map((candidate) => ({
      candidate,
      groupDecided: group.state === 'decided',
      isDecided: group.decidedVendorId === candidate.vendorId,
    }))
  );
  /* 칩은 후보가 있는 업종만, 그룹 순서대로. 목록도 같은 묶음이다 — 정본 1번 화면은 업종별로
     «{업종} · N개 · 최신순» 머리를 두고 그 아래 카드를 쌓는다(서버가 added_at DESC로 준다). */
  const groups = (page?.groups ?? []).filter((group) => group.candidates.length > 0);
  const categories = groups.map((group) => group.category);
  const visibleGroups = filter === 'all' ? groups : groups.filter((group) => group.category === filter);
  const weddingId = me?.weddingId ?? null;

  function showToast(message: string, undo: UndoCandidate | null = null) {
    if (!undo) {
      showResultToast(message);
      return;
    }
    setUndoCandidate(undo);
    setToast(message);
  }

  function toggleCompare(vendorId: string) {
    if (!compare.has(vendorId) && compare.size >= PICK_COMPARE_MAX) {
      showToast(`한 번에 ${PICK_COMPARE_MAX}곳까지 비교할 수 있어요`);
      return;
    }
    setCompare((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else if (next.size < PICK_COMPARE_MAX) next.add(vendorId);
      return next;
    });
  }

  function startCompare() {
    router.push({ pathname: '/search/compare', params: { ids: Array.from(compare).join(',') } });
  }

  /** 최종 결정은 확인 시트(`/pick/confirm`)가 한다 — 여기서 먼저 결정 기록을 만들지 않는다. */
  function goDecide(candidate: VendorCandidate) {
    router.push({
      pathname: '/pick/confirm',
      params: {
        category: candidate.category,
        vendorId: candidate.vendorId,
        vendorName: candidate.vendorName,
        shared: candidate.addedByPartner ? '1' : '0',
      },
    });
  }

  /** 결정 취소는 되돌릴 수 있는 조작이라 DLG-B 확인을 쓴다. */
  function askUndecide(candidate: VendorCandidate) {
    confirmAlert(UNDECIDE_TITLE, UNDECIDE_BODY, [
      { text: '그대로 둘게요', style: 'cancel' },
      { text: ACTION_UNDECIDE, onPress: () => undecide(candidate.category) },
    ]);
  }

  async function undecide(category: VendorCategory) {
    if (!weddingId) return;
    setBusy(true);
    try {
      await removeDecision(weddingId, category);
      setPage((current) => current && ({
        ...current,
        groups: current.groups.map((group) => group.category === category
          ? { ...group, state: 'picking' as const, decidedVendorId: null }
          : group),
      }));
      showToast('결정을 취소했어요');
      load();
    } catch {
      showToast('결정을 취소하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  /** 삭제(WP-PICK-008) — 확인 시트 없이 즉시 빼고 «되돌리기» 토스트만 띄운다. */
  async function unpick(row: Row) {
    const { candidate, isDecided: wasDecided } = row;
    if (!weddingId || busy) return;
    setBusy(true);
    try {
      await removeCandidate(weddingId, candidate.id);
      setPage((current) => current && ({
        ...current,
        total: Math.max(0, current.total - 1),
        groups: current.groups.map((group) => {
          if (group.category !== candidate.category) return group;
          const remaining = group.candidates.filter((item) => item.id !== candidate.id);
          return {
            ...group,
            candidates: remaining,
            comparable: remaining.length >= MIN_COMPARE,
            ...(wasDecided ? { state: 'picking' as const, decidedVendorId: null } : {}),
          };
        }),
      }));
      if (filter === candidate.category && page?.groups.find((group) => group.category === filter)?.candidates.length === 1) {
        setFilter('all');
      }
      setCompare((prev) => {
        const next = new Set(prev);
        next.delete(candidate.vendorId);
        return next;
      });
      showToast(`${withParticle(candidate.vendorName, '을를')} 뺐어요`, { candidate, wasDecided });
      load();
    } catch {
      showToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function undoUnpick(target: UndoCandidate) {
    if (!weddingId) return;
    const { candidate, wasDecided } = target;
    let candidateRestored = false;
    setBusy(true);
    try {
      const { candidateId } = await addCandidate(weddingId, candidate.vendorId, candidate.note ?? undefined);
      candidateRestored = true;
      setPage((current) => current && ({
        ...current,
        total: current.total + 1,
        groups: current.groups.map((group) => group.category === candidate.category
          ? {
              ...group,
              candidates: [{ ...candidate, id: candidateId, addedAt: new Date().toISOString(), addedByPartner: false }, ...group.candidates],
              comparable: group.candidates.length + 1 >= MIN_COMPARE,
            }
          : group),
      }));
      if (wasDecided) {
        await decideCategory(weddingId, {
          category: candidate.category,
          vendorId: candidate.vendorId,
        });
        setPage((current) => current && ({
          ...current,
          groups: current.groups.map((group) => group.category === candidate.category
            ? { ...group, state: 'decided' as const, decidedVendorId: candidate.vendorId }
            : group),
        }));
      }
      showToast(wasDecided ? 'Pick과 결정을 되돌렸어요' : '다시 Pick했어요');
    } catch {
      showToast(
        candidateRestored && wasDecided
          ? '다시 Pick했지만 결정을 복구하지 못했어요.'
          : '다시 Pick하지 못했어요. 잠시 후 다시 시도해주세요.'
      );
    } finally {
      load();
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          {showRecommendations ? (
            <RecommendationsContent requestedCategory={requestedCategory} />
          ) : error ? (
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={styles.errorBox}>
                <ThemedText type="t2">불러오지 못했어요</ThemedText>
                <ThemedText type="t6" themeColor="textSecondary">
                  {error}
                </ThemedText>
                <RetryLink onPress={load} />
              </View>
            </ScrollView>
          ) : !me ? (
            <View style={styles.loadingCenter}>
              <DelayedLoader size={40} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <Header />

              {/* 비교 배너 — 피그마 `compareIds.length >= 2`: 잉크 면 · radius 16 · 안쪽 16/14. */}
              {compare.size >= MIN_COMPARE ? (
                <View style={[styles.compareBanner, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
                  <View style={styles.compareText}>
                    <ThemedText type="t7" themeColor="tint" style={styles.bold}>
                      {compareBasketLabel(compare.size)}
                    </ThemedText>
                    <View style={styles.compareHint}>
                      <ThemedText type="micro" themeColor="textSecondary" style={styles.regular}>
                        {COMPARE_HINT}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={COMPARE_ALL}
                    onPress={startCompare}
                    style={({ pressed }) => [
                      styles.compareBtn,
                      { backgroundColor: theme.tint },
                      pressed ? styles.pressed : null,
                    ]}>
                    <ThemedText type="t7" style={[styles.bold, { color: theme.onTint }]}>
                      {COMPARE_ALL}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {rows.length === 0 ? (
                <Empty />
              ) : (
                <>
                  {/* 업종 칩 — 피그마 `px-4 py-2.5 rounded-full text-sm font-semibold`: 40 · 좌우 16. */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipRow}>
                    <CategoryChip label={CHIP_ALL} active={filter === 'all'} onPress={() => setFilter('all')} />
                    {categories.map((category) => (
                      <CategoryChip
                        key={category}
                        label={VENDOR_CATEGORY_LABEL[category]}
                        active={filter === category}
                        onPress={() => setFilter(category)}
                      />
                    ))}
                  </ScrollView>

                  {visibleGroups.map((group) => (
                    <View key={group.category} style={styles.group}>
                      {/* 정본 catHead: 제목 18/700 · «N개 · 최신순» 13 회색 tabular. */}
                      <View style={styles.groupHead}>
                        <ThemedText type="f18" style={styles.bold}>
                          {VENDOR_CATEGORY_LABEL[group.category]}
                        </ThemedText>
                        <ThemedText type="f13" numeric themeColor="textAssistive">
                          {groupMetaLabel(group.candidates.length)}
                        </ThemedText>
                      </View>
                      <View style={styles.list}>
                        {group.candidates.map((candidate) => {
                          const row: Row = {
                            candidate,
                            groupDecided: group.state === 'decided',
                            isDecided: group.decidedVendorId === candidate.vendorId,
                          };
                          return (
                            <CandidateCard
                              key={candidate.id}
                              row={row}
                              comparing={compare.has(candidate.vendorId)}
                              compareFull={compare.size >= PICK_COMPARE_MAX}
                              busy={busy}
                              onCompare={() => toggleCompare(candidate.vendorId)}
                              onDecide={() => goDecide(candidate)}
                              onUndecide={() => askUndecide(candidate)}
                              onRemove={() => void unpick(row)}
                            />
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </>
              )}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      <DialogToast
        message={toast}
        docked
        actionLabel={undoCandidate ? '되돌리기' : null}
        onAction={undoCandidate ? () => void undoUnpick(undoCandidate) : null}
        onHidden={() => {
          setToast(null);
          setUndoCandidate(null);
        }}
      />
    </ThemedView>
  );
}

/* ────────────────────────────────────────────
   Header — v3.28 정본 1번 화면: 제목 «Pick» 한 줄뿐(rH1 28/700). «N곳» · 부제 · 배우자
   함께-보기 상자 · «Pick 인증» 고리는 정본에 없어 지웠다(2026-09-23 대표 지시 —
   정본에 없는 기능은 제거한다). Pick 인증 진입은 MY · 웨딩노트가 갖고 있다.
──────────────────────────────────────────── */
function Header() {
  return (
    <View style={styles.titleRow}>
      <ThemedText type="f28" style={[styles.bold, styles.title]}>
        {TERMS.pick}
      </ThemedText>
    </View>
  );
}

/* ────────────────────────────────────────────
   업종 칩 — 켬은 잉크 채움 · 흰 글자, 끔은 회색 면 · 보조색 글자
──────────────────────────────────────────── */
function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? theme.text : theme.backgroundElement },
        pressed ? styles.pressed : null,
      ]}>
      {/* WP-PICK-001 업종 칩: 14/700 · 높이 36 · 좌우 14. */}
      <ThemedText type="f14" numberOfLines={1} style={[styles.bold, { color: active ? theme.onInk : theme.textAssistive }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/* ────────────────────────────────────────────
   카드 — 검색 결과 카드와 같은 틀 + 아래 CTA 띠(border-top · 안쪽 12/10 · 단추 40 · radius 22)
──────────────────────────────────────────── */
function CandidateCard({
  row,
  comparing,
  compareFull,
  busy,
  onCompare,
  onDecide,
  onUndecide,
  onRemove,
}: {
  row: Row;
  comparing: boolean;
  compareFull: boolean;
  busy: boolean;
  onCompare: () => void;
  onDecide: () => void;
  onUndecide: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { candidate, groupDecided, isDecided } = row;
  const compareDisabled = !comparing && compareFull;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background,
          borderColor: isDecided ? theme.tint : theme.border,
          borderWidth: isDecided ? 1.5 : Border.hairline,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${candidate.vendorName} 자세히 보기`}
        onPress={() => router.push(`/search/${candidate.vendorId}`)}
        style={styles.cardBody}>
        <View style={styles.thumbCol}>
          <VendorImage
            source={candidate.imageUrl ? { uri: candidate.imageUrl } : undefined}
            category={vendorImageCategory(candidate.category)}
            width={Layout.thumbSearchWidth}
            height={Layout.thumbSearchHeight}
            radius={Radius.thumb}
          />
          {candidate.addedByPartner ? (
            <View style={[styles.badge, { backgroundColor: theme.text }]}>
              <ThemedText type="f10" style={[styles.bold, { color: theme.onInk }]}>
                {BADGE_SHARED}
              </ThemedText>
            </View>
          ) : null}
          {/* 결정 완료 상태 — 03-pick 정본: 코랄 테두리 + 썸네일 우상단 체크. */}
          {isDecided ? (
            <View style={[styles.decidedCheck, { backgroundColor: theme.tint }]}>
              <ProductSymbol name="check" size={Layout.iconSmall} color={theme.onTint} />
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <View style={styles.headRow}>
            <View style={styles.headText}>
              {/* 규격서: 업종 «10/700 #868B94 · lh 15 · ls 0.5px» · 이름 «16/700 · lh 22 · mar 2 0 0 0». */}
              <ThemedText type="f10" themeColor="textAssistive" style={[styles.bold, styles.tracked]}>
                {VENDOR_CATEGORY_LABEL[candidate.category]}
              </ThemedText>
              <ThemedText type="f16" numberOfLines={1} style={[styles.bold, styles.name]}>
                {candidate.vendorName}
              </ThemedText>
            </View>
            {/* × — 후보에서 즉시 뺀다(WP-PICK-008). 되돌리기는 토스트가 맡는다. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${candidate.vendorName} 빼기`}
              hitSlop={Spacing.two}
              onPress={onRemove}
              style={styles.removeBtn}>
              <View style={styles.removeIcon}>
                <ProductSymbol name="close" size={Layout.iconField} color={theme.textAssistive} />
              </View>
            </Pressable>
          </View>
          <View style={styles.location}>
            <ProductSymbol name="pin" size={Layout.iconMicro} color={theme.textAssistive} />
            {/* 규격서: 지역 «12/400 #868B94 · lh 16 · mar 6 0 0 0». */}
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>
              {regionLabel(candidate.region)}
            </ThemedText>
          </View>
          {/* 후기 별점은 최신 CLAUDE.md의 미해결 예외에 따라 유지한다. */}
          {candidate.rating ? (
            <RatingStars value={candidate.rating.average} count={candidate.rating.count} />
          ) : null}
          {candidate.note ? (
            /* 규격서 해시태그 줄 자리 «10/500 #868B94 · lh 15 · mar 8 0 0 0». */
            <ThemedText type="f10" themeColor="textAssistive" numberOfLines={1} style={[styles.medium, styles.note]}>
              {candidate.note}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>

      <View style={[styles.ctaStrip, { borderTopColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={isDecided ? undefined : { selected: comparing, disabled: compareDisabled }}
          accessibilityLabel={`${candidate.vendorName} ${isDecided ? ACTION_UNDECIDE : comparing ? ACTION_COMPARING : ACTION_COMPARE}`}
          disabled={isDecided ? busy : compareDisabled}
          onPress={isDecided ? onUndecide : onCompare}
          style={({ pressed }) => [
            styles.compareLink,
            !isDecided && compareDisabled ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}>
          <ThemedText
            type="f12"
            style={[
              styles.bold,
              { color: isDecided ? theme.textAssistive : comparing ? theme.tint : compareDisabled ? theme.textDisabled : theme.textAssistive },
            ]}>
            {isDecided ? ACTION_UNDECIDE : comparing ? ACTION_COMPARING : ACTION_COMPARE}
          </ThemedText>
        </Pressable>

        {isDecided ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.vendorName} ${ACTION_CONSULT}`}
            disabled={busy}
            onPress={() => router.push({ pathname: '/search/[vendorId]/consult', params: { vendorId: candidate.vendorId } })}
            style={({ pressed }) => [
              styles.decisionCta,
              { backgroundColor: theme.tint, borderColor: theme.tint },
              pressed ? styles.pressed : null,
              busy ? styles.busy : null,
            ]}>
            <ThemedText type="f12" style={[styles.bold, { color: theme.onTint }]}>
              {ACTION_CONSULT}
            </ThemedText>
          </Pressable>
        ) : !groupDecided ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.vendorName} ${ACTION_DECIDE}`}
            onPress={onDecide}
            style={({ pressed }) => [
              styles.decisionCta,
              { backgroundColor: theme.background, borderColor: theme.border },
              pressed ? styles.pressed : null,
            ]}>
            <ThemedText type="f12" style={[styles.bold, { color: theme.text }]}>
              {ACTION_DECIDE}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* WP-EMPTY-PICK — 아이콘 없는 회색 카드와 다음 행동. */
function Empty() {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <ThemedText type="f18" style={styles.bold}>담은 곳</ThemedText>
      <View style={styles.emptyCard}>
        <ThemedText type="f16" style={[styles.bold, styles.emptyText]}>
          {EMPTY_TITLE}
        </ThemedText>
        <ThemedText type="f13" themeColor="textAssistive" style={styles.emptyText}>
          {EMPTY_BODY}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={EMPTY_CTA}
          onPress={() => router.push({ pathname: '/pick', params: { section: 'recommendations' } })}
          style={({ pressed }) => [styles.emptyCta, { backgroundColor: theme.tint }, pressed ? styles.pressed : null]}>
          <ThemedText type="f15" style={[styles.bold, { color: theme.onTint }]}>{EMPTY_CTA}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function RetryLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(state) => {
        const { focused } = readWebInteractionState(state);
        return focused
          ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 }
          : null;
      }}>
      {(state) => {
        const { hovered } = readWebInteractionState(state);
        return (
          <ThemedText type="t6" style={{ color: theme.tint, textDecorationLine: hovered ? 'underline' : 'none' }}>
            다시 시도
          </ThemedText>
        );
      }}
    </Pressable>
  );
}

/* ────────────────────────────────────────────
   스타일 — 값은 피그마 `Pick.tsx`(2026-09-14 정본). 12 · 14 · 20 · 40처럼 사다리에 없는
   값은 같은 값의 기존 토큰을 주석과 함께 쓴다(저장소 관례).
──────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  wrapper: { flex: 1, width: '100%' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1 },
  errorBox: { padding: Layout.gutter, gap: Layout.rowPaddingY },
  /* 바깥 `pb-8` = 32. */
  bottomSpacer: { height: Spacing.five },

  bold: { fontWeight: 700 },
  /* 규격서의 굵기 600 · 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  semibold: { fontWeight: 600 },
  medium: { fontWeight: 500 },
  regular: { fontWeight: 400 },
  /* 규격서 «ls 0.5px» — 업종 라벨. */
  tracked: { letterSpacing: LetterSpacing.p05 },
  /* WP-PICK-001 Root 제목은 28/700, 전역 좌우 거터는 24. */
  title: { letterSpacing: LetterSpacing.n065 },
  pressed: { transform: [{ scale: 0.97 }] },
  busy: { opacity: 0.6 },
  /* 비교함이 찼을 때의 «비교하기» `opacity-40`. */
  disabled: { opacity: 0.4 },

  /* Root 제목행: Back 없음 · 56 · 좌우 24. */
  titleRow: {
    height: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Layout.listGap,
  },
  /* 업종 묶음 — 정본 catGroupSec: 머리 + 카드 목록, 묶음 사이 20. */
  group: { gap: Layout.inlineGap, marginBottom: Layout.sectionGap },
  groupHead: {
    paddingHorizontal: Layout.pageX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },

  // ── WP-PICK-001 비교 배너: mx 24 · mb 16 · radius 10 · px 16 · py 14 ──
  compareBanner: {
    marginHorizontal: Layout.gutter,
    borderWidth: Border.hairline,
    marginBottom: Spacing.three,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    /* 상하 14 — 같은 값의 fieldPaddingX. */
    paddingVertical: Layout.fieldPaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  compareText: { flex: 1, minWidth: 0 },
  /* 부제 `mt-0.5 text-white/50`. */
  compareHint: { marginTop: Spacing.half, opacity: 0.5 },
  /* 03-pick bannerBtn: height 36 · radius 6 · px 16. */
  compareBtn: {
    height: Layout.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
  },

  // ── 업종 칩 `gap-2 px-5 pb-4` ──
  /* 세로 스크롤 안의 가로 스크롤 — 늘어나지 않게 잡는다. 안 잡으면 칩 줄이 남는 높이를 다 먹는다. */
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.three,
  },
  /* WP-PICK-001 업종 칩: 높이 36 · 좌우 14. */
  chip: {
    height: Layout.chip,
    paddingHorizontal: Layout.chipPaddingX,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 카드 목록 `space-y-3 px-5` — 카드 사이 12 ──
  /* 규격서 「div 430×884 pad 0 20 0 20」. */
  list: {
    paddingHorizontal: Layout.pageX,
    gap: Layout.inlineGap,
  },
  /* 03-pick card: radius 10 · hairline border · shadow 없음. */
  card: {
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    overflow: 'hidden',
  },
  cardBody: { flexDirection: 'row' },
  /* 왼쪽 열 `p-2` 안에 썸네일 104×116 — 열 폭 120. */
  thumbCol: { padding: Spacing.two, flexShrink: 0 },
  /* 배지 `absolute left-3.5 top-3.5 px-2 py-0.5` — 열 기준 14(같은 값의 chipPaddingX). */
  badge: {
    position: 'absolute',
    top: Layout.chipPaddingX,
    left: Layout.chipPaddingX,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  /* 03-pick 정본: 결정 완료는 썸네일 우상단 24px 코랄 체크. */
  decidedCheck: {
    position: 'absolute',
    top: Layout.inlineGap,
    right: Layout.inlineGap,
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 오른쪽 정보 `flex-1 p-3.5` — 안쪽 14(같은 값의 fieldPaddingX). */
  info: {
    flex: 1,
    minWidth: 0,
    padding: Layout.fieldPaddingX,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  headText: { flex: 1, minWidth: 0 },
  /* 규격서: 이름 «lh 22 · mar 2 0 0 0». */
  name: { marginTop: Spacing.half, lineHeight: LineHeight.lh22 },
  /* × `p-1 rounded-full`. */
  removeBtn: {
    padding: Spacing.one,
    borderRadius: Radius.pill,
    flexShrink: 0,
  },
  removeIcon: { opacity: 0.4 },
  /* 핀 + 지역 `mt-1.5 gap-1` — 위 6(같은 값의 menuGroupGap). */
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Layout.menuGroupGap,
  },
  /* 메모 — 피그마 해시태그 줄 자리 `mt-2`. */
  note: { marginTop: Spacing.two },

  /* 03-pick 정본: 비교는 텍스트 링크, 오른쪽 행동만 버튼. */
  ctaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderTopWidth: Border.hairline,
    paddingHorizontal: Layout.fieldPaddingX,
    paddingTop: Spacing.two,
    paddingBottom: Layout.iconTextGap,
  },
  compareLink: {
    minHeight: Layout.controlMedium,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionCta: {
    height: Layout.controlMedium,
    borderRadius: Radius.small,
    borderWidth: Border.hairline,
    paddingHorizontal: Layout.toastPaddingX,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // WP-EMPTY-PICK: 페이지 바깥 24px · 제목과 카드 간 12, 카드 안쪽 32/20.
  empty: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.inlineGap,
  },
  emptyCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { textAlign: 'center' },
  emptyCta: {
    marginTop: Layout.inlineGap,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
