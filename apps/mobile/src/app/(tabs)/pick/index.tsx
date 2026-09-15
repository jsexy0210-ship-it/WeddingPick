/**
 * Pick — 저장한 업체 목록. WP-PICK-001.
 *
 * 피그마 `Pick.tsx`(2026-09-14 정본 · 최상위 규칙 1)대로 그린다. 헤더(«Pick» + «N개 저장»
 * 배지 + 부제 + 배우자 함께-보기 상자) → 비교 배너(2곳 이상 고르면) → 업종 칩 → 카드 목록.
 * 카드는 검색 결과와 같은 틀(썸네일 104×116 · 정보 안쪽 14)이고 아래에 CTA 띠가 붙는다.
 *
 * 그 앞에는 루트 시안 07-pick #17a의 «13개 중 N개를 결정했어요» 진행바 + 업종별 행 목록이
 * 있었다. 피그마가 그 자리를 이긴다 — 업종별 후보 화면(`/pick/[category]`)은 그대로 있고
 * 업종 칩이 그 역할(업종으로 걸러 보기)을 이 화면 안에서 한다.
 *
 * **피그마를 그대로 옮기지 않은 것.**
 * - 카드의 해시태그 · 별점 · 저장 수 · 금액은 서버가 후보에 주지 않는다
 *   (`vendorCandidateSchema`) — 만들어 넣지 않는다. 그 자리에는 후보 메모(`note`)가 있으면 적는다.
 * - 배지 «인기 · 신규»는 우리 값이 없다. 같은 자리에 **«함께»**(배우자도 고른 곳)를 세운다.
 * - «Pick하기»는 우리 말로 **«결정하기»**다 — 이 화면의 카드는 이미 Pick(저장)한 곳이고,
 *   용어집이 Pick을 저장 행동으로 정해 두었다. 결정은 확인 시트(`/pick/confirm`)가 한다.
 * - 결정한 카드의 «상담하기»는 만들지 않는다 — 이용약관 제3조, 고지 후 구현 대기.
 *   «상담취소» 자리는 «결정 취소»이고 한 번 더 묻는다(위험한 조작).
 * - «업체 탐색하기»는 «업체 검색하기»다(«탐색»은 금지어).
 */
