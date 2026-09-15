import type {
  ConditionStats,
  CurrentUser,
  Review,
  VendorCandidate,
  VendorDetail,
  VendorPhoto,
} from '@weddingpick/api-contract';
import {
  DEEP_DATA_NOTE,
  DISCLOSURE_THRESHOLDS,
  guidePriceLabel,
  MAX_RATING,
  NOT_ENOUGH_DATA,
  TERMS,
  WEDDING_STYLE_LABEL,
  countsTowardScore,
  needsPickProof,
  priceLine,
  rangeLabel,
  styleMatchReason,
  styleOverlap,
  VENDOR_CATEGORY_LABEL,
  regionLabel,
  withParticle,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  getCurrentUser,
  getVendor,
  getVendorConditions,
  listVendorPhotos,
  listVendorReviews,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { BackButton } from '@/components/back-button';
import { LoginSheet } from '@/features/auth/login-sheet';
import { InfoDot, InfoSheet, type InfoTopic } from '@/features/common/info-sheet';
import { savePendingAction } from '@/features/auth/pending-action';
import { readCurrentUserSnapshot } from '@/features/loading/current-user-snapshot';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { vendorBenefit } from '@/features/search/vendor-benefit';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import {
  ActionButton,
  Badge,
  Border,
  ErrorView,
  Layout,
  LetterSpacing,
  LineHeight,
  MARK_HEART_PATH,
  MaxContentWidth,
  ProductSymbol,
  ProgressBar,
  Radius,
  RatingStars,
  SkeletonView,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
  VendorImage,
} from '@weddingpick/ui';

/**
 * «이용한 사람들의 경험»을 보여주는 최소 답한 사람 수(SPEC §2 빈 섹션 처리).
 * 그 아래면 섹션째 숨긴다 — 두 사람의 점수는 경험이 아니라 두 사람이다.
 */
const EXPERIENCE_MIN_PEOPLE = 3;

/** 상세에 미리 보여주는 후기 수. 나머지는 «N개 전체 보기». */
const REVIEW_PREVIEW = 2;

/** 후기 0건일 때의 한 줄(SPEC §2). 빈 섹션 대신 이 줄이 들어간다. */
const NO_REVIEWS_YET = '아직 후기가 없어요 · 첫 후기를 남겨주세요';

/** 0층일 때 실 제보 금액으로 자동 교체된다는 안내. 기준 건수는 공개 사다리에서 읽는다. */
const GUIDE_REPLACED_NOTE = [TERMS.verifiedData, `${DISCLOSURE_THRESHOLDS.limited}건이 되면`, TERMS.verifiedData, '금액으로 바뀌어요'].join(' ');

/** ⑦ 현재 혜택 섹션 제목. spec/strings.ko.json `vendor.section.benefit`. */
const VENDOR_BENEFIT = '현재 혜택';

/** 공식정보 · 업체 안내 문구. spec/strings.ko.json vendor.* */
const OFFICIAL_LAST_CHECK = '마지막 확인';
const REPORT_ERROR = '정보가 틀렸나요? 제보하기';
const GUIDE_PROVIDED = '업체가 제공한 정보예요';
const EXPERIENCE_COUNT = (n: number) => `${n}명이 답했어요`;
const REVIEW_VIEW_ALL = (n: number) => `${n}개 전체 보기`;
const MAP_LINK = '지도에서 보기';
/** 기준금액 ⓘ 설명 — SPEC §2 고정 문장. */
const BASE_AMOUNT_NOTE = `${TERMS.baseAmount}은 실 제보의 중앙값이에요`;

/**
 * 업체 상세 탭 넷 — Figma 신규 디자인(`VendorFlows.tsx` `VendorDetailPage`)의 탭 배치를
 * 가져온다(2026-09-14 대표 지시 「피그마 기준 개편」, MASTER 확정). **탭 구조만 가져오고
 * 안의 문구·수치·데이터는 우리 것 그대로다** — `docs/rn-migration/VENDOR_SCREEN_PARITY.md` §「탭
 * 배치 제안」 참고. Figma는 Pick·상담예약 CTA 둘을 동시에 세우지만 「화면당 Primary CTA 1개」
 * 원칙(CLAUDE.md)은 그대로 지켜 Pick 하나만 하단 고정 영역에 둔다.
 */
type VendorTab = 'intro' | 'price' | 'review' | 'info';

const VENDOR_TABS: { key: VendorTab; label: string }[] = [
  { key: 'intro', label: '소개' },
  { key: 'price', label: '가격' },
  { key: 'review', label: '후기' },
  { key: 'info', label: '정보' },
];

/** «2026년 8월 28일». 공식정보의 확인일 표기(시안 10a). */
function formatKoreanDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** «2026.04~08» · 해가 다르면 «2025.11~2026.03». 조건별 행의 집계 기간 — 한 줄에 들어가야 한다. */
function formatPeriod(startIso: string, endIso: string): string {
  const start = startIso.slice(0, 7).replace('-', '.');
  const end = endIso.slice(0, 7).replace('-', '.');
  return start.slice(0, 4) === end.slice(0, 4) ? `${start}~${end.slice(5)}` : `${start}~${end}`;
}

/** «2026.07». 후기 머리의 작성 시기(시안 10a). */
function formatYearMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7).replace('-', '.');
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * WP-VEND-001 업체 상세. 시안 09-core-loop.dc.html #10a. 섹션 순서 고정(screens.json layout):
 *
 *   ① 대표 이미지 260 + 카운터  ② 배지 → 업체명 26 → 핵심 조건 16  ③ 추천 이유(스타일 칩 + 불릿)
 *   ④ 실 제보(금액 카드 + 조건별 행)  ⑤ Pick 56 + 비교  ⑥ 업체 안내  ⑦ 현재 혜택 brand 카드
 *   ⑧ 이용한 사람들의 경험  ⑨ 후기 + 업체 반론  ⑩ 공식정보 + 정보 오류 제보
 *
 * **Pick 버튼은 근거를 다 읽은 자리(④ 다음)에 둔다.** 별점은 쓰지 않는다(SPEC §6.1) — 경험은
 * «N명»과 막대로만, 후기는 글로만 보여준다. 빈 섹션은 접는다(SPEC §2): 후기 0건은 한 줄, 경험
 * 3명 미만은 숨김, 혜택·업체 안내 자료가 없으면 섹션째 없다.
 *
 * reasons는 검색·TOP3에서 넘어올 때만 존재한다. 이 화면에서 직접 접근하면 없다.
 */
