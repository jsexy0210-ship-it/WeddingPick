/**
 * Pick — Pick한 업체 목록. WP-PICK-001.
 *
 * **직접 입력한 결정**(2026-09-26 대표 지시 · 0440). 온보딩 3/5에서 우리 목록에 없어 이름만
 * 적은 곳은 후보가 아니라 결정이다(`manualDecisions`). 그 묶음 맨 위에 결정 카드로 세우되
 * 같은 카드 틀에서 이을 곳이 없는 조각은 뺀다 — 누르는 본문(업체 상세 · 상담 예약) · 지역 ·
 * 별점 · ×(후보 빼기) · «상담 예약» 단추가 없고, CTA 띠에는 «결정 취소» 하나만 남는다.
 * 정본에 없는 카드라 DESIGN_SOURCE_NOT_VERIFIED다.
 *
 * v3.29.1 정본 `docs/design/React_Native/pick.jsx` frame-001을 따른다. 헤더(«Pick») → 업종 칩 →
 * 비교 배너(2곳 이상 담으면 «N곳 담았어요 · 비교하기») → 카드 목록.
 * 카드는 검색 결과와 같은 틀(썸네일 104×116 · 정보 안쪽 14)이고 아래에 CTA 띠가 붙는다.
 *
 * **v3.29 대조로 정한 것.**
 * - Pick 탭 안에 «추천 · 내 Pick»(Figma 원본) 같은 상단 탭을 두지 않는다 — v3.29 diffs
 *   «탭 구성»이 명시한다. 비교 → 결정이 한 화면에서 끝난다. 홈 «내 웨딩 준비» 카드는
 *   `/pick?group=<묶음>`으로 들어와 그 업종 칩이 켜진 채 열린다(home.jsx «각 카드를 누르면
 *   Pick의 해당 업종으로 이동»).
 * - `/pick?section=recommendations` 분기는 없앴다(2026-09-25 대표 지시). 옛 링크로 들어와도
 *   `section`을 보지 않으므로 이 기본 화면이 뜬다.
 * - 최종 결정 확인 시트(옛 `/pick/confirm`)는 2026-09-25 대표 결정(안 A)으로 삭제했다.
 *   상담 예약은 더 이상 최종 결정을 먼저 요구하지 않는다 — Pick에 담은 업체(후보)라면
 *   결정 전이라도 카드에서 바로 상담 예약으로 간다(서버도 후보 · 결정 둘 다 받는다).
 * - 카드를 누르면 그 업체의 상담 예약(`/search/[vendorId]/consult`)으로 바로 간다 — 정본
 *   frame-001 tagDesc «카드를 누르면 상담 예약으로 바로 이어집니다»(2026-09-25 MASTER 지시로
 *   diffs «상담 진입»보다 이 동선을 따른다). 상담 예약 화면 자체는 검색 화면군 소유다.
 * - 카드 CTA는 정본 btnB «상담 예약» 하나이고 비교는 텍스트 링크(«비교에 담기»)다(v3.29 diffs
 *   «카드 CTA» — 화면당 Primary 1개). 결정한 카드만 코랄, 나머지는 흰 바탕 + 1px 선이다.
 * - 삭제(WP-PICK-008)는 확인 시트 없이 «빼기»로 즉시 지우고 «되돌리기» 토스트만 띄운다.
 *
 * **정본을 그대로 옮기지 않은 것.**
 * - 카드의 태그 · 제보 금액 · 실 제보 건수는 서버가 후보에 주지 않는다
 *   (`vendorCandidateSchema`) — 만들어 넣지 않는다. 그 자리에는 후보 메모(`note`)가 있으면 적는다.
 * - 배지 «인기»는 우리 값이 없다. 같은 자리에 **«함께»**(배우자도 고른 곳)를 세운다.
 * - 결정 취소는 되돌릴 수 있는 조작이라 한 번 더 묻는다(위험한 조작).
 * - **별점은 다르다**(v3.28 2026-09-23 「후기 별점 UI를 되살린다」) — `vendorCandidateSchema`에
 *   추가됐다. 검색·상세와 같은 관문(`scored_reviews`)에서 오고, 확인된 후기가 모자라거나
 *   체크리스트 업종(과거 결정사)이면 null이라 그때 카드는 별점 줄을 안 그린다.
 *
 * **결정이 끝난 묶음**(2026-09-26 대표 지시 — 「온보딩에서 결정이 확정된 카테고리는 Pick 화면에서
 * 완료 처리된 별도 UX가 필요하다」). 묶음 안 업종이 모두 **실제 결정**(업체 결정 · 직접 입력)으로
 * 채워졌으면 그 묶음은 끝났다 — 온보딩 준비 현황 체크만으로는 치지 않아 «결정 취소»가 곧바로
 * 완료를 푼다(2026-09-26 대표 결정 · `features/pick/completed-groups`, 홈 «계약 완료»와 갈린다): 머리 앞에 정본 `doneMarkSm`(22 코랄 원 ·
 * 흰 체크 13)을 세우고 «N개 · 최신순» 자리에 «결정 완료»를 적는다(결정 카드를 맨 위로 올려
 * 최신순이 더는 맞지 않는다). 결정 카드(직접 입력 → 업체 결정)만 펼쳐 두고 나머지 후보는 정본
 * `moreBtn2` «더 보기» 뒤로 접으며, «내 조건에 맞는 곳»은 그리지 않는다 — 다 고른 묶음에 새
 * 업체를 내밀지 않는다(«더 보기» 접기는 2026-09-26 대표 확정). 칩바의 끝난 묶음 칩에는 머리 마크를
 * 줄인 14px 코랄 체크를 라벨 앞에 붙인다 — 정본에 없고 **대표 지시 신규**(2026-09-26)다.
 *
 * **묶음마다 «내 조건에 맞는 곳» 5곳**(2026-09-25 대표 지시 — 「Pick 메뉴 카테고리별로 각각 5개씩
 * 배치한다. 이것이 추천이다. 온보딩에서 사용자가 선택한 값에 따라 그에 맞는 결과를 Pick에 5개씩
 * 보여준다」). 정본 pick.jsx에 없는 줄이다 — 대표 지시가 정본보다 우선한다(DESIGN_SOURCE_NOT_VERIFIED,
 * PR 본문). 담은 곳 아래 가로 줄로 두고 카드마다 «Pick»으로 바로 담는다. 고르는 규칙은 서버
 * `GET /v1/me/pick-recommendations`(온보딩 지역 · 예산 · 스타일 · 준비 현황)가 정한다.
 */