import type { CandidateListResponse, CurrentUser, VendorCandidate } from '@weddingpick/api-contract';
import {
  MAX_COMPARED_VENDORS,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  Border,
  Layout,
  MARK_HEART_PATH,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  VendorImage,
  readWebInteractionState,
  showAlert,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { getCurrentUser, listCandidates, removeCandidate, removeDecision } from '@/api/client';
import { UnpickSheet } from '@/features/pick/pick-sheets';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

/* 문구 — spec/strings.ko.json `pick`. 피그마 `Pick.tsx`에서 왔다. */
const SUBTITLE = '마음에 든 업체를 모아뒀어요. 하나씩 비교해봐요.';
const PRICE_REPORT = '가격 제보';
const COMPARE_HINT = '가격과 조건을 한눈에 볼 수 있어요';
const COMPARE_ALL = '전체 비교하기';
const CHIP_ALL = '전체';
const ACTION_COMPARE = '비교하기';
const ACTION_COMPARING = '비교 중';
const ACTION_DECIDE = '결정하기';
const ACTION_UNDECIDE = '결정 취소';
const BADGE_SHARED = '함께';
const EMPTY_TITLE = '아직 Pick한 업체가 없어요';
const EMPTY_BODY = '검색에서 마음에 드는 업체를 저장해봐요';
const EMPTY_CTA = `업체 ${TERMS.search}하기`;
const UNDECIDE_TITLE = '결정을 취소할까요?';
const UNDECIDE_BODY = '웨딩노트의 준비 현황과 지출에서도 빠져요';
const MIN_COMPARE = 2;

type Filter = VendorCategory | 'all';

type Row = {
  candidate: VendorCandidate;
  /** 이 업종이 결정됐는가. */
  groupDecided: boolean;
  /** 이 후보가 그 결정인가. */
  isDecided: boolean;
};

export default function PickScreen() {
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  /** 비교함에 담은 업체(vendorId). 최대 MAX_COMPARED_VENDORS. */
  const [compare, setCompare] = useState<ReadonlySet<string>>(new Set());
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
  /* 칩은 후보가 있는 업종만, 그룹 순서대로(피그마 `categories` — 저장 목록에서 뽑는다). */
  const categories = (page?.groups ?? [])
    .filter((group) => group.candidates.length > 0)
    .map((group) => group.category);
  const visible = filter === 'all' ? rows : rows.filter((row) => row.candidate.category === filter);
  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? TERMS.spouse) : null;
  const weddingId = me?.weddingId ?? null;

  function toggleCompare(vendorId: string) {
    setCompare((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else if (next.size < MAX_COMPARED_VENDORS) next.add(vendorId);
      else setToast(`한 번에 ${MAX_COMPARED_VENDORS}곳까지 비교할 수 있어요`);
      return next;
    });
  }

  function startCompare() {
    router.push({ pathname: '/search/compare', params: { ids: Array.from(compare).join(',') } });
  }

  /** 최종 결정은 확인 시트(WP-PICK-005)가 한다 — 여기서 먼저 저장하지 않는다. */
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

  /** 결정 취소 — 위험한 조작이라 한 번 더 묻는다(CLAUDE.md 최상위 규칙 5). */
  function askUndecide(candidate: VendorCandidate) {
    showAlert(UNDECIDE_TITLE, UNDECIDE_BODY, [
      { text: '돌아가기', style: 'cancel' },
      { text: ACTION_UNDECIDE, style: 'destructive', onPress: () => void undecide(candidate.category) },
    ]);
  }

  async function undecide(category: VendorCategory) {
    if (!weddingId) return;
    setBusy(true);
    try {
      await removeDecision(weddingId, category);
      load();
    } catch {
      setToast('결정을 취소하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmUnpick() {
    if (!unpickTarget || !weddingId) return;
    setBusy(true);
    try {
      await removeCandidate(weddingId, unpickTarget.id);
      setCompare((prev) => {
        const next = new Set(prev);
        next.delete(unpickTarget.vendorId);
        return next;
      });
      load();
    } catch {
      setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
      setUnpickTarget(null);
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          {error ? (
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
              <Header me={me} partner={partner} total={page?.total ?? 0} />

              {/* 비교 배너 — 피그마 `compareIds.length >= 2`: 잉크 면 · radius 16 · 안쪽 16/14. */}
              {compare.size >= MIN_COMPARE ? (
                <View style={[styles.compareBanner, { backgroundColor: theme.backgroundInk }]}>
                  <View style={styles.compareText}>
                    <ThemedText type="t7" style={[styles.bold, { color: theme.onInk }]}>
                      {`${compare.size}개 선택됨`}
                    </ThemedText>
                    <View style={styles.compareHint}>
                      <ThemedText type="micro" style={[styles.regular, { color: theme.onInk }]}>
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
                    <ProductSymbol name="chart" size={Layout.iconField} color={theme.onTint} />
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

                  <View style={styles.list}>
                    {visible.map((row) => (
                      <CandidateCard
                        key={row.candidate.id}
                        row={row}
                        comparing={compare.has(row.candidate.vendorId)}
                        compareFull={compare.size >= MAX_COMPARED_VENDORS}
                        busy={busy}
                        onCompare={() => toggleCompare(row.candidate.vendorId)}
                        onDecide={() => goDecide(row.candidate)}
                        onUndecide={() => askUndecide(row.candidate)}
                        onRemove={() => setUnpickTarget(row.candidate)}
                      />
                    ))}
                  </View>
                </>
              )}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
      <UnpickSheet
        candidate={unpickTarget}
        partnerName={partner}
        busy={busy}
        onConfirm={() => void confirmUnpick()}
        onDismiss={() => setUnpickTarget(null)}
      />
    </ThemedView>
  );
}

/* ────────────────────────────────────────────
   Header — 피그마 `px-5 pb-5 pt-6`: 제목 24/700 + «N개 저장» 배지 · 부제 14 ·
   배우자 상자(radius 16 · 회색 면 · 안쪽 16/12 · 아바타 32 둘 · «가격 제보»)
──────────────────────────────────────────── */
function Header({ me, partner, total }: { me: CurrentUser; partner: string | null; total: number }) {
  const theme = useTheme();

  return (
    <View style={styles.head}>
      <View style={styles.titleRow}>
        <ThemedText type="t3">{TERMS.pick}</ThemedText>
        <View style={[styles.countBadge, { backgroundColor: theme.text }]}>
          <ThemedText type="micro" style={[styles.bold, { color: theme.onInk }]}>
            {`${total}개 저장`}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="t7" themeColor="textAssistive">
        {SUBTITLE}
      </ThemedText>

      {/*
        함께-보기 상자는 배우자가 연결됐을 때만 선다 — 피그마의 «준혁님과 함께 보고 있어요»는
        배우자가 있는 시안값이다. «가격 제보»는 업체 무관 전역 진입이라 Pick 인증 동의 화면으로
        바로 보낸다(폐기된 가격 제보 화면을 거치지 않는다).
      */}
      {partner ? (
        <View style={[styles.partnerBox, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.partnerLeft}>
            <View style={styles.avatars}>
              <Avatar initial={me.displayName?.[0] ?? null} background={theme.text} ring={theme.backgroundElement} />
              <Avatar
                initial={partner[0] ?? null}
                background={theme.textAssistive}
                ring={theme.backgroundElement}
                overlap
              />
            </View>
            <ThemedText type="micro" numberOfLines={1} style={[styles.bold, styles.partnerText]}>
              {partnerWith(partner, '함께 보고 있어요')}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.push('/capture/payment/consent')}
            accessibilityRole="button"
            accessibilityLabel="가격 제보하기"
            style={(state) => {
              const { hovered, focused } = readWebInteractionState(state);
              return [
                styles.priceReportLink,
                hovered ? { opacity: 0.8 } : null,
                focused
                  ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 }
                  : null,
              ];
            }}>
            <ProductSymbol name="link" size={Layout.iconSmall} color={theme.tint} />
            <ThemedText type="micro" themeColor="tint" style={styles.bold}>
              {PRICE_REPORT}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** 이름 첫 글자 원 32 — 피그마 `h-8 w-8 rounded-full ring-2 ring-secondary`, 둘째는 -8 겹침. */
function Avatar({
  initial,
  background,
  ring,
  overlap = false,
}: {
  initial: string | null;
  background: string;
  ring: string;
  overlap?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: background, borderColor: ring }, overlap ? styles.avatarOverlap : null]}>
      {initial ? (
        <ThemedText type="micro" style={[styles.bold, { color: theme.onInk }]}>
          {initial}
        </ThemedText>
      ) : (
        /* 이름을 아직 안 정했으면 빈 원 대신 사람 기호. */
        <ProductSymbol name="person" size={Layout.iconField} color={theme.onInk} />
      )}
    </View>
  );
}

/**
 * «준호님과 함께 보고 있어요» · «배우자와 함께 보고 있어요». 이름을 모르면 «배우자님»이라
 * 부르지 않는다.
 */
function partnerWith(partner: string, tail: string): string {
  return partner === TERMS.spouse ? `${partner}와 ${tail}` : `${partner}님과 ${tail}`;
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
      <ThemedText type="t7" numberOfLines={1} style={[styles.bold, { color: active ? theme.onInk : theme.textAssistive }]}>
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
        { backgroundColor: theme.background, borderColor: isDecided ? theme.tintBorder : theme.border },
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
              <ThemedText type="micro" style={[styles.bold, { color: theme.onInk }]}>
                {BADGE_SHARED}
              </ThemedText>
            </View>
          ) : null}
          {/* 결정한 곳 — 피그마 `isConfirmed`: 썸네일 위 어두운 막 + 체크 원 28. */}
          {isDecided ? (
            <View style={[styles.decidedOverlay, { backgroundColor: theme.scrimLight }]}>
              <ProductSymbol name="checkCircle" size={Layout.pickCircle} color={theme.onInk} />
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <View style={styles.headRow}>
            <View style={styles.headText}>
              <ThemedText type="micro" themeColor="textAssistive" style={styles.bold}>
                {VENDOR_CATEGORY_LABEL[candidate.category]}
              </ThemedText>
              <ThemedText type="t6" numberOfLines={1} style={[styles.bold, styles.name]}>
                {candidate.vendorName}
              </ThemedText>
            </View>
            {/* × — 후보에서 뺀다. 피그마 `text-muted-foreground/40 p-1`. 실제 빼기는 UnpickSheet가 묻는다. */}
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
            <ThemedText type="micro" themeColor="textAssistive" numberOfLines={1} style={styles.regular}>
              {candidate.region}
            </ThemedText>
          </View>
          {candidate.note ? (
            <ThemedText type="micro" themeColor="textAssistive" numberOfLines={1} style={[styles.regular, styles.note]}>
              {candidate.note}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>

      <View style={[styles.ctaStrip, { borderTopColor: theme.border }]}>
        {isDecided ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.vendorName} ${ACTION_UNDECIDE}`}
            disabled={busy}
            onPress={onUndecide}
            style={({ pressed }) => [
              styles.ctaSecondary,
              styles.ctaFixed,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              pressed ? styles.pressed : null,
              busy ? styles.busy : null,
            ]}>
            <ThemedText type="micro" themeColor="textAssistive" style={styles.bold}>
              {ACTION_UNDECIDE}
            </ThemedText>
          </Pressable>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: comparing, disabled: compareDisabled }}
              accessibilityLabel={`${candidate.vendorName} ${comparing ? ACTION_COMPARING : ACTION_COMPARE}`}
              disabled={compareDisabled}
              onPress={onCompare}
              style={({ pressed }) => [
                styles.ctaSecondary,
                styles.ctaFlex,
                comparing
                  ? { backgroundColor: theme.text, borderColor: theme.text }
                  : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                compareDisabled ? styles.disabled : null,
                pressed ? styles.pressed : null,
              ]}>
              <ThemedText
                type="micro"
                style={[styles.bold, { color: comparing ? theme.onInk : compareDisabled ? theme.textAssistive : theme.text }]}>
                {comparing ? ACTION_COMPARING : ACTION_COMPARE}
              </ThemedText>
            </Pressable>
            {/* 업종을 이미 다른 곳으로 결정했으면 이 카드에서는 결정을 권하지 않는다. */}
            {!groupDecided ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${candidate.vendorName} ${ACTION_DECIDE}`}
                onPress={onDecide}
                style={({ pressed }) => [
                  styles.ctaPrimary,
                  styles.ctaFlex,
                  { backgroundColor: theme.tint },
                  pressed ? styles.pressed : null,
                ]}>
                <ThemedText type="micro" style={[styles.bold, { color: theme.onTint }]}>
                  {ACTION_DECIDE}
                </ThemedText>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────
   비어 있음 — 피그마 `py-20 gap-4`: 회색 원 64 + 하트 32 · 제목 · 부제 · 잉크 pill 단추
──────────────────────────────────────────── */
function Empty() {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyMark, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.emptyHeart}>
          <Svg width={Layout.iconEmpty} height={Layout.iconEmpty} viewBox="0 0 24 24" fill="none">
            <Path d={MARK_HEART_PATH} stroke={theme.textAssistive} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
      <View style={styles.emptyText}>
        <ThemedText type="t6" style={styles.bold}>
          {EMPTY_TITLE}
        </ThemedText>
        <ThemedText type="t7" themeColor="textAssistive" style={styles.emptyBody}>
          {EMPTY_BODY}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={EMPTY_CTA}
        onPress={() => router.push('/search')}
        style={({ pressed }) => [styles.emptyCta, { backgroundColor: theme.text }, pressed ? styles.pressed : null]}>
        <ThemedText type="t7" style={[styles.bold, { color: theme.onInk }]}>
          {EMPTY_CTA}
        </ThemedText>
      </Pressable>
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
  /* `micro`는 기본이 700이다 — 피그마에서 regular인 작은 글자는 400으로 되돌린다. */
  regular: { fontWeight: 400 },
  pressed: { transform: [{ scale: 0.97 }] },
  busy: { opacity: 0.6 },
  /* 비교함이 찼을 때의 «비교하기» `opacity-40`. */
  disabled: { opacity: 0.4 },

  // ── 헤더 `px-5 pb-5 pt-6` — 좌우는 정본 24 · 위 24 · 아래 20(같은 값의 listGap) ──
  head: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
    paddingBottom: Layout.listGap,
  },
  /* 제목 ↔ 배지 `mb-1 flex items-center justify-between`. */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  /* «N개 저장» `rounded-full px-3 py-1` — 좌우 12(같은 값의 inlineGap) · 상하 4. */
  countBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Layout.inlineGap,
    paddingVertical: Spacing.one,
  },
  /* 배우자 상자 `mt-4 rounded-2xl px-4 py-3` — 위 16 · radius 16 · 안쪽 16/12. */
  partnerBox: {
    marginTop: Spacing.three,
    borderRadius: Radius.cardLarge,
    paddingHorizontal: Spacing.three,
    paddingVertical: Layout.inlineGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  /* 아바타 묶음 ↔ 글 `gap-2.5` = 10(같은 값의 iconTextGap). */
  partnerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.iconTextGap,
  },
  partnerText: { flexShrink: 1 },
  avatars: { flexDirection: 'row' },
  /* `h-8 w-8 ring-2` — 32 원 · 테두리 2(같은 값의 Border.focus). */
  avatar: {
    width: Layout.avatarRow,
    height: Layout.avatarRow,
    borderRadius: Radius.pill,
    borderWidth: Border.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* `-space-x-2` — 둘째가 8 겹친다. */
  avatarOverlap: { marginLeft: -Spacing.two },
  /* «가격 제보» `flex items-center gap-1`. */
  priceReportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },

  // ── 비교 배너 `mx-5 mb-4 rounded-2xl px-4 py-3.5` ──
  compareBanner: {
    marginHorizontal: Layout.gutter,
    marginBottom: Spacing.three,
    borderRadius: Radius.cardLarge,
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
  /* «전체 비교하기» `rounded-full px-4 py-2.5 gap-1.5` — 좌우 16 · 상하 10 · 아이콘↔글 6. */
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.menuGroupGap,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Layout.iconTextGap,
  },

  // ── 업종 칩 `gap-2 px-5 pb-4` ──
  /* 세로 스크롤 안의 가로 스크롤 — 늘어나지 않게 잡는다. 안 잡으면 칩 줄이 남는 높이를 다 먹는다. */
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.three,
  },
  /* `px-4 py-2.5 text-sm` — 40(같은 값의 controlMedium) · 좌우 16. */
  chip: {
    height: Layout.controlMedium,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 카드 목록 `space-y-3 px-5` — 카드 사이 12 ──
  list: {
    paddingHorizontal: Layout.gutter,
    gap: Layout.inlineGap,
  },
  /* `rounded-2xl border overflow-hidden` — 그림자(`shadow-sm`)는 elevation.$rule에 따라 없다. */
  card: {
    borderRadius: Radius.cardLarge,
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
  /* 결정 막 `absolute inset-2 rounded-xl` — 썸네일과 같은 자리 · radius 22. */
  decidedOverlay: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
    borderRadius: Radius.hero,
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
  /* 이름 `mt-0.5`. */
  name: { marginTop: Spacing.half },
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

  /* CTA 띠 `border-t px-3 py-2.5 gap-2` — 안쪽 12/10. */
  ctaStrip: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderTopWidth: Border.hairline,
    paddingHorizontal: Layout.inlineGap,
    paddingVertical: Layout.iconTextGap,
  },
  /* 단추 `h-10 rounded-xl` — 40 · radius 22. */
  ctaSecondary: {
    height: Layout.controlMedium,
    borderRadius: Radius.hero,
    borderWidth: Border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimary: {
    height: Layout.controlMedium,
    borderRadius: Radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaFlex: { flex: 1 },
  /* «결정 취소» `flex-none px-4`. */
  ctaFixed: { paddingHorizontal: Spacing.three },

  // ── 비어 있음 `py-20 gap-4` ──
  empty: {
    alignItems: 'center',
    paddingVertical: Layout.pickEmptyPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.three,
  },
  emptyMark: {
    width: Layout.emptyMark,
    height: Layout.emptyMark,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 하트 `text-muted-foreground/30`. */
  emptyHeart: { opacity: 0.3 },
  emptyText: { alignItems: 'center' },
  emptyBody: { marginTop: Spacing.one },
  /* `mt-1 rounded-full px-6 py-3`. */
  emptyCta: {
    marginTop: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Layout.inlineGap,
  },
});