export default function VendorDetailScreen() {
  const params = useLocalSearchParams<{ vendorId: string; reasons?: string }>();
  const vendorId = params.vendorId;
  const theme = useTheme();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  /** 조건이 비슷한 결제 사례. 상세와 따로 읽는다 — 하나가 늦어도 나머지는 뜬다. */
  const [conditions, setConditions] = useState<ConditionStats | null>(null);
  /**
   * 승인된 업체 실사진. WP-VEND-002. 못 읽어도 상세 화면은 그대로 뜬다 —
   * 대표 이미지가 카테고리 기본으로 조용히 대체될 뿐이다.
   */
  const [photos, setPhotos] = useState<VendorPhoto[]>([]);
  /** 후기 — Pick 인증 후기가 앞에 온다. */
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** 로그인 시트가 떠 있는가. 첫 Pick이 대표 트리거다(v3.10 §3). */
  const [loginOpen, setLoginOpen] = useState(false);
  /** Pick 완료 시트(WP-SHT-002) · 해제 시트(WP-SHT-003). */
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  /**
   * «나». 고른 스타일과 업체 태그의 일치를 그리려고 읽는다(SPEC §13.6). 로그인 전이면
   * null이고 그때는 칩이 전부 회색이다 — 없는 취향을 지어내지 않는다.
   */
  const [me, setMe] = useState<CurrentUser | null>(() => readCurrentUserSnapshot());
  /** 후기 목록을 읽어 왔는가. 읽기 전에는 «아직 후기가 없어요»를 단정하지 않는다. */
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  /** 금액 옆 ⓘ가 연 설명 시트(WP-SHT-014 · WP-SHT-015). null이면 닫혀 있다. */
  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  /** 업체 상세 탭. 첫 진입은 항상 «소개» — 검색·TOP3에서 넘어온 추천 이유가 그 탭에 있다. */
  const [tab, setTab] = useState<VendorTab>('intro');

  /* 내 후보 — 검색 카드 · 비교 dock과 같은 목록. Pick 전·후를 여기서 읽는다. */
  const candidates = useMyCandidates();

  /**
   * 검색·TOP3에서 넘어올 때만 존재. 쉼표로 구분된 이유 문장.
   * 이 화면에서 직접 접근하면 빈 배열이다.
   */
  const reasons: string[] =
    params.reasons ? params.reasons.split(',').filter(Boolean) : [];

  useEffect(() => {
    getVendor(vendorId)
      .then(setVendor)
      .catch((caught: Error) => setError(caught.message));

    /*
     * 실패해도 조용히 넘긴다. 조건별은 곁가지라, 못 읽었다고 업체 화면 전체가
     * 오류로 바뀌면 잃는 것이 더 크다.
     */
    getVendorConditions(vendorId)
      .then(setConditions)
      .catch(() => setConditions(null));

    /*
     * 실사진도 곁가지다. 이미지 서버가 잠깐 안 되더라도 카테고리 기본 이미지가
     * 대신 나오면 되지, 업체 상세 전체가 오류로 바뀔 일은 아니다.
     */
    listVendorPhotos(vendorId)
      .then((res) => setPhotos(res.photos))
      .catch(() => setPhotos([]));

    listVendorReviews(vendorId)
      .then((res) => {
        /*
         * Pick 인증 후기(payment / contract / usage 확인)를 앞에, 일반 후기(상담제보)를
         * 뒤에 둔다. 어떤 근거로 쓴 글인지는 머리의 배지가 말한다.
         */
        const verified = res.reviews.filter((r) => countsTowardScore(r.verification));
        const regular = res.reviews.filter((r) => !countsTowardScore(r.verification));
        setReviews([...verified, ...regular]);
        setReviewsLoaded(true);
      })
      .catch(() => undefined);
  }, [vendorId]);

  useEffect(() => {
    if (!isServerConfigured) return;
    let alive = true;

    /* 로그인 전에는 «나»가 없다 — 부르지 않는다. 실패해도 상세는 그대로 뜬다. */
    loadToken()
      .then((token) => (token ? getCurrentUser() : null))
      .then((loaded) => {
        if (alive) setMe(loaded);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!vendor) {
    return <SkeletonView hero />;
  }

  const myCandidate = candidates.candidateFor(vendor.id);
  const picked = myCandidate !== null;
  const pickBusy = candidates.busyVendorId === vendor.id;

  /**
   * Pick(SPEC §13.1). 통합정책 v3.10 §3 — **첫 Pick이 대표 로그인 트리거**다.
   * Pick 후면 해제 시트를, 로그인 전이면 누른 것을 적어두고 로그인 시트를 연다.
   */
  async function pick() {
    if (myCandidate) {
      setUnpickTarget(myCandidate);
      return;
    }
    const result = await candidates.pick(vendor!.id);
    if (result === 'picked') setPickDoneOpen(true);
    else if (result === 'login') {
      await savePendingAction({ kind: 'pick', vendorId: vendor!.id, vendorName: vendor!.name });
      setLoginOpen(true);
    } else setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  async function confirmUnpick() {
    if (!unpickTarget) return;
    const ok = await candidates.unpick(unpickTarget);
    setUnpickTarget(null);
    if (!ok) setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  /**
   * 비교(SPEC §13.11). 비교 화면은 WP-CMP-002 하나고 진입에 따라 후보 초기값만
   * 다르다 — 업체 상세에서는 **현재 업체를 A로 고정**하고 B·C는 같은 업종 후보 또는
   * 웨딩픽 추천으로 채운다. 후보를 바꾸는 건 그 화면의 시트에서만 한다.
   */
  function addToCompare() {
    router.push({
      pathname: '/pick/compare',
      params: { category: vendor!.category, fixed: vendor!.id, fixedName: vendor!.name },
    });
  }

  const paidPrice = vendor.prices.paidPrice;
  const isLimited = paidPrice.stage === 'limited';
  const isDetailed = paidPrice.stage === 'detailed';
  /* 금액 한 줄 — 0층 «업체 안내 150만원~» · 1층 «수집 중» · 3건+ 구간. 검색·비교와 같은 규칙. */
  const line = priceLine(paidPrice, vendor.guidePrice);
  /* 실 제보도 업체 안내도 없다 — «수집 중» + Pick 인증 CTA로 채운다(빈 섹션 처리). */
  const wantsPickProof = needsPickProof(paidPrice, vendor.guidePrice);
  /* ⑦ 현재 혜택. 서버에 혜택 자료가 없어 지금은 늘 null이고, null이면 섹션을 그리지 않는다. */
  const benefit = vendorBenefit(vendor);

  /* 고른 스타일과 업체 태그의 일치. 로그인 전·미선택이면 겹침이 없고 칩은 전부 회색이다. */
  const chosenStyles: readonly WeddingStyle[] = me?.styleTags ?? [];
  const matchedStyles = styleOverlap(chosenStyles, vendor.styleTags);
  const styleReason = styleMatchReason(chosenStyles, vendor.styleTags);
  /* 첫 불릿은 스타일 일치, 그 뒤가 넘어온 이유들. 같은 문장이 두 번 오지 않게 거른다. */
  const reasonLines = [
    ...(styleReason ? [styleReason] : []),
    ...reasons.filter((reason) => reason !== styleReason),
  ];
  const hasRecommendation = vendor.styleTags.length > 0 || reasonLines.length > 0;

  /*
   * 조건별 행(시안 priceCond). 사람이 확인한 계약 통계(products)는 상품별 구간으로, 조건이
   * 비슷한 사례(conditions)는 그 조건의 구간으로 — 둘 다 실 제보 자리에 든다(vendor-detail.ts).
   */
  const conditionRows: { key: string; cond: string; n: string; range: string; dim: boolean }[] = [
    ...vendor.prices.products.map((product) => ({
      key: `${product.productLabel}-${product.docType}`,
      cond: product.productLabel,
      n: `${TERMS.verifiedData} ${product.stat.sampleCount}건 · ${formatPeriod(product.stat.periodStart, product.stat.periodEnd)}`,
      range: rangeLabel(product.stat.p25, product.stat.p75),
      dim: false,
    })),
    ...(conditions?.available
      ? [
          conditions.price.stage === 'collecting'
            ? {
                key: 'condition',
                cond: conditions.condition,
                n: conditions.price.caption,
                range: line.dim ? line.text : '수집 중',
                dim: true,
              }
            : {
                key: 'condition',
                cond: conditions.condition,
                n: conditions.price.caption,
                range: rangeLabel(conditions.price.low, conditions.price.high),
                dim: false,
              },
        ]
      : []),
  ];

  /* «이용한 사람들의 경험»은 3명 미만이면 섹션째 숨긴다(SPEC §2). 별점은 그리지 않는다(§6.1). */
  const experience = vendor.usageScore;
  const showExperience = experience.available && experience.count >= EXPERIENCE_MIN_PEOPLE;
  const previewReviews = reviews.slice(0, REVIEW_PREVIEW);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/*
          상단 내비 — 피그마 `VendorDetailPage` 헤더(2026-09-14 정본): 56 · 좌우 16 · ← 40 원 ·
          업체명 14/700 가운데 · 아래 선. 오른쪽의 «공유»(링크 복사)는 우리 앱에 그 기능이
          없어 두지 않는다 — 제목은 그 자리만큼(40) 오른쪽을 비워 가운데를 맞춘다.
        */}
        <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
          <BackButton />
          {/* 규격서 vendor-1.txt: 제목 «14/700 · lh 20 · pad 0 40 0 0». */}
          <ThemedText type="f14" numberOfLines={1} style={[styles.bold, styles.navTitle]}>
            {vendor.name}
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>

          {/*
            ①  대표 이미지 390×260 + «1 / N» 카운터.
            승인된 실사진이 있으면 그 대표 이미지를, 없으면 카테고리 기본으로
            대체한다(CLAUDE.md §8). 실제 사진이 한 장이라도 있을 때만 눌러서 전체보기로 간다 —
            없으면 눌러도 소득이 없는 버튼이 된다.
          */}
          <Pressable
            accessibilityRole={photos.length > 0 ? 'button' : undefined}
            accessibilityLabel={photos.length > 0 ? `사진 ${photos.length}장 보기` : undefined}
            disabled={photos.length === 0}
            onPress={() => router.push(`/search/${vendor.id}/images`)}
            style={styles.hero}>
            <VendorImage
              source={photos[0] ? { uri: photos[0].url } : undefined}
              category={vendorImageCategory(vendor.category)}
              width={undefined}
              height={Layout.heroVendor}
              radius={0}
            />
            {/*
              피그마 히어로(288 · 2026-09-14 정본): 아래에서 위로 어두워지는 막
              (`from-black/55 via-black/10 to-transparent`) 위에 배지 줄과 업체명 32 흰 글자.
              그라데이션은 react-native-svg로 그린다 — 그라데이션 패키지를 새로 들이지 않는다.
            */}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
              <Defs>
                <LinearGradient id="heroFade" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0" stopColor={theme.backgroundInk} stopOpacity="0.55" />
                  <Stop offset="0.5" stopColor={theme.backgroundInk} stopOpacity="0.1" />
                  <Stop offset="1" stopColor={theme.backgroundInk} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#heroFade)" />
            </Svg>
            <View style={styles.heroText} pointerEvents="none">
              <View style={styles.heroBadgeRow}>
                {vendor.sourceNote ? (
                  /* 피그마 «인증» pill — 키 컬러 · 흰 글자 · 체크 10. 우리 뜻은 «공공기관 확인»이다. */
                  <View style={[styles.heroBadge, { backgroundColor: theme.tint }]}>
                    {/* 규격서: pill «10/700 · lh 15 · pad 2 8 · gap 4» · 체크 10. */}
                    <ProductSymbol name="checkCircle" size={Layout.iconTiny} color={theme.onTint} />
                    <ThemedText type="f10" style={[styles.bold, { color: theme.onTint }]}>
                      공공기관 확인
                    </ThemedText>
                  </View>
                ) : null}
                <View style={styles.heroCategory}>
                  {/* 규격서: 업종 «12/700 #FFFFFF 70% · lh 16 · ls 0.3px» · 이름 «32/700 · lh 40 · ls -0.64px». */}
                  <ThemedText type="f12" style={[styles.bold, styles.tracked03, { color: theme.onInk }]}>
                    {VENDOR_CATEGORY_LABEL[vendor.category]}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="f32" numberOfLines={2} style={[styles.bold, styles.heroName, { color: theme.onInk }]}>
                {vendor.name}
              </ThemedText>
            </View>
            {photos.length > 0 ? (
              <View style={[styles.photoCounter, { backgroundColor: theme.scrim }]}>
                <ThemedText type="micro" numeric style={{ color: theme.onTint }}>
                  1 / {photos.length}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>

          {/*
            ② 요약 줄 — 피그마 quick stats: 좌우 24 · 상하 12 · 아래 선 · 사이 12.
            «★ 4.9»는 그리지 않는다(별점은 그리지 않는다 · SPEC §6.1). 실 제보 N건 · 핀 + 지역 ·
            오른쪽 끝 금액(14/700).
          */}
          <View style={[styles.statsRow, { borderBottomColor: theme.border }]}>
            {/* 규격서: «14/400 #868B94 · lh 20» 셋 · 핀 14 · 금액 «14/700». */}
            <ThemedText type="f14" themeColor="textAssistive" numeric>
              {`${TERMS.verifiedData} ${paidPrice.count}건`}
            </ThemedText>
            <ThemedText type="f14" themeColor="textAssistive">·</ThemedText>
            <View style={styles.statsPlace}>
              <ProductSymbol name="pin" size={Layout.iconSmall} color={theme.textAssistive} />
              <ThemedText type="f14" themeColor="textAssistive" numberOfLines={1}>
                {regionLabel(vendor.region)}
              </ThemedText>
            </View>
            <View style={styles.statsPrice}>
              <ThemedText
                type="f14"
                numeric
                numberOfLines={1}
                themeColor={line.dim ? 'textAssistive' : undefined}
                style={styles.bold}>
                {line.text}
              </ThemedText>
            </View>
          </View>

          {/*
            탭 넷 — 소개 · 가격 · 후기 · 정보. Figma `VendorDetailPage`의 탭 배치를 가져온
            자리다(위 VENDOR_TABS 주석). 안의 섹션 순서·문구·데이터는 그대로 두고 담는
            그릇만 바뀐다.
          */}
          <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            {VENDOR_TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t.label}
                  style={styles.tabBtn}
                  onPress={() => setTab(t.key)}>
                  {/* 피그마 탭: 14/700 · 켬은 잉크 글자 + 아래 잉크 선 2(전폭), 끔은 보조색. */}
                  <ThemedText type="f14" themeColor={active ? undefined : 'textAssistive'} style={styles.bold}>
                    {t.label}
                  </ThemedText>
                  <View
                    style={[
                      styles.tabIndicator,
                      { backgroundColor: active ? theme.text : 'transparent' },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {/*
            ③ 추천 이유 — 「소개」 탭. 첫 줄은 업체 styleTags 전부를 칩으로 — 내가 고른 것과
            겹치는 것만 coral + 체크, 업체만 가진 것은 회색(SPEC §13.6 · screens.json
            styleMatch.chip). 첫 불릿은 일치 개수. 조건 칩에 «도시적인»이 떠도 이 업체에
            어떻게 반영됐는지 보이지 않으면 추천을 믿지 않는다.
          */}
          {tab === 'intro' ? (
            /*
              피그마 「소개」 탭 `space-y-7 px-5 pt-6`: 포트폴리오 띠 → 태그 → (설명) → 실 제보
              어두운 카드 → 우리 조건에 맞는 이유(3열) → (자주 묻는 질문). 설명문과 FAQ는 서버에
              그 칸이 없어 그리지 않는다 — 만들어 넣지 않는다.
            */
            <View style={styles.introSection}>
              {/* 포트폴리오 — 승인된 실사진 띠. 144 정사각 · radius 18 · 사이 8. 사진이 없으면 띠째 없다. */}
              {photos.length > 0 ? (
                <View>
                  <ThemedText type="f14" style={[styles.bold, styles.introHead]}>포트폴리오</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioStrip}>
                    {photos.map((photo, index) => (
                      <Pressable
                        key={photo.url}
                        accessibilityRole="button"
                        accessibilityLabel={`포트폴리오 ${index + 1}`}
                        onPress={() => router.push(`/search/${vendor.id}/images`)}>
                        <VendorImage
                          source={{ uri: photo.url }}
                          category={vendorImageCategory(vendor.category)}
                          width={Layout.thumbPortfolio}
                          height={Layout.thumbPortfolio}
                          radius={Radius.thumb}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {/*
                태그 — 피그마 `#태그` 칩(좌우 14 · 상하 8 · pill · 회색 면 · 12/600). 우리 태그는
                업체 스타일 넷이고, 내가 고른 것과 겹치는 것만 키 컬러 + 체크(SPEC §13.6).
              */}
              {vendor.styleTags.length > 0 ? (
                <View style={styles.styleChipRow}>
                  {vendor.styleTags.map((style) => {
                    const matched = matchedStyles.includes(style);
                    return (
                      <View
                        key={style}
                        accessibilityLabel={
                          matched ? `${WEDDING_STYLE_LABEL[style]} · 고른 스타일` : WEDDING_STYLE_LABEL[style]
                        }
                        style={[
                          styles.styleChip,
                          { backgroundColor: matched ? theme.tintSurface : theme.backgroundElement },
                        ]}>
                        {matched ? (
                          <ProductSymbol name="check" size={Layout.iconMicro} color={theme.tint} />
                        ) : null}
                        {/* 규격서: 태그 «12/600 · lh 16 · pad 8 14». */}
                        <ThemedText type="f12" themeColor={matched ? 'tint' : undefined} style={styles.semibold}>
                          {`#${WEDDING_STYLE_LABEL[style]}`}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/*
                실 제보 카드 — 피그마 «VERIFIED PRICE RANGE» 어두운 카드(잉크 면 · radius 16 · 안쪽 20).
                영문 eyebrow는 걷어낸다(C-9). 금액 24/700 흰 글자 · 오른쪽 «실 제보 N건» · 아래 한 줄.
                자세한 것은 「가격」 탭에 그대로 있다.
              */}
              <View style={[styles.priceDark, { backgroundColor: theme.backgroundInk }]}>
                <View style={styles.priceDarkRow}>
                  {/* 규격서: 금액 «24/500 · lh 32» · 꼬리 «12/400 65%» · 아래 줄 «12/400 55% · lh 20 · mar 12». */}
                  <ThemedText type="f24" numeric style={[styles.medium, { color: theme.onInk }]}>
                    {line.text}
                  </ThemedText>
                  {!line.dim ? (
                    <View style={styles.priceDarkTail}>
                      <ThemedText type="f12" numeric style={{ color: theme.onInk }}>
                        {`${TERMS.verifiedData} ${paidPrice.count}건`}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <View style={styles.priceDarkNote}>
                  <ThemedText type="f12" style={[styles.noteLine, { color: theme.onInk }]}>
                    {line.dim ? line.caption : BASE_AMOUNT_NOTE}
                  </ThemedText>
                </View>
              </View>

              {/* 우리 조건에 맞는 이유 — 피그마 3열 칸(radius 22 · 회색 면 · 안쪽 8/12 · 체크 12 + 11/600). */}
              <View style={[styles.reasonSection, { borderTopColor: theme.border }]}>
                <View style={styles.reasonHead}>
                  {/* 규격서: 제목 «14/700 · lh 20» · «내 조건 기준» «11/400 #868B94 · lh 17». */}
                  <ThemedText type="f14" style={styles.bold}>우리 조건에 맞는 이유</ThemedText>
                  <ThemedText type="f11" themeColor="textAssistive">내 조건 기준</ThemedText>
                </View>
                {hasRecommendation && reasonLines.length > 0 ? (
                  <View style={styles.reasonGrid}>
                    {reasonLines.map((reason) => (
                      <View key={reason} style={[styles.reasonCell, { backgroundColor: theme.backgroundElement }]}>
                        <ProductSymbol name="check" size={Layout.iconMicro} color={theme.text} />
                        {/* 규격서: 칸 글자 «11/600 · lh 16». */}
                        <ThemedText type="f11" style={[styles.semibold, styles.reasonText]}>
                          {reason}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <ThemedText type="body" themeColor="textSecondary">
                    아직 추천 이유가 없어요.
                  </ThemedText>
                )}
              </View>
            </View>
          ) : null}

          {/* ④ 실 제보 — 「가격」 탭. 정보 5단계(SPEC §2). 금액 카드 + 조건별 행 */}
          {tab === 'price' ? (
          <>
          <View style={styles.section}>
            {/* 제목 옆 ⓘ — WP-SHT-014 «실 제보가 뭔가요?»(screens.json entry «금액 옆 ⓘ»). */}
            <View style={styles.titleWithInfo}>
              <ThemedText type="t4">{TERMS.verifiedData}</ThemedText>
              <InfoDot
                label={`${TERMS.verifiedData} 설명`}
                onPress={() => setInfoTopic('verifiedData')}
              />
            </View>

            <View style={[styles.priceCard, { backgroundColor: theme.backgroundElement }]}>
              {/* 0층·1층은 회색(#868B94)으로 낮춘다. 빈 칸이나 «—»는 없다. */}
              <ThemedText
                type="amount"
                numeric
                themeColor={line.dim ? 'textAssistive' : undefined}>
                {line.text}
              </ThemedText>
              <ThemedText type="t7" themeColor="textAssistive" numeric>
                {line.caption}
              </ThemedText>
              {isDetailed ? (
                /* 기준금액 옆 ⓘ — WP-SHT-015 «기준금액이 뭔가요?». */
                <View style={styles.noteWithInfo}>
                  <ThemedText type="t7" themeColor="textAssistive" style={styles.noteText}>
                    {BASE_AMOUNT_NOTE}
                  </ThemedText>
                  <InfoDot
                    label={`${TERMS.baseAmount} 설명`}
                    onPress={() => setInfoTopic('baseAmount')}
                  />
                </View>
              ) : null}
              {isLimited ? (
                <ThemedText type="t7" themeColor="textAssistive">
                  {NOT_ENOUGH_DATA}
                </ThemedText>
              ) : null}
              {line.guide ? (
                <ThemedText type="t7" themeColor="textAssistive">
                  {GUIDE_REPLACED_NOTE}
                </ThemedText>
              ) : null}
            </View>

            {/* 조건별 3행 — 행 56 · 조건 16 + 건수 14 / 구간 16 700 */}
            {conditionRows.length > 0 ? (
              <View style={styles.rows}>
                {conditionRows.map((row) => (
                  <View key={row.key}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <ThemedText type="t6" themeColor="textStrong" numberOfLines={1}>{row.cond}</ThemedText>
                        <ThemedText type="t7" themeColor="textAssistive" numeric numberOfLines={1}>{row.n}</ThemedText>
                      </View>
                      <ThemedText
                        type="t6"
                        numeric
                        themeColor={row.dim ? 'textAssistive' : undefined}
                        style={[styles.bold, styles.rowTail]}>
                        {row.range}
                      </ThemedText>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  </View>
                ))}
              </View>
            ) : null}

            {/* 조건이 비슷한 사례는 Pick 인증이 연다(v2.0 D-1). 열려 있으면 이 줄이 없다. */}
            {!vendor.prices.deepData ? (
              <ThemedText type="t7" themeColor="textAssistive">
                {vendor.prices.deepDataNote ?? DEEP_DATA_NOTE}
              </ThemedText>
            ) : conditions && !conditions.available ? (
              <ThemedText type="t7" themeColor="textAssistive">{conditions.note}</ThemedText>
            ) : null}

            {/* 실 제보도 업체 안내도 없다 — Pick 인증 CTA로 채운다(SPEC §2 빈 섹션 처리). */}
            {wantsPickProof ? (
              <ActionButton
                label="Pick 인증"
                hint="낸 금액이 보이는 사진 한 장이면 업체와 금액을 자동으로 읽어요"
                onPress={() => router.push('/capture/payment/consent')}
              />
            ) : null}
          </View>

          {/* ⑥ 업체 안내 — 업체가 말한 것. 실 제보와 섞지 않는다. 자료가 없으면 섹션째 없다. */}
          {vendor.guidePrice ? (
            <>
              <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText type="t4">{TERMS.vendorNotice}</ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive">{GUIDE_PROVIDED}</ThemedText>
                </View>
                <View style={styles.rows}>
                  <View>
                    <View style={styles.row}>
                      <ThemedText type="t6" themeColor="textStrong">시작 금액</ThemedText>
                      <ThemedText type="t6" numeric style={[styles.bold, styles.rowTail]}>
                        {guidePriceLabel(vendor.guidePrice.fromKrw)}
                      </ThemedText>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  </View>
                  <View>
                    <View style={styles.row}>
                      <ThemedText type="t6" themeColor="textStrong">출처</ThemedText>
                      <ThemedText type="t6" numberOfLines={1} style={[styles.bold, styles.rowTail, styles.rowTailWide]}>
                        {vendor.guidePrice.sourceLabel}
                      </ThemedText>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {/*
            ⑦ 현재 혜택 — 업체가 지금 주는 것. brand 카드(coral 7% 바탕 · 32% 테두리) 한 장.
            **자료가 없으면 섹션째 그리지 않는다**(SPEC §2 빈 섹션 · states «혜택 있음·없음·만료»).
            지금 서버는 혜택을 내려주지 않아 늘 이 자리가 비어 있다 — 근거는 `vendor-benefit.ts`.
          */}
          {benefit ? (
            <>
              <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
              <View style={styles.section}>
                <ThemedText type="t4">{VENDOR_BENEFIT}</ThemedText>
                <View
                  style={[
                    styles.benefitCard,
                    { backgroundColor: theme.tintSubtle, borderColor: theme.tintBorder },
                  ]}>
                  <ThemedText type="t5">{benefit.title}</ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive" numeric>
                    {benefit.meta}
                  </ThemedText>
                </View>
              </View>
            </>
          ) : null}
          </>
          ) : null}

          {/* ⑧+⑨ — 「후기」 탭. */}
          {tab === 'review' ? (
          <>
          {/*
            ⑧ 이용한 사람들의 경험 — 5.0 만점 별점 + 항목별 막대. 3명 미만이면 섹션째 숨긴다.

            **별점을 쓴다(2026-09-09 사용자 결정).** SPEC §6.1은 「별점을 쓰지 않습니다 ·
            평점 숫자를 만들지 않습니다」이지만 사용자가 뒤집었다 — 후기는 별점으로
            나타내고 무조건 5.0 만점으로 환산한다. 명세보다 사용자 결정이 앞선다.
            `docs/AI_HANDOFF.md` 「사용자 결정」 표에 같은 내용이 있다.

            평균은 서버가 이미 준다(`usageScore.average`, 1~5). 화면이 안 그리고 있었을 뿐이다.
            항목별 막대는 그대로 둔다 — 별점은 «얼마나 좋았나», 막대는 «무엇이 좋았나»라
            서로를 대신하지 못한다.
          */}
          {showExperience && experience.available ? (
            <>
              <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText type="t4">{TERMS.experience}</ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive" numeric>
                    {EXPERIENCE_COUNT(experience.count)}
                  </ThemedText>
                </View>
                <RatingStars value={experience.average} count={experience.count} size="large" />
                <View style={styles.meters}>
                  {experience.checklist
                    .filter((item) => !item.collecting)
                    .map((item) => (
                      <View key={item.key} style={styles.meter}>
                        <View style={styles.meterHead}>
                          <ThemedText type="t6" themeColor="textStrong">{item.label}</ThemedText>
                          <ThemedText type="t6" numeric style={styles.bold}>{item.answered}명</ThemedText>
                        </View>
                        <ProgressBar
                          value={item.percent / 100}
                          height={METER_HEIGHT}
                          color={item.needsAttention ? 'cautionary' : 'tint'}
                        />
                      </View>
                    ))}
                  {experience.checklist.length === 0
                    ? experience.aspects.map((aspect) => (
                        <View key={aspect.key} style={styles.meter}>
                          <ThemedText type="t6" themeColor="textStrong">{aspect.label}</ThemedText>
                          <ProgressBar value={aspect.average / MAX_RATING} height={METER_HEIGHT} />
                        </View>
                      ))
                    : null}
                </View>
                {experience.caption ? (
                  <ThemedText type="t7" themeColor="textAssistive">{experience.caption}</ThemedText>
                ) : null}
              </View>
            </>
          ) : null}

          {/* ⑨ 후기 + 업체 반론. 0건이면 빈 섹션 대신 한 줄(SPEC §2). 별점 없이 글로만. */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <ThemedText type="t4">{TERMS.review}</ThemedText>
              {reviews.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`후기 ${REVIEW_VIEW_ALL(reviews.length)}`}
                  hitSlop={Spacing.two}
                  onPress={() => router.push(`/search/${vendor.id}/reviews`)}>
                  <ThemedText type="t7" themeColor="textAssistive" numeric style={styles.bold}>
                    {REVIEW_VIEW_ALL(reviews.length)}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            {previewReviews.length > 0 ? (
              <View style={styles.reviewList}>
                {previewReviews.map((review, index) => (
                  <View key={review.id} style={styles.reviewList}>
                    <View style={styles.review}>
                      <View style={styles.reviewHead}>
                        <ThemedText type="t6" style={styles.bold}>{review.roleLabel}</ThemedText>
                        {countsTowardScore(review.verification) ? <Badge kind="ok">Pick 인증</Badge> : null}
                        <ThemedText type="t7" themeColor="textAssistive" numeric>
                          {formatYearMonth(review.createdAt)}
                        </ThemedText>
                      </View>
                      <ThemedText type="body" themeColor="textStrong">{review.body}</ThemedText>
                    </View>
                    {review.rebuttal ? (
                      <View style={[styles.rebuttal, { backgroundColor: theme.backgroundElement }]}>
                        <ThemedText type="t7" themeColor="textSecondary" style={styles.bold}>업체 반론</ThemedText>
                        <ThemedText type="body" themeColor="textStrong">{review.rebuttal.body}</ThemedText>
                      </View>
                    ) : null}
                    {index < previewReviews.length - 1 ? (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : reviewsLoaded ? (
              /* 후기 0건 — 빈 섹션 대신 한 줄. 누르면 첫 후기를 쓰는 자리로 간다. */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={NO_REVIEWS_YET}
                onPress={() => router.push(`/search/${vendor.id}/write-review`)}
                style={styles.noReviewsRow}>
                <ThemedText type="t6" themeColor="textSecondary">{NO_REVIEWS_YET}</ThemedText>
              </Pressable>
            ) : null}
          </View>
          </>
          ) : null}

          {/* ⑩ 공식정보 — 「정보」 탭. 항목마다 출처. 마지막 확인일 · 지도 · 정보 오류 제보 */}
          {tab === 'info' ? (
          <View style={styles.tabSection}>
            <ThemedText type="t4">공식정보</ThemedText>
            <View style={styles.rows}>
              <View>
                <View style={styles.row}>
                  <ThemedText type="t6" themeColor="textAssistive">지역</ThemedText>
                  <ThemedText type="t6" style={styles.rowTail}>{regionLabel(vendor.region)}</ThemedText>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
              </View>
              <View>
                <View style={styles.row}>
                  <ThemedText type="t6" themeColor="textAssistive">{OFFICIAL_LAST_CHECK}</ThemedText>
                  <ThemedText type="t6" numeric style={styles.rowTail}>
                    {formatKoreanDate(vendor.lastVerifiedAt)}
                  </ThemedText>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
              </View>
              {vendor.sourceNote ? (
                <View>
                  <View style={styles.row}>
                    <ThemedText type="t6" themeColor="textAssistive">출처</ThemedText>
                    <ThemedText type="t6" numberOfLines={2} style={[styles.rowTail, styles.rowTailWide]}>
                      {vendor.sourceNote}
                    </ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                </View>
              ) : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={MAP_LINK}
                onPress={() => {
                  const query = encodeURIComponent(`${vendor.name} ${vendor.region}`);
                  void Linking.openURL(`https://map.kakao.com/?q=${query}`);
                }}>
                <View style={styles.row}>
                  <ThemedText type="t6" style={styles.rowGrow}>{MAP_LINK}</ThemedText>
                  <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={REPORT_ERROR}
              /* WP-VEND-006 — 무엇이 틀렸는지 고르는 화면. 범용 문의로 보내지 않는다. */
              onPress={() => router.push(`/search/${vendor.id}/fix-report`)}>
              <View style={styles.row}>
                <ThemedText type="t6" themeColor="textSecondary" style={styles.rowGrow}>{REPORT_ERROR}</ThemedText>
                <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
              </View>
            </Pressable>
          </View>
          ) : null}

          <View style={styles.bottomPad} />
        </ScrollView>

        {/*
          ⑤ Pick 56 Primary(coral) + 비교 Secondary — 탭 전환과 무관하게 항상 보이는 하단
          고정 영역(Figma `VendorDetailPage`의 fixed CTA 배치를 가져왔다). 근거를 다 읽은
          자리라는 원래 의도(④ 다음)는 「가격」 탭을 열면 바로 위에 실 제보가 있는 것으로
          지킨다. Primary는 Pick 하나뿐 — 화면당 Primary CTA 1개(CLAUDE.md).
        */}
        {/*
          피그마 fixed CTA(2026-09-14 정본): 안쪽 16 · 위 선 · 사이 8 · 단추 56 · radius 16.
          시안은 [♡ 56 정사각][상담 일정 잡기 Primary]인데 상담은 이용약관 제3조로 고지 후
          구현 대기라 Primary 자리를 못 준다. 「Pick이 가장 중요한 행동, 비교는 보조」(CLAUDE.md)
          대로 Primary는 Pick(하트 + 라벨), 정사각은 비교다 — 판단 필요로 PR에 적었다.
        */}
        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="비교"
              style={({ pressed }) => [
                styles.compareBtn,
                { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.background },
              ]}
              onPress={addToCompare}>
              <ProductSymbol name="chart" size={Layout.iconRow} color={theme.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={picked ? `${vendor.name} Pick했어요` : `${vendor.name} Pick하기`}
              accessibilityState={{ disabled: pickBusy }}
              disabled={pickBusy}
              style={({ pressed }) => [
                styles.pickBtn,
                { backgroundColor: theme.tint },
                pressed ? styles.pressed : null,
                pickBusy ? styles.busy : null,
              ]}
              onPress={() => void pick()}>
              <Svg width={Layout.iconField} height={Layout.iconField} viewBox="0 0 24 24" fill="none">
                <Path
                  d={MARK_HEART_PATH}
                  fill={picked ? theme.onTint : 'none'}
                  stroke={theme.onTint}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <ThemedText type="f14" themeColor="onTint" style={styles.bold}>
                {pickBusy ? 'Pick하는 중…' : picked ? 'Pick했어요' : 'Pick하기'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />

      {/* 금액 옆 ⓘ가 여는 설명 시트 — WP-SHT-014 · WP-SHT-015. */}
      <InfoSheet topic={infoTopic} onClose={() => setInfoTopic(null)} />
      <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
      <UnpickSheet
        candidate={unpickTarget}
        partnerName={candidates.partnerName}
        busy={candidates.busyVendorId !== null}
        onConfirm={() => void confirmUnpick()}
        onDismiss={() => setUnpickTarget(null)}
      />
      <LoginSheet
        visible={loginOpen}
        reason={`로그인하면 ${withParticle(vendor.name, '을를')} 바로 Pick해드려요.`}
        onSignedIn={(result) => {
          setLoginOpen(false);

          if (result.needsSignup) {
            router.push('/setup');
            return;
          }

          candidates.reload().catch(() => undefined);
          if (result.completed) setPickDoneOpen(true);
          else if (result.weddingError) setToast(result.weddingError);
        }}
        onDismiss={() => setLoginOpen(false)}
      />
    </ThemedView>
  );
}

// ─── 레이아웃 상수 ──────────────────────────────────────────────────────────

/* 대표 이미지 높이는 피그마의 288 — size.heroVendor(Layout.heroVendor). 핸드오프의 260을 이겼다. */

/**
 * Pick·비교 버튼 높이. tokens.json `size.ctaPick` 56.
 *
 * 전에는 `ctaPrimary` 52를 쓰고 「시안 10a의 56보다 토큰이 우선한다」고 적어
 * 두었는데, 그 뒤 핸드오프가 **이 자리 전용 토큰**을 따로 만들었다 —
 * 「ctaPick 56은 업체 상세·비교의 Pick CTA 전용이다」(tokens.json size 주석 ·
 * 09-core-loop «height:56px» · screens.json WP-VEND-001). 토큰이 우선한다는
 * 원칙은 그대로고, 이 자리의 토큰이 바뀐 것이다.
 */
const PICK_CTA_HEIGHT = Layout.ctaPick;

/* 스타일 칩은 피그마 태그 칩 기하(좌우 14 · 상하 8 · pill)를 쓴다 — styles.styleChip. 켬/끔 색은 SPEC §13.6 그대로. */

/** 시안 10a 경험 막대 6. */
const METER_HEIGHT = 6;

/** 추천 이유 불릿 6. */
const BULLET = 6;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  /* 하단 고정 CTA — 시안: 위 테두리 1 · 배경 화면색(스크롤에 비쳐도 CTA가 또렷하다). */
  /* 하단 고정 CTA `border-t p-4` — 안쪽 16. */
  footer: {
    borderTopWidth: Border.hairline,
    padding: Spacing.three,
  },
  /* 상단 내비 — 피그마 `h-14 px-4 border-b`: 56 · 좌우 16 · 아래 선. ← 40 + 제목 가운데(오른쪽 40 비움). */
  navBar: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: Border.hairline,
  },
  navTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    paddingRight: Layout.iconButton,
  },
  bold: {
    fontWeight: 700,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  busy: {
    opacity: 0.6,
  },

  // ── 대표 이미지 — 피그마 `h-72` 288 · 아래 어두운 막 · 글 `p-5` ──
  hero: {
    width: '100%',
    height: Layout.heroVendor,
    overflow: 'hidden',
    position: 'relative',
  },
  heroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Layout.cardPadding,
  },
  /* 배지 줄 `mb-1.5 flex items-center gap-2` — 아래 6(같은 값의 menuGroupGap). */
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Layout.menuGroupGap,
  },
  /* «인증» pill `rounded-full px-2 py-0.5 gap-1`. */
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  /* 업종 `text-white/70`. */
  heroCategory: { opacity: 0.7 },
  /* 요약 줄 `px-5 py-3 gap-3 border-b` — 좌우 24 · 상하 12 · 사이 12. */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.inlineGap,
    borderBottomWidth: Border.hairline,
  },
  statsPlace: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1, minWidth: 0 },
  statsPrice: { marginLeft: 'auto', flexShrink: 0 },
  /* 시안: right 16 bottom 14 · rgba(0,0,0,.5) · 13/18 700 · padding 5 10 · radius 999 */
  photoCounter: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Layout.sectionHeadGap,
    borderRadius: Radius.pill,
    paddingHorizontal: Layout.cardGap,
    paddingVertical: Spacing.one + 1,
  },

  // ── Identity 블록 · 시안: padding 20 24 24 · gap 14 · 머리 gap 6 ──
  identitySection: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.cardPadding,
    paddingBottom: Layout.gutter,
    gap: Layout.sectionHeadGap,
  },
  identityHead: {
    gap: Spacing.one + Spacing.half,
  },
  /* 배지 §12.3 — 공용 Badge. 블록 왼쪽에 붙인다. */
  statusBadge: {
    alignSelf: 'flex-start',
  },
  // ── 탭 넷(소개 · 가격 · 후기 · 정보) · Figma VendorDetailPage 탭 배치를 가져온 자리 ──
  /* 규격서 「div 430×46 flex · pad 0 20 0 20」, 칸 «pad 12 0 · 14/700». */
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Layout.pageX,
    borderBottomWidth: 1,
  },
  /* 탭 칸 `flex-1 py-3 border-b-2` — 상하 12 · 아래 선 2 전폭. */
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Layout.inlineGap,
    minHeight: Layout.touchTarget,
    justifyContent: 'flex-end',
  },
  tabIndicator: {
    height: Border.focus,
    width: '100%',
    marginTop: Layout.inlineGap - Border.focus,
  },
  /* 탭 콘텐츠 첫 섹션 — identitySection과 같은 위쪽 여백(Layout.gutter)으로 시작한다. */
  tabSection: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.gutter,
    gap: Layout.sectionHeadGap,
  },

  // ── 밴드 구분선 · 시안: 16 · margin 28 0 ──
  band: {
    height: Layout.sectionBand,
    marginTop: Layout.sectionGap,
    marginBottom: Layout.sectionGap,
  },

  // ── 공통 섹션 · 시안: padding 0 24 · 제목→콘텐츠 14 ──
  section: {
    paddingHorizontal: Layout.gutter,
    gap: Layout.sectionHeadGap,
  },
  sectionHead: {
    gap: Spacing.one,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── 추천 이유 · 스타일 칩 (28 · radius 999 · padding 0 10 · 13/18 700) ──
  /* `micro`는 기본이 700이다 — 피그마에서 regular인 작은 글자는 400으로 되돌린다. */
  regular: {
    fontWeight: 400,
  },
  /* 규격서의 굵기 600 · 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  semibold: {
    fontWeight: 600,
  },
  medium: {
    fontWeight: 500,
  },
  /* 규격서 «ls 0.3px» — 히어로 업종. */
  tracked03: {
    letterSpacing: LetterSpacing.p03,
  },
  /* 규격서 히어로 이름 «ls -0.64px». */
  heroName: {
    letterSpacing: LetterSpacing.n064,
  },
  /* 규격서 어두운 카드 아래 줄 «lh 20». */
  noteLine: {
    lineHeight: LineHeight.lh20,
  },
  // ── 「소개」 탭 — 규격서 「div 430×1017 pad 24 20 0 20」: 좌우 20 · 위 24 · 덩어리 사이 28 ──
  introSection: {
    paddingHorizontal: Layout.pageX,
    paddingTop: Spacing.four,
    gap: Layout.sectionGap,
  },
  /* 「포트폴리오」 `mb-3`. */
  introHead: { marginBottom: Layout.inlineGap },
  /* 띠 `flex gap-2 pb-1`. */
  portfolioStrip: { flexDirection: 'row', gap: Spacing.two, paddingBottom: Spacing.one },
  /* 태그 `flex flex-wrap gap-2`, 칩 `rounded-full px-3.5 py-2` — 좌우 14 · 상하 8. */
  styleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  styleChip: {
    borderRadius: Radius.pill,
    paddingHorizontal: Layout.chipPaddingX,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  /* 실 제보 어두운 카드 `rounded-2xl p-5`. 금액 줄 `mt-2 flex items-end justify-between`, 아래 줄 `mt-3`. */
  priceDark: {
    borderRadius: Radius.cardLarge,
    padding: Layout.cardPadding,
  },
  priceDarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  /* `text-white/65` · `text-white/55`. */
  priceDarkTail: { opacity: 0.65 },
  priceDarkNote: { marginTop: Layout.inlineGap, opacity: 0.55 },
  /* 우리 조건에 맞는 이유 `border-t pt-6`, 머리 `mb-3`, 칸 `grid-cols-3 gap-2` · `rounded-xl px-2 py-3 gap-1.5`. */
  reasonSection: {
    borderTopWidth: Border.hairline,
    paddingTop: Spacing.four,
  },
  reasonHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.inlineGap,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  reasonCell: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.menuGroupGap,
    borderRadius: Radius.hero,
    paddingHorizontal: Spacing.two,
    paddingVertical: Layout.inlineGap,
  },
  reasonText: { flex: 1, minWidth: 0 },

  // ── 추천 이유 불릿 · 시안: gap 10 · 점 6 coral · 글 16/24 ──
  bulletList: {
    gap: Layout.cardGap,
    marginTop: -Spacing.one - Spacing.half,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.cardGap,
  },
  bullet: {
    width: BULLET,
    height: BULLET,
    borderRadius: BULLET / 2,
    marginTop: (LineHeight.t6 + 2 - BULLET) / 2,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
  },

  // ── 제목·안내 줄 옆 ⓘ — 글자와 같은 줄, 사이 4 ──
  titleWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  noteWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  noteText: {
    flexShrink: 1,
  },

  // ── ⑦ 현재 혜택 brand 카드 · 시안: coral 7% 바탕 · 32% 테두리 · radius 10 · padding 20 · gap 6 ──
  benefitCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Layout.cardPadding,
    gap: Spacing.one + Spacing.half,
  },

  // ── 실 제보 금액 카드 · 시안: bg gray50 · radius 10 · padding 20 · gap 6 ──
  priceCard: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.one + Spacing.half,
  },

  // ── 행 목록 · 시안: 행 56 · padding 12 0 · gap 16 · 아래 선 1 · 행 사이 2 ──
  rows: {
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  rowGrow: {
    flex: 1,
    minWidth: 0,
  },
  rowTail: {
    flexShrink: 0,
    textAlign: 'right',
  },
  rowTailWide: {
    flexShrink: 1,
    flex: 1,
  },
  divider: {
    height: 1,
  },

  // ── Pick 56 + 비교 · 시안: gap 10 · 비교 padding 0 20 ──
  /* 피그마 `flex gap-2`: 정사각 56 · radius 16 · 테두리 + Primary 56 · radius 16 · 아이콘↔글 8. */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pickBtn: {
    flex: 1,
    height: PICK_CTA_HEIGHT,
    borderRadius: Radius.cardLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  compareBtn: {
    width: PICK_CTA_HEIGHT,
    height: PICK_CTA_HEIGHT,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 경험 막대 · 시안: 항목 gap 14 · 안 gap 7 · 막대 6 ──
  meters: {
    gap: Layout.sectionHeadGap,
  },
  meter: {
    gap: Spacing.two - 1,
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── 후기 · 시안: 항목 gap 16 · 머리 gap 8 · 반론 상자 bg gray50 radius 6 padding 16 ──
  reviewList: {
    gap: Spacing.three,
  },
  review: {
    gap: Spacing.two,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rebuttal: {
    borderRadius: Radius.small,
    padding: Spacing.three,
    gap: Spacing.one + Spacing.half,
  },
  /* 후기 0건 한 줄. 행 최소 높이 44 — 눌러서 첫 후기로 간다. */
  noReviewsRow: {
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },

  bottomPad: {
    height: Spacing.four,
  },
});