import type {
  CandidateListResponse,
  CurrentUser,
  ManualDecision,
  PickRecommendationsResponse,
  VendorCandidate,
  VendorSummary,
} from '@weddingpick/api-contract';
import {
  PREPARATION_GROUPS,
  PREPARATION_STATE_LABEL,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  priceLine,
  withParticle,
  type PreparationGroupKey,
  type VendorCategory,
  regionLabel,
} from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Border,
  Elevation,
  Layout,
  LetterSpacing,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  RatingStars,
  SeedIcon,
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
  getPickRecommendations,
  listCandidates,
  removeCandidate,
  removeDecision,
} from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { ROOT_TAB_GUTTER, RootTabHeader } from '@/components/root-tab-header';
import { DialogToast } from '@/components/confirm-alert-toast';
import { HOME_PREP_GROUP_LABEL } from '@/features/home/prep-groups';
import { pickOrigin } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { inStack } from '@/features/navigation/stack-alias';
import { notifyRefreshFailed, usePullRefresh } from '@/features/refresh/use-pull-refresh';
import { completedPickGroups, decidedFirst } from '@/features/pick/completed-groups';
import {
  PICK_COMPARE_ADD_LABEL,
  PICK_COMPARE_BANNER_HINT,
  PICK_COMPARE_MAX,
  PICK_COMPARE_REMOVE_LABEL,
  compareBasketLabel,
  groupMetaLabel,
  showGroupMeta,
} from '@/features/pick/canonical-rules';
import { vendorImageCategory } from '@/features/search/vendor-image-category';

import { pick as pickCopy } from '../../../../../../spec/strings.ko.json';

/* 문구 — spec/strings.ko.json `pick` · features/pick/canonical-rules. */
const COMPARE_HINT = PICK_COMPARE_BANNER_HINT;
const COMPARE_ALL = '비교하기';
const CHIP_ALL = '전체';
const ACTION_COMPARE = PICK_COMPARE_ADD_LABEL;
const ACTION_COMPARING = PICK_COMPARE_REMOVE_LABEL;
const ACTION_UNDECIDE = '결정 취소';
/* 정본 pick.js `sv().labelB` «상담 예약». */
const ACTION_CONSULT = '상담 예약';
/* 정본 pick.jsx frame-001 `moreBtn2`. */
const GROUP_MORE = '더 보기';
const BADGE_SHARED = '함께';
const EMPTY_TITLE = '아직 담은 곳이 없어요';
const EMPTY_BODY = '담아두면 여기서 비교할 수 있어요';
const EMPTY_CTA = '업체 검색하기';
const UNDECIDE_TITLE = '결정을 취소할까요?';
const UNDECIDE_BODY = '웨딩노트의 결정 상태가 풀려요. 언제든 다시 결정할 수 있어요.';
const MIN_COMPARE = 2;
/* 정본 pick.js `sv().thumb` radius 8 — 같은 값의 기존 토큰(Radius.picker). */
const THUMB_RADIUS = Radius.picker;
/* 묶음별 추천 줄 — 2026-09-25 대표 지시. 이름은 대표님 확인 대기(PR 본문). */
const RECOMMEND_TITLE = '내 조건에 맞는 곳';
const RECOMMEND_PICK = TERMS.pick;
/** 추천 카드 폭 · 사진 높이. 정본 값이 없어 검색 썸네일 높이(116)에 폭을 맞췄다(DESIGN_SOURCE_NOT_VERIFIED). */
const RECOMMEND_CARD_WIDTH = 148;
const RECOMMEND_THUMB_HEIGHT = Layout.thumbSearchHeight;
/** 정본 frame-001 tagDesc «곧 3개씩 제공하고» — 묶음마다 먼저 보이는 카드 수. */
const GROUP_PREVIEW = 3;
/* 끝난 묶음의 머리 — 정본 pick.js `confirmRows` · `doneRows` «결정 완료»(= PREPARATION_STATE_LABEL.decided). */
const GROUP_DONE = PREPARATION_STATE_LABEL.decided;
/* 정본 pick.js `doneMarkSm` 22 · `rIcoCheck` check-fill 13. */
const DONE_MARK = 22;
const DONE_MARK_ICON = 13;
/* 칩의 완료 표시 — 머리 마크를 줄인 14 원(Layout.iconSmall) · 체크 10(Layout.iconTiny). 대표 지시 신규. */
const CHIP_DONE_MARK = Layout.iconSmall;
const CHIP_DONE_ICON = Layout.iconTiny;

/*
 * 칩과 묶음은 업종이 아니라 준비 묶음 넷이다 — 정본 pick.js `cats` «전체 · 웨딩홀 · 스드메 · 본식 ·
 * 예물 · 신혼» · `catGroups`, tagDesc «업종별로 카테고리(웨딩홀 · 스드메 · 본식 · 예물·신혼) 칩으로
 * 거릅니다». 묶음은 `PREPARATION_GROUPS`, 이름은 홈 「내 웨딩 준비」와 같은 것을 쓴다.
 */
type Filter = PreparationGroupKey | 'all';

type Section = {
  key: string;
  title: string;
  rows: Row[];
  /** 이 묶음에서 이름으로만 정한 곳(0440). 후보가 아니라 `rows`와 따로 든다. */
  manual: ManualDecision[];
};

type Row = {
  candidate: VendorCandidate;
  /** 이 후보가 그 결정인가. */
  isDecided: boolean;
};

type UndoCandidate = {
  candidate: VendorCandidate;
  /** 후보 삭제의 FK cascade로 같이 풀린 최종 결정을 되살려야 하는가. */
  wasDecided: boolean;
};

/**
 * 후보를 준비 묶음 넷으로 나눈다 — 정본 `catGroups`처럼 넷은 늘 그리고(0개도), 묶음 안은 담은
 * 순서 최신순(«N개 · 최신순»)이다. 넷 어디에도 안 드는 업종(기타 등)은 버리지 않고 그 업종
 * 이름으로 뒤에 붙인다 — 정본에 없는 자리라 PR 본문 DESIGN_UNRESOLVED에 적었다.
 */
function pickSections(rows: readonly Row[], manual: readonly ManualDecision[] = []): Section[] {
  const newestFirst = (a: Row, b: Row) => b.candidate.addedAt.localeCompare(a.candidate.addedAt);
  const grouped = PREPARATION_GROUPS.map((group) => ({
    key: group.key,
    title: HOME_PREP_GROUP_LABEL[group.key],
    rows: rows
      .filter((row) => (group.categories as readonly VendorCategory[]).includes(row.candidate.category))
      .sort(newestFirst),
    manual: manual.filter((one) => (group.categories as readonly VendorCategory[]).includes(one.category)),
  }));
  const covered = new Set<VendorCategory>(PREPARATION_GROUPS.flatMap((group) => group.categories));
  const restCategories = [...new Set(rows.map((row) => row.candidate.category))].filter((category) => !covered.has(category));
  const rest = restCategories
    .map((category) => ({
      key: category,
      title: VENDOR_CATEGORY_LABEL[category],
      rows: rows.filter((row) => row.candidate.category === category).sort(newestFirst),
      manual: [],
    }));
  return [...grouped, ...rest];
}

export default function PickScreen() {
  const { group: groupParam } = useLocalSearchParams<{ group?: string | string[] }>();
  const rawGroup = Array.isArray(groupParam) ? groupParam[0] : groupParam;
  /* 홈 «내 웨딩 준비» 카드가 넘긴 묶음. 모르는 값이면 «전체». */
  const requestedGroup = PREPARATION_GROUPS.find((group) => group.key === rawGroup)?.key ?? null;
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  /** 묶음별 «내 조건에 맞는 곳». 못 받아도 담은 목록은 그대로 보인다(null). */
  const [recs, setRecs] = useState<PickRecommendationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(requestedGroup ?? 'all');
  /* 탭에 머문 채 홈에서 다른 묶음으로 다시 들어오면 그 칩으로 바꾼다(렌더 중 조정 — 이펙트 불필요). */
  const [seenGroup, setSeenGroup] = useState(requestedGroup);
  if (seenGroup !== requestedGroup) {
    setSeenGroup(requestedGroup);
    if (requestedGroup) setFilter(requestedGroup);
  }
  /** 비교함에 담은 업체(vendorId). 최대 PICK_COMPARE_MAX. */
  const [compare, setCompare] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [undoCandidate, setUndoCandidate] = useState<UndoCandidate | null>(null);
  /** «더 보기»로 펼친 묶음. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  /** `keep` — 당겨서 새로 고침. 보이던 목록은 그대로 두고 실패는 토스트로만 알린다. */
  const load = useCallback((keep = false) => {
    getCurrentUser()
      .then(async (current) => {
        setError(null);
        setMe(current);
        const [candidates, recommendations] = await Promise.all([
          current.weddingId ? listCandidates(current.weddingId) : Promise.resolve(null),
          // 추천을 못 받아도 담은 목록은 보여준다 — 추천 줄만 비운다.
          getPickRecommendations().catch(() => null),
        ]);
        setPage(candidates);
        setRecs(recommendations);
      })
      .catch((caught: Error) => {
        if (keep) notifyRefreshFailed();
        else setError(caught.message);
      });
  }, []);

  /* 상담 예약 · 비교에서 돌아오면 목록이 바뀌어 있을 수 있다 — 화면에 올 때마다 다시 읽는다. */
  useFocusEffect(load);

  /* 오류 화면에서 당기면 다시 시도와 같다(실패하면 오류 그대로). 목록에서 당기면 목록을 지킨다. */
  const pull = usePullRefresh(useCallback(() => load(error === null), [error, load]));

  const rows: Row[] = (page?.groups ?? []).flatMap((group) =>
    group.candidates.map((candidate) => ({
      candidate,
      isDecided: group.decidedVendorId === candidate.vendorId,
    }))
  );
  const manualDecisions = page?.manualDecisions ?? [];
  const sections = pickSections(rows, manualDecisions);
  /* 결정이 끝난 묶음 — 홈 «내 웨딩 준비»와 같은 규칙(features/pick/completed-groups). */
  const doneGroups = completedPickGroups(page);
  const isDoneSection = (key: string) => doneGroups.has(key as PreparationGroupKey);
  /* 담은 곳이 없어도 직접 입력한 결정이 있으면 빈 화면이 아니다. */
  const hasItems = rows.length > 0 || manualDecisions.length > 0;
  const visibleSections = filter === 'all' ? sections : sections.filter((section) => section.key === filter);
  const weddingId = me?.weddingId ?? null;
  const recsFor = (key: string): readonly VendorSummary[] =>
    recs?.groups.find((group) => group.key === key)?.vendors ?? [];
  const hasRecs = (recs?.groups ?? []).some((group) => group.vendors.length > 0);
  /*
   * 여기서 여는 업체 상세 · 상담 예약은 **검색 스택**에 쌓인다 — 출처를 넘기지 않으면 Back이
   * 검색으로 떨어진다(2026-09-26 대표 감사). 지금 켜진 칩까지 넘겨 그 칩의 Pick으로 돌아온다.
   */
  const origin = pickOrigin(filter === 'all' ? null : filter);

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    /* 비교 · 상담 예약 · 업체 상세는 Pick 스택 안에서 민다(`stack-alias.ts` — 검색 탭으로 건너가지 않는다). */
    router.push(inStack('/pick', `/search/compare?ids=${encodeURIComponent(Array.from(compare).join(','))}`) as never);
  }

  /** 결정 취소는 되돌릴 수 있는 조작이라 DLG-B 확인을 쓴다. 직접 입력한 결정도 같은 길이다. */
  function askUndecide(category: VendorCategory) {
    confirmAlert(UNDECIDE_TITLE, UNDECIDE_BODY, [
      { text: '그대로 둘게요', style: 'cancel' },
      { text: ACTION_UNDECIDE, onPress: () => undecide(category) },
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
        manualDecisions: current.manualDecisions.filter((one) => one.category !== category),
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

  /** 추천 카드의 «Pick» — 후보로 담는다. 담은 곳은 다음 읽기에서 추천 줄에서 빠지고 위 목록에 선다. */
  async function pickRecommended(vendor: VendorSummary) {
    if (!weddingId || busy) return;
    setBusy(true);
    try {
      await addCandidate(weddingId, vendor.id);
      showToast(`${withParticle(vendor.name, '을를')} Pick했어요`);
      load();
    } catch {
      showToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.');
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
          {/* 제목 줄은 스크롤 밖에 고정한다 — 다른 Root 네 탭과 같다(2026-09-26 대표 「고정으로 통일해」). */}
          <Header />
          {error ? (
            <ScrollView contentContainerStyle={styles.scroll} refreshControl={pull.refreshControl}>
              <View style={styles.errorBox}>
                <ThemedText type="t2">불러오지 못했어요</ThemedText>
                <ThemedText type="t6" themeColor="textSecondary">
                  {error}
                </ThemedText>
                <RetryLink onPress={() => load()} />
              </View>
            </ScrollView>
          ) : !me ? (
            <View style={styles.loadingCenter}>
              <DelayedLoader size={40} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              refreshControl={pull.refreshControl}>
              {!hasItems ? <Empty /> : null}
              {hasItems || hasRecs ? (
                <>
                  {/* 정본 chipBarSticky: 위 4 · 아래 16 · 칩 사이 8. 칩은 준비 묶음 넷(위 `Filter`). */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipRow}>
                    <CategoryChip label={CHIP_ALL} active={filter === 'all'} onPress={() => setFilter('all')} />
                    {PREPARATION_GROUPS.map((group) => (
                      <CategoryChip
                        key={group.key}
                        label={HOME_PREP_GROUP_LABEL[group.key]}
                        active={filter === group.key}
                        done={doneGroups.has(group.key)}
                        onPress={() => setFilter(group.key)}
                      />
                    ))}
                  </ScrollView>

                  {/* 정본 mypickSec: 위 1px 선 · 위아래 20 — 비교 배너와 묶음 목록이 이 안에 든다. */}
                  <View style={[styles.mypickSec, { borderTopColor: theme.border }]}>
                    {/* 비교 배너 — 정본 banner: 바깥 16 · 안쪽 16 · radius 10 · #fff5f2 면 · #ffd9d4 선. */}
                    {compare.size >= MIN_COMPARE ? (
                      <View style={[styles.compareBanner, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
                        <View style={styles.compareText}>
                          <ThemedText type="f14" style={styles.bold}>
                            {compareBasketLabel(compare.size)}
                          </ThemedText>
                          <ThemedText type="f12" themeColor="textAssistive">
                            {COMPARE_HINT}
                          </ThemedText>
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
                          <ThemedText type="f14" style={[styles.bold, { color: theme.onTint }]}>
                            {COMPARE_ALL}
                          </ThemedText>
                        </Pressable>
                      </View>
                    ) : null}

                    <View style={styles.groupWrap}>
                      {visibleSections.map((section) => {
                        const open = expanded.has(section.key);
                        const done = isDoneSection(section.key);
                        /* 끝난 묶음은 결정 카드를 맨 위에 두고, 펼치기 전에는 결정 카드만 보인다. */
                        const ordered = done ? decidedFirst(section.rows) : section.rows;
                        const shown = open
                          ? ordered
                          : done
                            ? ordered.filter((row) => row.isDecided)
                            : ordered.slice(0, GROUP_PREVIEW);
                        return (
                          <View key={section.key} style={styles.group}>
                            {/*
                              정본 catGroupHead: 제목 18/700 · «N개 · 최신순» 13 회색, 글줄 맞춤.
                              담은 곳이 없고 «내 조건에 맞는 곳»만 있는 묶음에서는 «0개 · 최신순»을
                              그리지 않는다(2026-09-26 대표 지시 — 「내 조건에 맞는 곳」에서 삭제).
                              담은 곳이 있는 묶음은 정본대로 둔다.
                            */}
                            <View
                              style={[styles.groupHead, done ? styles.groupHeadDone : null]}
                              accessibilityLabel={done ? `${section.title} ${GROUP_DONE}` : undefined}>
                              {done ? (
                                /* 정본 rDoneRow: 마크 22 · 제목 사이 10. */
                                <View style={styles.groupTitleRow}>
                                  <View style={[styles.doneMark, { backgroundColor: theme.tint }]}>
                                    <ProductSymbol name="check" size={DONE_MARK_ICON} color={theme.onTint} />
                                  </View>
                                  <ThemedText type="f18" style={[styles.bold, styles.groupTitle]}>
                                    {section.title}
                                  </ThemedText>
                                </View>
                              ) : (
                                <ThemedText type="f18" style={[styles.bold, styles.groupTitle]}>
                                  {section.title}
                                </ThemedText>
                              )}
                              {done ? (
                                <ThemedText type="f13" style={[styles.bold, { color: theme.tint }]}>
                                  {GROUP_DONE}
                                </ThemedText>
                              ) : showGroupMeta(section.rows.length + section.manual.length, recsFor(section.key).length) ? (
                                <ThemedText type="f13" numeric themeColor="textAssistive">
                                  {groupMetaLabel(section.rows.length + section.manual.length)}
                                </ThemedText>
                              ) : null}
                            </View>
                            {shown.length > 0 || section.manual.length > 0 ? (
                              <View style={styles.list}>
                                {section.manual.map((decision) => (
                                  <ManualDecisionCard
                                    key={`manual-${decision.category}`}
                                    decision={decision}
                                    busy={busy}
                                    onUndecide={() => askUndecide(decision.category)}
                                  />
                                ))}
                                {shown.map((row) => (
                                  <CandidateCard
                                    key={row.candidate.id}
                                    row={row}
                                    comparing={compare.has(row.candidate.vendorId)}
                                    compareFull={compare.size >= PICK_COMPARE_MAX}
                                    busy={busy}
                                    origin={origin}
                                    onCompare={() => toggleCompare(row.candidate.vendorId)}
                                    onUndecide={() => askUndecide(row.candidate.category)}
                                    onRemove={() => void unpick(row)}
                                  />
                                ))}
                              </View>
                            ) : null}
                            {/* 정본 moreBtn2 «더 보기». 가릴 카드가 있을 때만 그린다(DESIGN_UNRESOLVED — PR 본문). */}
                            {section.rows.length > shown.length && !open ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${section.title} ${GROUP_MORE}`}
                                onPress={() => toggleExpanded(section.key)}
                                style={({ pressed }) => [
                                  styles.moreBtn,
                                  { backgroundColor: theme.backgroundSelected },
                                  pressed ? styles.pressed : null,
                                ]}>
                                <ThemedText type="f14" themeColor="textSecondary" style={styles.bold}>
                                  {GROUP_MORE}
                                </ThemedText>
                              </Pressable>
                            ) : null}
                            {/* 끝난 묶음에는 «내 조건에 맞는 곳»을 내밀지 않는다(2026-09-26 대표 지시). */}
                            <RecommendRow
                              vendors={done ? [] : recsFor(section.key)}
                              canPick={weddingId !== null}
                              busy={busy}
                              origin={origin}
                              onPick={(vendor) => void pickRecommended(vendor)}
                            />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </>
              ) : null}
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
   Header — 정본 1번 화면: 제목 «Pick» 한 줄뿐. «N곳» · 부제 · 배우자
   함께-보기 상자 · «Pick 인증» 고리는 정본에 없어 지웠다(2026-09-23 대표 지시 —
   정본에 없는 기능은 제거한다). Pick 인증 진입은 MY · 웨딩노트가 갖고 있다.
   크기 · 여백은 정본 `rH1` 28/36 · `headBlock` 4/24가 아니라 Root 5탭 공통 홈 기준
   (`RootTabHeader` 26/39/700 · 줄 66) — 2026-09-26 대표 지시 「홈 화면 기준으로 통일한다」.
──────────────────────────────────────────── */
function Header() {
  return <RootTabHeader title={TERMS.pick} />;
}

/* ────────────────────────────────────────────
   업종 칩 — 켬은 잉크 채움 · 흰 글자, 끔은 회색 면 · 보조색 글자
──────────────────────────────────────────── */
function CategoryChip({
  label,
  active,
  done = false,
  onPress,
}: {
  label: string;
  active: boolean;
  /** 결정이 끝난 묶음 — 라벨 앞 코랄 체크(대표 지시 신규 2026-09-26). */
  done?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={done ? `${label} ${GROUP_DONE}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        /* 정본 chip() 끔 면 SEC #f2f3f6 — 칩 배경 토큰 backgroundSelected(SEED gray-100 #f3f4f5). */
        { backgroundColor: active ? theme.text : theme.backgroundSelected },
        pressed ? styles.pressed : null,
      ]}>
      {/*
        끝난 묶음 — 묶음 머리 마크(22)를 14로 줄인 코랄 원 + 흰 체크. 켬(잉크 면)·끔(회색 면) 어디서나
        코랄 원이 면과 갈려 보인다. 칩은 그만큼 넓어지고 줄은 가로 스크롤 그대로다.
      */}
      {done ? (
        <View style={[styles.chipDoneMark, { backgroundColor: theme.tint }]}>
          <ProductSymbol name="check" size={CHIP_DONE_ICON} color={theme.onTint} />
        </View>
      ) : null}
      {/* WP-PICK-001 칩: 14/700 · 높이 36 · 좌우 14. 끔 글자 #4d5159는 테마 키가 없어 보조색(PR 본문). */}
      <ThemedText type="f14" numberOfLines={1} style={[styles.bold, { color: active ? theme.onInk : theme.textAssistive }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/* ────────────────────────────────────────────
   카드 — 정본 `sv()`: 썸네일 열 120 + 정보 + 아래 CTA 띠(border-top · 안쪽 8 14 10 · 단추 40 · radius 6)
──────────────────────────────────────────── */
function CandidateCard({
  row,
  comparing,
  compareFull,
  busy,
  origin,
  onCompare,
  onUndecide,
  onRemove,
}: {
  row: Row;
  comparing: boolean;
  compareFull: boolean;
  busy: boolean;
  /** Pick 출처(`pickOrigin`) — 상담 예약을 닫으면 이 Pick으로 돌아온다. */
  origin: string;
  onCompare: () => void;
  onUndecide: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { candidate, isDecided } = row;
  const compareDisabled = !comparing && compareFull;
  const openConsult = () =>
    router.push(inStack('/pick', `/search/${encodeURIComponent(candidate.vendorId)}/consult?from=${encodeURIComponent(origin)}`) as never);

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
        accessibilityLabel={`${candidate.vendorName} ${ACTION_CONSULT}`}
        onPress={openConsult}
        style={styles.cardBody}>
        <View style={styles.thumbCol}>
          <VendorImage
            source={candidate.imageUrl ? { uri: candidate.imageUrl } : undefined}
            category={vendorImageCategory(candidate.category)}
            width={Layout.thumbSearchWidth}
            height={Layout.thumbSearchHeight}
            radius={THUMB_RADIUS}
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
              <ThemedText type="f14" numberOfLines={1} style={[styles.bold, styles.name]}>
                {candidate.vendorName}
              </ThemedText>
            </View>
            {/* × — 후보에서 즉시 뺀다(WP-PICK-008). 되돌리기는 토스트가 맡는다. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${candidate.vendorName} 빼기`}
              hitSlop={Spacing.three}
              onPress={onRemove}
              style={styles.removeBtn}>
              <ProductSymbol name="close" size={Layout.iconField} color={theme.textDisabled} />
            </Pressable>
          </View>
          <View style={styles.location}>
            {/* 정본 icoPin: SEED location 12 · #868b94 — 같은 패스의 SeedIcon locationRegular. */}
            <SeedIcon name="locationRegular" size={Layout.iconMicro} color={theme.textAssistive} />
            {/* 규격서: 지역 «12/400 #868B94 · lh 16 · mar 6 0 0 0». */}
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1} style={styles.locText}>
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
            type="f13"
            style={[
              styles.bold,
              { color: isDecided ? theme.textAssistive : comparing ? theme.tint : compareDisabled ? theme.textDisabled : theme.textAssistive },
            ]}>
            {isDecided ? ACTION_UNDECIDE : comparing ? ACTION_COMPARING : ACTION_COMPARE}
          </ThemedText>
        </Pressable>

        {/* 정본 btnB «상담 예약» — 결정한 카드는 코랄, 나머지는 흰 바탕 + 1px 선.
            2026-09-25 대표 결정(안 A): 결정 전 후보도 여기서 바로 상담 예약으로 간다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${candidate.vendorName} ${ACTION_CONSULT}`}
          disabled={busy}
          onPress={openConsult}
          style={({ pressed }) => [
            styles.decisionCta,
            isDecided
              ? { backgroundColor: theme.tint, borderColor: theme.tint }
              : { backgroundColor: theme.background, borderColor: theme.border },
            pressed ? styles.pressed : null,
            busy ? styles.busy : null,
          ]}>
          <ThemedText type="f13" style={[styles.bold, { color: isDecided ? theme.onTint : theme.text }]}>
            {ACTION_CONSULT}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────
   직접 입력한 결정 카드(0440 · 2026-09-26 대표 지시 · 정본 없음 — DESIGN_SOURCE_NOT_VERIFIED).
   `CandidateCard`의 결정 상태 틀(코랄 1.5 테두리 · 썸네일 · 우상단 체크 · 업종 · 이름 · CTA 띠)을
   그대로 쓰고, 이을 업체가 없는 조각만 뺀다: 누르는 본문 · 지역 · 별점 · × · «상담 예약».
   지역 줄 자리에는 «직접 입력한 곳»을 적는다.
──────────────────────────────────────────── */
function ManualDecisionCard({
  decision,
  busy,
  onUndecide,
}: {
  decision: ManualDecision;
  busy: boolean;
  onUndecide: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel={`${decision.name} ${pickCopy['card.manual']}`}
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.tint, borderWidth: 1.5 }]}>
      <View style={styles.cardBody}>
        <View style={styles.thumbCol}>
          <VendorImage
            source={undefined}
            category={vendorImageCategory(decision.category)}
            width={Layout.thumbSearchWidth}
            height={Layout.thumbSearchHeight}
            radius={THUMB_RADIUS}
          />
          {decision.decidedByPartner ? (
            <View style={[styles.badge, { backgroundColor: theme.text }]}>
              <ThemedText type="f10" style={[styles.bold, { color: theme.onInk }]}>
                {BADGE_SHARED}
              </ThemedText>
            </View>
          ) : null}
          <View style={[styles.decidedCheck, { backgroundColor: theme.tint }]}>
            <ProductSymbol name="check" size={Layout.iconSmall} color={theme.onTint} />
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.headRow}>
            <View style={styles.headText}>
              <ThemedText type="f10" themeColor="textAssistive" style={[styles.bold, styles.tracked]}>
                {decision.categoryLabel}
              </ThemedText>
              <ThemedText type="f14" numberOfLines={1} style={[styles.bold, styles.name]}>
                {decision.name}
              </ThemedText>
            </View>
          </View>
          <View style={styles.location}>
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1} style={styles.locText}>
              {pickCopy['card.manual']}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.ctaStrip, { borderTopColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${decision.name} ${ACTION_UNDECIDE}`}
          disabled={busy}
          onPress={onUndecide}
          style={({ pressed }) => [styles.compareLink, pressed ? styles.pressed : null]}>
          <ThemedText type="f13" style={[styles.bold, { color: theme.textAssistive }]}>
            {ACTION_UNDECIDE}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/* WP-EMPTY-PICK — 아이콘 없는 회색 카드와 다음 행동. */
/* ────────────────────────────────────────────
   «내 조건에 맞는 곳» — 묶음마다 최대 5곳, 가로 줄(2026-09-25 대표 지시 · 정본 없음).
   카드: 사진 148×116 radius 8 · 업종 10/700 · 이름 14/700 · 금액 한 줄(priceLine) · «Pick» 36.
   사진 · 이름을 누르면 업체 상세, «Pick»은 바로 후보로 담는다.
──────────────────────────────────────────── */
function RecommendRow({
  vendors,
  canPick,
  busy,
  origin,
  onPick,
}: {
  vendors: readonly VendorSummary[];
  canPick: boolean;
  busy: boolean;
  /** Pick 출처(`pickOrigin`) — 업체 상세 Back이 이 Pick으로 돌아온다. */
  origin: string;
  onPick: (vendor: VendorSummary) => void;
}) {
  const theme = useTheme();
  if (vendors.length === 0) return null;

  return (
    <View style={styles.recommend}>
      <ThemedText type="f15" style={[styles.bold, styles.recommendTitle]}>
        {RECOMMEND_TITLE}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendRow}>
        {vendors.map((vendor) => {
          const line = priceLine(vendor.paidPrice, vendor.guidePrice);
          return (
            <View key={vendor.id} style={styles.recommendCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${vendor.name} 자세히 보기`}
                onPress={() => router.push(inStack('/pick', `/search/${encodeURIComponent(vendor.id)}?from=${encodeURIComponent(origin)}`) as never)}
                style={({ pressed }) => [styles.recommendBody, pressed ? styles.pressed : null]}>
                <VendorImage
                  source={vendor.imageUrl ? { uri: vendor.imageUrl } : undefined}
                  category={vendorImageCategory(vendor.category)}
                  width={RECOMMEND_CARD_WIDTH}
                  height={RECOMMEND_THUMB_HEIGHT}
                  radius={THUMB_RADIUS}
                />
                <ThemedText type="f10" themeColor="textAssistive" style={[styles.bold, styles.tracked]}>
                  {VENDOR_CATEGORY_LABEL[vendor.category]}
                </ThemedText>
                <ThemedText type="f14" numberOfLines={1} style={styles.bold}>
                  {vendor.name}
                </ThemedText>
                <ThemedText type="f12" numberOfLines={1} numeric themeColor={line.dim ? 'textAssistive' : 'text'}>
                  {line.text}
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${vendor.name} ${RECOMMEND_PICK}하기`}
                accessibilityState={{ disabled: !canPick || busy }}
                disabled={!canPick || busy}
                onPress={() => onPick(vendor)}
                style={({ pressed }) => [
                  styles.recommendPick,
                  { borderColor: theme.tint },
                  pressed ? styles.pressed : null,
                  !canPick || busy ? styles.disabled : null,
                ]}>
                <ThemedText type="f13" style={[styles.bold, { color: theme.tint }]}>
                  {RECOMMEND_PICK}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

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
          onPress={() => router.push('/search')}
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
   스타일 — 값은 앱 정본 `docs/design/React_Native/pick.js`(frame-001 · 005). 사다리에 없는
   값은 같은 값의 기존 토큰을 주석과 함께 쓴다(저장소 관례). 좌우는 정본 20 — Root 5탭 공통 `ROOT_TAB_GUTTER`
   (2026-09-26 대표 지시 「통일해」).
──────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  wrapper: { flex: 1, width: '100%' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1 },
  errorBox: { padding: Layout.gutter, paddingHorizontal: ROOT_TAB_GUTTER, gap: Layout.rowPaddingY },
  /* 정본 frame-001 스크롤 끝 «height:24px». */
  bottomSpacer: { height: Spacing.four },

  bold: { fontWeight: 700 },
  /* 규격서의 굵기 600 · 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  semibold: { fontWeight: 600 },
  medium: { fontWeight: 500 },
  /* 정본 `cat` 10/14 · ls .06em(0.6px — 같은 값 토큰이 없어 0.5, PR 본문). */
  tracked: { letterSpacing: LetterSpacing.p05, lineHeight: LineHeight.lh14 },
  pressed: { transform: [{ scale: 0.97 }] },
  busy: { opacity: 0.6 },
  /* 비교함이 찼을 때의 «비교하기» `opacity-40`. */
  disabled: { opacity: 0.4 },

  /*
   * 정본 mypickSec: 위 1px 선 · 위아래 20 · 안쪽 사이 10. 정본 선은 inset box-shadow라 자리를 안
   * 먹는다 — 여기 선은 border라 1을 먹으므로 위 여백에서 1을 뺀다(비교 배너 y 156 맞춤).
   */
  mypickSec: {
    borderTopWidth: Border.hairline,
    paddingTop: Layout.listGap - Border.hairline,
    paddingBottom: Layout.listGap,
    gap: Layout.iconTextGap,
  },
  /* 정본 catGroupWrap: 위 16 · 묶음 사이 28. */
  groupWrap: { paddingTop: Spacing.three, gap: Layout.sectionGap },
  /* 정본 catGroupSec: 머리 · 카드 목록 · 더 보기 사이 12. */
  group: { gap: Layout.inlineGap },
  /* 정본 catGroupTitle 18/700 · 줄높이 지정 없음 — 미리보기에서 렌더된 높이 24(f18 기본 28이면 묶음마다 4씩 밀린다). */
  groupTitle: { lineHeight: LineHeight.lh24 },
  /* 정본 rDoneRow: 마크 · 제목 사이 10(iconTextGap), 가운데 맞춤. */
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.iconTextGap, flexShrink: 1 },
  /* 정본 doneMarkSm: 22 · 코랄 원 · 가운데 흰 체크. */
  doneMark: {
    width: DONE_MARK,
    height: DONE_MARK,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHead: {
    paddingHorizontal: ROOT_TAB_GUTTER,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  /* 마크(원)가 끼면 글줄 맞춤이 안 선다 — 가운데 맞춤. */
  groupHeadDone: { alignItems: 'center' },

  // ── 정본 banner: 바깥 16 20(Root 거터) · radius 10 · 안쪽 16 ──
  compareBanner: {
    marginHorizontal: ROOT_TAB_GUTTER,
    marginVertical: Spacing.three,
    borderWidth: Border.hairline,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  /* 정본 bannerCol: 제목 · 부제 사이 2. */
  compareText: { flex: 1, minWidth: 0, gap: Spacing.half },
  /* 03-pick bannerBtn: height 36 · radius 6 · px 16. */
  compareBtn: {
    height: Layout.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
  },

  // ── 정본 chipBarSticky: 위 4 · 아래 16 · 사이 8 ──
  /* 세로 스크롤 안의 가로 스크롤 — 늘어나지 않게 잡는다. 안 잡으면 칩 줄이 남는 높이를 다 먹는다. */
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: ROOT_TAB_GUTTER,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  /* WP-PICK-001 업종 칩: 높이 36 · 좌우 14. */
  chip: {
    height: Layout.chip,
    paddingHorizontal: Layout.chipPaddingX,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDoneMark: {
    width: CHIP_DONE_MARK,
    height: CHIP_DONE_MARK,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── «내 조건에 맞는 곳»(정본 없음 — 대표 지시 2026-09-25): 제목 · 가로 줄 사이 12 · 카드 사이 12 ──
  recommend: { gap: Layout.inlineGap, paddingTop: Spacing.two },
  recommendTitle: { paddingHorizontal: ROOT_TAB_GUTTER },
  recommendRow: { paddingHorizontal: ROOT_TAB_GUTTER, gap: Layout.inlineGap },
  recommendCard: { width: RECOMMEND_CARD_WIDTH, gap: Spacing.two },
  recommendBody: { gap: Spacing.half },
  /* Pick 단추 — 칩 높이 36 · radius 6 · 코랄 1px 선(화면 Primary는 상담 예약이라 채우지 않는다). */
  recommendPick: {
    height: Layout.chip,
    borderWidth: Border.hairline,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 카드 목록 `space-y-3 px-5` — 카드 사이 12 ──
  /* 규격서 「div 430×884 pad 0 20 0 20」. */
  list: {
    paddingHorizontal: ROOT_TAB_GUTTER,
    gap: Layout.inlineGap,
  },
  /* 정본 `sv().card`: radius 16 · 1px 선(결정 1.5 코랄) · 0 1px 2px 그림자. */
  card: {
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    overflow: 'hidden',
    ...Elevation.figmaCard,
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
  /* 정본 `name` 14/19/700 · nameCol 사이 2. */
  name: { marginTop: Spacing.half, lineHeight: LineHeight.lh19 },
  /* 정본 icoX: close-fill 16 · #adb1ba, 안쪽 여백 없음 — 누를 자리는 hitSlop이 넓힌다. */
  removeBtn: { flexShrink: 0 },
  /* 정본 loc: 위 4 · 사이 4 · 지역 12/17. */
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  locText: { lineHeight: LineHeight.lh17 },
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
  /* 정본 moreBtn2: 좌우 20(Root 거터) · 높이 44 · radius 8 · 14/700. */
  moreBtn: {
    marginHorizontal: ROOT_TAB_GUTTER,
    height: 44,
    borderRadius: Radius.picker,
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

  // WP-EMPTY-PICK: 페이지 바깥 20px(Root 거터) · 제목과 카드 간 12, 카드 안쪽 32/20.
  empty: {
    paddingHorizontal: ROOT_TAB_GUTTER,
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
