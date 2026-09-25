import type {
  CurrentUser,
  Review,
  VendorCandidate,
  VendorDetail,
  VendorPhoto,
} from '@weddingpick/api-contract';
import {
  DEEP_DATA_NOTE,
  MAX_RATING,
  TERMS,
  countsTowardScore,
  formatCount,
  priceLine,
  rangeLabel,
  styleMatchReason,
  VENDOR_CATEGORY_LABEL,
  regionLabel,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  getCurrentUser,
  getVendor,
  listVendorPhotos,
  listVendorReviews,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { DepthHeader } from '@/components/depth-header';
import { useDepthBack } from '@/features/navigation/depth-back';
import { savePendingAction } from '@/features/auth/pending-action';
import { readCurrentUserSnapshot } from '@/features/loading/current-user-snapshot';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { VendorLocationSection } from '@/features/search/vendor-location';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import {
  Badge,
  Border,
  ErrorView,
  Layout,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  SeedIcon,
  Skeleton,
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

/** 후기 0건일 때의 한 줄(SPEC §2). 빈 섹션 대신 이 줄이 들어간다. */
const NO_REVIEWS_YET = '아직 후기가 없어요 · 첫 후기를 남겨주세요';

/** 공식정보 · 업체 안내 문구. spec/strings.ko.json vendor.* */
const OFFICIAL_LAST_CHECK = '마지막 확인';
const REPORT_ERROR = '정보가 틀렸나요? 제보하기';
const EXPERIENCE_COUNT = (n: number) => `${n}명이 답했어요`;

/** 정본 WP-VEND-002 `note`. */
const PACKAGE_NOTE = '모두 부가세 포함이에요. 최종 금액은 상담에서 정해져요.';

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
  // v3.28 WP-VEND-002의 탭 이름은 «패키지»다(시안 `tabs`). 내부 키는 그대로 둔다.
  { key: 'price', label: '패키지' },
  { key: 'review', label: '후기' },
  { key: 'info', label: '정보' },
];

/** «2026년 8월 28일». 공식정보의 확인일 표기(시안 10a). */
function formatKoreanDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** «2026.07». 후기 머리의 작성 시기(시안 10a). */
function formatYearMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7).replace('-', '.');
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * WP-VEND-001~004 업체 상세(`docs/design/React_Native/search.jsx` frame-004~007 · `search.js`).
 * 히어로(`Layout.heroVendor` 290 = 정본 `heroWrap`) → 제보 금액 블록(30/38 · 탭을 바꿔도 고정 · «자세히»와 WP-VEND-007은 2026-09-25 대표 지시로 삭제) → 탭 넷(소개 · 패키지 · 후기 ·
 * 정보, 48 · 16/700) → 하단 Pick 하나. 탭 안 구성이 정본과 다른 자리는 PR 본문
 * DESIGN_UNRESOLVED 표에 적었다. 아래는 이 파일이 옛 시안(09-core-loop #10a) 때 세운 순서다:
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
  const depthBack = useDepthBack();
  const params = useLocalSearchParams<{ vendorId: string; reasons?: string }>();
  const vendorId = params.vendorId;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  /**
   * 승인된 업체 실사진(히어로 · 포트폴리오 · WP-VEND-006 전체보기). 못 읽어도 상세 화면은 그대로 뜬다 —
   * 대표 이미지가 카테고리 기본으로 조용히 대체될 뿐이다.
   */
  const [photos, setPhotos] = useState<VendorPhoto[]>([]);
  /** 후기 — Pick 인증 후기가 앞에 온다. */
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Pick 완료 시트(WP-SHT-002) · 해제 시트(WP-SHT-003). */
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  /**
   * «나». 고른 스타일과 업체 태그의 일치를 그리려고 읽는다(SPEC §13.6).
   * 비회원 상세는 폐기됐으므로 세션이 사라지면 로그인 경계가 화면 접근을 막는다.
   */
  const [me, setMe] = useState<CurrentUser | null>(() => readCurrentUserSnapshot());
  /** 후기 목록을 읽어 왔는가. 읽기 전에는 «아직 후기가 없어요»를 단정하지 않는다. */
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
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

    getCurrentUser()
      .then((loaded) => {
        if (alive) setMe(loaded);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <ErrorView message={error} onBack={depthBack} />;
  }

  if (!vendor) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <DepthHeader title="업체 상세" onBack={depthBack} />
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.loadingScroll}>
            <Skeleton height={Layout.heroVendor} radius={0} />
            <View style={styles.loadingPrice}>
              <Skeleton width="42%" height={22} />
              <Skeleton width="68%" height={14} />
            </View>
            <View style={styles.loadingTabs}>
              {VENDOR_TABS.map((item) => (
                <Skeleton key={item.key} width="20%" height={18} />
              ))}
            </View>
            <View style={styles.loadingBody}>
              <Skeleton width="48%" height={20} />
              <Skeleton width="100%" height={72} radius={Radius.medium} />
              <Skeleton width="100%" height={72} radius={Radius.medium} />
            </View>
          </ScrollView>
          <View
            style={[
              styles.footer,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.background,
                paddingBottom: Math.max(DOCK_PAD_BOTTOM, insets.bottom),
              },
            ]}>
            <Skeleton height={PICK_CTA_HEIGHT} radius={Radius.control} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const currentVendor = vendor;
  const myCandidate = candidates.candidateFor(currentVendor.id);
  const picked = myCandidate !== null;
  const pickBusy = candidates.busyVendorId === currentVendor.id;

  /**
   * Pick(SPEC §13.1). 비회원 상세는 폐기됐으므로 이 화면 안에 로그인 시트를 겹쳐 띄우지 않는다.
   * 세션이 사라졌다면 로그인 화면으로 복귀한다.
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
      router.replace('/login');
    }
    else setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  async function confirmUnpick() {
    if (!unpickTarget) return;
    const ok = await candidates.unpick(unpickTarget);
    setUnpickTarget(null);
    if (!ok) setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  const paidPrice = vendor.prices.paidPrice;
  /* 금액 한 줄 — 0층 «업체 안내 150만원~» · 1층 «수집 중» · 3건+ 구간. 검색·비교와 같은 규칙. */
  const line = priceLine(paidPrice, vendor.guidePrice);

  /* 고른 스타일과 업체 태그의 일치 — 추천 이유 첫 줄이 된다. 로그인 전·미선택이면 줄이 없다. */
  const chosenStyles: readonly WeddingStyle[] = me?.styleTags ?? [];
  const styleReason = styleMatchReason(chosenStyles, vendor.styleTags);
  /* 첫 불릿은 스타일 일치, 그 뒤가 넘어온 이유들. 같은 문장이 두 번 오지 않게 거른다. */
  const reasonLines = [
    ...(styleReason ? [styleReason] : []),
    ...reasons.filter((reason) => reason !== styleReason),
  ];
  const hasRecommendation = vendor.styleTags.length > 0 || reasonLines.length > 0;

  /*
   * «이용한 사람들의 경험»은 3명 미만이면 섹션째 숨긴다(SPEC §2). 별점은 그린다 —
   * v3.28 2026-09-23 「후기 별점 UI를 되살린다」로 §6.1의 「그리지 않는다」가 뒤집혔다.
   * 아래 <RatingStars>가 이미 그 값을 그린다.
   */
  const experience = vendor.usageScore;
  const showExperience = experience.available && experience.count >= EXPERIENCE_MIN_PEOPLE;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <DepthHeader title={vendor.name} />

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>

          {/*
            히어로와 제보 금액 블록은 탭을 바꿔도 그대로 둔다(2026-09-25 대표 지시 「업체 상세 위 영역은
            탭 메뉴 변경 시에도 고정으로 나온다」). 정본 frame-005~007은 헤더 바로 아래에 탭 줄을
            그리지만 대표님 지시가 이긴다.
          */}
          <>
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
                {/*
                  정본 `heroText`: 왼쪽 20 · 아래 18 · 사이 4 — 업종 · 지역 13/700(흰 .82) → 업체명 28/36.
                  피그마에서 온 «인증» pill은 정본 히어로에 없어 뺐다(2026-09-24 RN 정본 대조).
                */}
                <View style={styles.heroText} pointerEvents="none">
                  <View style={styles.heroCategory}>
                    <ThemedText type="f13" style={[styles.bold, { color: theme.onInk }]}>
                      {VENDOR_CATEGORY_LABEL[vendor.category]} · {regionLabel(vendor.region)}
                    </ThemedText>
                  </View>
                  <ThemedText type="f28" numberOfLines={2} style={[styles.bold, styles.heroName, { color: theme.onInk }]}>
                    {vendor.name}
                  </ThemedText>
                </View>
                {photos.length > 0 ? (
                  <View style={[styles.photoCounter, { backgroundColor: theme.scrim }]}>
                    <ThemedText type="f12" numeric style={[styles.bold, { color: theme.onTint }]}>
                      1 / {photos.length}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>

              {/*
                ② 제보 금액 — handoff WP-VEND-001: 30px + 건수·기간·기준금액.
                검색 카드식 작은 통계 행을 쓰지 않고 상세 정본의 금액 블록을 독립시킨다.
              */}
              <View style={[styles.priceSummary, { borderBottomColor: theme.border }]}>
                <ThemedText
                  type="f30"
                  numeric
                  themeColor={line.dim ? 'textAssistive' : undefined}
                  style={styles.bold}>
                  {line.text}
                </ThemedText>
                <View style={styles.priceMetaRow}>
                  <ThemedText type="f13" themeColor="textAssistive" numeric style={styles.priceMetaText}>
                    {line.caption}
                  </ThemedText>
                </View>
              </View>
          </>

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
                  {/* 정본 `tab`: 48 · 16/700 · 켬은 잉크 글자 + 아래 잉크 선 2, 끔은 보조색. */}
                  <ThemedText type="f16" themeColor={active ? undefined : 'textAssistive'} style={styles.bold}>
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
              「소개」 탭 — RN 정본 WP-VEND-001(frame-004): `sec`(안쪽 20 · 사이 12 · 제목 17/700)
              둘을 차례로 — 추천 이유(체크 20 + 15/23) → 포트폴리오(140 정사각 · radius 10 · 사이 8).
              정본의 «포함된 것» · «따로 드는 비용»은 서버에 그 칸이 없어 그리지 않는다
              (DESIGN_UNRESOLVED · 서버 필요). 2026-09-24 RN 정본 대조로 정본에 없던 스타일 태그 줄과
              어두운 실 제보 카드(위 제보 금액 블록과 같은 숫자)를 뺐다.
            */
            <View>
              <View style={styles.introSec}>
                {/* 정본 `secTitle` «추천 이유» — 2026-09-25 대표 결정으로 정본 라벨 그대로 쓴다. */}
                <ThemedText type="f17" style={styles.bold}>추천 이유</ThemedText>
                {hasRecommendation && reasonLines.length > 0 ? (
                  <View style={styles.reasonWrap}>
                    {reasonLines.map((reason) => (
                      <View key={reason} style={styles.reasonRow}>
                        <View style={[styles.reasonMark, { backgroundColor: theme.tint }]}>
                          <ProductSymbol name="check" size={REASON_CHECK} color={theme.onTint} />
                        </View>
                        <ThemedText type="f15" style={styles.reasonText}>
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

              {/* 포트폴리오 — 승인된 실사진 띠. 사진이 없으면 섹션째 없다. */}
              {photos.length > 0 ? (
                <View style={styles.introSec}>
                  <ThemedText type="f17" style={styles.bold}>포트폴리오</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioStrip}>
                    {photos.map((photo, index) => (
                      <Pressable
                        key={photo.url}
                        accessibilityRole="button"
                        accessibilityLabel={`포트폴리오 ${index + 1}`}
                        onPress={() => router.push(`/search/${vendor.id}/images?index=${index}` as never)}>
                        <VendorImage
                          source={{ uri: photo.url }}
                          category={vendorImageCategory(vendor.category)}
                          width={PORTFOLIO_TILE}
                          height={PORTFOLIO_TILE}
                          radius={Radius.medium}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ④ 실 제보 — 「가격」 탭. 정보 5단계(SPEC §2). 금액 카드 + 조건별 행 */}
          {tab === 'price' ? (
            /*
              「패키지」 탭 — RN 정본 WP-VEND-002(frame-005 · `secTop` 안쪽 20 · 사이 14): 안내 한 줄
              (`note` 13/20 보조색) → 패키지 카드(`pkg`: 테두리 1 · radius 10 · 안쪽 20 · 사이 14 ·
              이름 18/700 · 실 제보 건수 13 · 금액 20/700). 카드는 사람이 확인한 상품별 통계
              (`prices.products`)로 그린다. 정본 카드의 시간 · 컷 · 보정 칸은 서버에 그 값이 없고,
              «이 구성으로 상담»은 「최종 Pick 저장 뒤에만 상담 예약」(CLAUDE.md) · 정본 vdiffs
              「상담 진입: Pick → 최종 결정 → 상담 잡기」와 맞지 않아 그리지 않는다(DESIGN_UNRESOLVED).
              2026-09-25 픽셀 대조로 정본에 없는 실 제보 카드 · 조건별 행 · 업체 안내 · 현재 혜택
              묶음을 이 탭에서 뺐다 — 금액 한 줄은 탭 위 금액 블록이 보여준다(WP-VEND-007 상세는 2026-09-25 삭제).
            */
            <View style={styles.pkgSec}>
              <ThemedText type="f13" themeColor="textAssistive" style={styles.pkgNote}>
                {PACKAGE_NOTE}
              </ThemedText>
              {vendor.prices.products.length > 0 ? (
                vendor.prices.products.map((product) => (
                  <View
                    key={`${product.productLabel}-${product.docType}`}
                    style={[styles.pkgCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
                    <View style={styles.pkgHead}>
                      <View style={styles.pkgNameCol}>
                        <ThemedText type="f18" numberOfLines={1} style={styles.bold}>
                          {product.productLabel}
                        </ThemedText>
                        <ThemedText type="f13" themeColor="textAssistive" numeric>
                          {`${TERMS.verifiedData} ${formatCount(product.stat.sampleCount)}건`}
                        </ThemedText>
                      </View>
                      <ThemedText type="f20" numeric style={styles.bold}>
                        {rangeLabel(product.stat.p25, product.stat.p75)}
                      </ThemedText>
                    </View>
                  </View>
                ))
              ) : (
                <ThemedText type="f13" themeColor="textAssistive" style={styles.pkgNote}>
                  {vendor.prices.deepDataNote ?? DEEP_DATA_NOTE}
                </ThemedText>
              )}
            </View>
          ) : null}

          {/* ⑧+⑨ — 「후기」 탭. */}
          {tab === 'review' ? (
            /*
              「후기」 탭 — RN 정본 WP-VEND-003(frame-006). 위 묶음(`secTop` 안쪽 20 · 사이 14):
              «N명이 답했어요» 17/700 → 별 18 다섯 + 점수 16/700(`starSumRow` 사이 8) → 항목 막대
              (`axisRow`: 이름 90 · 13 · 막대 6 · 수 36 · 12, 가장 많은 줄만 잉크 700 + 코랄 막대).
              → 띠 8 → 후기 행(`revItem` 안쪽 18/20 · 사이 10 · 아래 선 1): 머리글자 원 36 · 이름 15/700 ·
              별 14 · 날짜 12 · «Pick 인증» 배지 → 본문 15/24.
              정본 막대는 질문 셋 × 보기 셋이지만 서버(`usageScore`)는 항목 하나에 한 막대만 준다 —
              있는 값(체크리스트 · 항목 평균)을 같은 줄 모양으로 그린다(DESIGN_UNRESOLVED · 서버 필요).
              본문 안 «후기 쓰기» 단추는 «등록 버튼은 헤더에만»(CLAUDE.md)과 겹쳐 그리지 않는다.
              후기는 탭 안에 모두 나열한다 — 정본에 «N개 전체 보기» 링크가 없다.
            */
            <View>
              {showExperience && experience.available ? (
                <View style={styles.revTop}>
                  <ThemedText type="f17" numeric style={styles.bold}>
                    {EXPERIENCE_COUNT(experience.count)}
                  </ThemedText>
                  <View style={styles.starSumRow}>
                    <StarRow filled={Math.round(experience.average)} size={REV_STAR_LARGE} />
                    <ThemedText type="f16" numeric style={styles.bold}>
                      {experience.average.toFixed(1)}
                    </ThemedText>
                  </View>
                  <View style={styles.axisBlock}>
                    {axisRows(experience).map((row) => (
                      <View key={row.key} style={styles.axisRow}>
                        <ThemedText
                          type="f13"
                          numberOfLines={1}
                          themeColor={row.top ? undefined : 'textAssistive'}
                          style={[styles.axisLabel, row.top ? styles.bold : null]}>
                          {row.label}
                        </ThemedText>
                        <View style={[styles.axisTrack, { backgroundColor: theme.backgroundSelected }]}>
                          <View
                            style={[
                              styles.axisFill,
                              { width: `${row.percent}%`, backgroundColor: row.top ? theme.tint : theme.tintBorder },
                            ]}
                          />
                        </View>
                        <ThemedText
                          type="f12"
                          numeric
                          themeColor={row.top ? undefined : 'textAssistive'}
                          style={[styles.axisNum, row.top ? styles.bold : null]}>
                          {row.tail}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={[styles.revBand, { backgroundColor: theme.backgroundSelected }]} />

              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <View key={review.id} style={[styles.revItem, { borderBottomColor: theme.border }]}>
                    <View style={styles.revHead}>
                      <View style={[styles.revAvatar, { backgroundColor: theme.backgroundSelected }]}>
                        <ThemedText type="f14" themeColor="textSecondary" style={styles.bold}>
                          {review.roleLabel.slice(0, 1)}
                        </ThemedText>
                      </View>
                      <View style={styles.revNameCol}>
                        <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
                          {review.roleLabel}
                        </ThemedText>
                        <StarRow filled={review.overall} size={REV_STAR_SMALL} />
                        <ThemedText type="f12" themeColor="textAssistive" numeric>
                          {formatYearMonth(review.createdAt)}
                        </ThemedText>
                      </View>
                      {countsTowardScore(review.verification) ? <Badge kind="ok">Pick 인증</Badge> : null}
                    </View>
                    <ThemedText type="f15" themeColor="textSecondary" style={styles.revText}>
                      {review.body}
                    </ThemedText>
                    {review.rebuttal ? (
                      <View style={[styles.rebuttal, { backgroundColor: theme.backgroundElement }]}>
                        <ThemedText type="t7" themeColor="textSecondary" style={styles.bold}>업체 반론</ThemedText>
                        <ThemedText type="body" themeColor="textStrong">{review.rebuttal.body}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                ))
              ) : reviewsLoaded ? (
                /* 후기 0건 — 빈 섹션 대신 한 줄. 누르면 첫 후기를 쓰는 자리로 간다. */
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={NO_REVIEWS_YET}
                  onPress={() => router.push(`/search/${vendor.id}/write-review`)}
                  style={[styles.revItem, { borderBottomColor: theme.border }]}>
                  <ThemedText type="t6" themeColor="textSecondary">{NO_REVIEWS_YET}</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/*
            ⑩ 「정보」 탭. v3.29 WP-VEND-004 `secTitle`은 「기본 정보」다(2026-09-23
            재검증에서 잡은 값 — `spec/strings.ko.json` `vendor.section.official`
            「공식정보」는 다른 화면(WP-VEND-005 · 아직 안 만든 화면, IA 참고)의 이름이라
            여기 쓰지 않는다). 항목마다 출처. 마지막 확인일 · 지도 · 정보 오류 제보
          */}
          {tab === 'info' ? (
          /*
            정본 frame-007 `sec`(안쪽 20 · 사이 12 · 제목 17/700) · `infoRow`(위 맞춤 · 이름 칸 84 · 14 보조색 ·
            값 15/23 잉크 왼쪽 정렬 · 위아래 14 · 최소 52+28 · 아래 선 1). 줄은 서버가 준 값만 — 정본의
            가는 길 · 영업시간 · 쉬는 날 · 전화 · 주차 · 예약 · 자주 묻는 질문은 서버에 칸이 없다
            (DESIGN_UNRESOLVED · 서버 필요). 빈 줄을 만들지 않는다(정본 vdiffs «미등록 항목»).
          */
          <View style={styles.introSec}>
            <ThemedText type="f17" style={styles.bold}>기본 정보</ThemedText>
            <View>
              <InfoRow label="지역" value={regionLabel(vendor.region)} />
              <InfoRow label={OFFICIAL_LAST_CHECK} value={formatKoreanDate(vendor.lastVerifiedAt)} />
              {vendor.sourceNote ? <InfoRow label="출처" value={vendor.sourceNote} /> : null}
              <VendorLocationSection
                vendorId={vendor.id}
                name={vendor.name}
                region={vendor.region}
                address={vendor.address}
                coordinates={vendor.coordinates}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={REPORT_ERROR}
              /* WP-VEND-008 정보 오류 제보 — 무엇이 틀렸는지 고르는 화면. 범용 문의로 보내지 않는다. */
              onPress={() => router.push(`/search/${vendor.id}/fix-report`)}>
              {/* 정본 `fixRow`: 최소 52 · 위 6 · 14 보조색 + 꺾쇠 18 흐린색. */}
              <View style={styles.fixRow}>
                <ThemedText type="f14" themeColor="textAssistive" style={styles.rowGrow}>{REPORT_ERROR}</ThemedText>
                <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
              </View>
            </Pressable>
          </View>
          ) : null}

          <View style={styles.bottomPad} />
        </ScrollView>

        {/*
          ⑤ Pick 하나 — 탭 전환과 무관하게 항상 보이는 하단 고정 영역. 화면당 Primary
          CTA 1개(CLAUDE.md). v3.29 대메뉴_검색.dc.html WP-VEND-001~004 `dockSingle` ·
          2026-09-23 재검증에서 잡은 값 — 전에는 하트 정사각 단추 + 「최종 Pick하기 /
          상담 예약하기」 단추 2개였다. vdiffs 표(같은 dc.html #13)가 그 2버튼 구성을
          Figma 원본으로, 정본은 하트 아이콘 + 「Pick하기」 글자를 한 단추에 담은 1개짜리
          라고 못박아 뒀다 — 「하트와 상담이 헷갈린다」. 상담 예약 진입도 같은 표가
          「업체 상세에서 바로」가 아니라 「Pick → 최종 결정 → 상담 잡기」로 옮겼다 —
          그 흐름은 Pick 탭(WP-PICK-001·005·009)에 있고 이 화면은 Pick 담기·빼기만 한다.
        */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: theme.border,
              backgroundColor: theme.background,
              paddingBottom: Math.max(DOCK_PAD_BOTTOM, insets.bottom),
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={picked ? `${vendor.name} Pick 취소하기` : `${vendor.name} Pick하기`}
            accessibilityState={{ disabled: pickBusy, selected: picked }}
            disabled={pickBusy}
            style={({ pressed }) => [
              styles.pickCta,
              { backgroundColor: theme.tint },
              pickBusy ? styles.busy : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={() => void pick()}>
            {/* 정본 `icoHeartW` = SEED heart 20 흰색 · 오른쪽 8(`pickCta` gap). Pick한 뒤에는 채운 하트. */}
            <SeedIcon name={picked ? 'heartFill' : 'heartRegular'} size={Layout.iconRow} color={theme.onTint} />
            <ThemedText type="f18" style={[styles.bold, { color: theme.onTint }]}>
              Pick하기
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />

      <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
      <UnpickSheet
        candidate={unpickTarget}
        partnerName={candidates.partnerName}
        busy={candidates.busyVendorId !== null}
        onConfirm={() => void confirmUnpick()}
        onDismiss={() => setUnpickTarget(null)}
      />
    </ThemedView>
  );
}

/** 정보 탭 한 줄 — 정본 `infoRow` · `infoK` · `infoV`. */
function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
      <ThemedText type="f14" themeColor="textAssistive" style={styles.infoK}>
        {label}
      </ThemedText>
      <ThemedText type="f15" numeric style={styles.infoV}>
        {value}
      </ThemedText>
    </View>
  );
}

/** 정본 `STARROW` — 별 다섯, 앞 n개는 코랄 · 나머지는 회색 선(#dcdee3 = `track`). 사이 2. */
function StarRow({ filled, size }: { filled: number; size: number }) {
  const theme = useTheme();
  return (
    <View style={styles.starRow} accessibilityLabel={`5점 만점에 ${filled}점`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <SeedIcon key={index} name="reviewStarFill" size={size} color={index < filled ? theme.tint : theme.track} />
      ))}
    </View>
  );
}

type AxisRow = { key: string; label: string; percent: number; tail: string; top: boolean };

/** 서버의 경험 값을 정본 `axisRow` 줄로 — 체크리스트면 «N명», 항목 평균이면 «4.6». 가장 큰 줄 하나만 강조. */
function axisRows(experience: Extract<VendorDetail['usageScore'], { available: true }>): AxisRow[] {
  const rows: Omit<AxisRow, 'top'>[] =
    experience.checklist.length > 0
      ? experience.checklist
          .filter((item) => !item.collecting)
          .map((item) => ({
            key: item.key,
            label: item.label,
            percent: item.percent,
            tail: `${formatCount(item.answered)}명`,
          }))
      : experience.aspects.map((aspect) => ({
          key: aspect.key,
          label: aspect.label,
          percent: (aspect.average / MAX_RATING) * 100,
          tail: aspect.average.toFixed(1),
        }));
  const max = Math.max(0, ...rows.map((row) => row.percent));
  return rows.map((row) => ({ ...row, top: row.percent === max }));
}

// ─── 레이아웃 상수 ──────────────────────────────────────────────────────────

/*
 * 대표 이미지 높이는 `Layout.heroVendor`다 — 2026-09-25 픽셀 대조로 정본 `heroWrap` 290에 맞췄다
 * (그 토큰을 쓰는 자리는 이 화면의 히어로와 로딩 뼈대 둘뿐이다).
 */
/** 정본 `heroText` · `heroCount`의 bottom 18. */
const HERO_TEXT_BOTTOM = 18;
/** 정본 `heroCount` 높이 26. */
const HERO_COUNT_HEIGHT = 26;
/** 정본 `tab` 높이 48. */
const TAB_HEIGHT = 48;
/** 정본 `infoK` 폭 84 · `infoRow` 최소 52(콘텐츠) + 위아래 14 = 80(RN minHeight는 안쪽 여백을 포함한다). */
const INFO_KEY_WIDTH = 84;
const INFO_ROW_MIN = 80;
/** 정본 `dockSingle` 아래 여백 48(= 92 − CTA 56 + 12). 캡처 DOM에서 잰 값 — 116 중 CTA 아래. */
const DOCK_PAD_BOTTOM = 48;
/** 정본 `fixRow` 최소 52. */
const FIX_ROW_MIN = 52;
/** 정본 후기 별 — 요약 18 · 후기 행 14. */
const REV_STAR_LARGE = 18;
const REV_STAR_SMALL = 14;
/** 정본 `axisRow` 이름 칸 90 · 수 칸 36 · 막대 6. */
const AXIS_LABEL_WIDTH = 90;
const AXIS_NUM_WIDTH = 36;
const AXIS_TRACK_HEIGHT = 6;
/** 정본 `revAvatar` 36. */
const REV_AVATAR = 36;
/** 정본 `galCell` 140 정사각. */
const PORTFOLIO_TILE = 140;
/** 정본 추천 이유 체크 원 20 · 안의 체크 13. */
const REASON_MARK = 20;
const REASON_CHECK = 13;

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
  /*
   * 하단 고정 CTA — v3.29 WP-VEND-001~004 `dockSingle`: 위 테두리 1 · 배경 화면색
   * (스크롤에 비쳐도 CTA가 또렷하다) · 안쪽 세로 12(`Layout.inlineGap`) · 가로 24
   * (`Layout.gutter`). 2026-09-23 재검증에서 잡은 값 — 전에는 규격서 vendor-1.txt의
   * 균등 16(`Spacing.three`)을 썼다.
   */
  /* 정본 `dockSingle`: flex-basis 92(콘텐츠) + 위아래 12 = 116 — 위 12 + CTA 56 + 아래 48.
     아래 48은 홈 표시줄 자리를 겸해 기기 하단 여백과 겹치면 큰 쪽 하나만 쓴다(렌더에서 insets와 비교). */
  footer: {
    borderTopWidth: Border.hairline,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.inlineGap,
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

  loadingScroll: { paddingBottom: Spacing.four },
  loadingPrice: {
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.cardPadding,
    gap: Spacing.two,
  },
  loadingTabs: {
    minHeight: Layout.touchTarget,
    paddingHorizontal: Layout.pageX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  loadingBody: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.gutter,
    gap: Layout.sectionHeadGap,
  },

  // ── 대표 이미지 — handoff 260 · 아래 어두운 막 ──
  hero: {
    width: '100%',
    height: Layout.heroVendor,
    overflow: 'hidden',
    position: 'relative',
  },
  /* 정본 `heroText`: left 20 · bottom 18 · gap 4. */
  heroText: {
    position: 'absolute',
    left: Layout.cardPadding,
    right: Layout.cardPadding,
    bottom: HERO_TEXT_BOTTOM,
    gap: Spacing.one,
  },
  /* 정본 `heroCat` 흰 글자 .82. */
  heroCategory: { opacity: 0.82 },
  /* 정본 `priceBlock`: padding 20 · 아래 18. */
  priceSummary: {
    paddingHorizontal: Layout.pageX,
    paddingTop: Layout.cardPadding,
    paddingBottom: HERO_TEXT_BOTTOM,
    gap: Spacing.one,
    borderBottomWidth: Border.hairline,
  },
  /* 정본 `heroCount`: right 16 · bottom 18 · 높이 26 · 좌우 10 · rgba(0,0,0,.5) · 12/700. */
  photoCounter: {
    position: 'absolute',
    right: Spacing.three,
    bottom: HERO_TEXT_BOTTOM,
    height: HERO_COUNT_HEIGHT,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Layout.cardGap,
  },
  /* 금액 설명 줄. */
  priceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  priceMetaText: { flex: 1, minWidth: 0 },

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
  // ── 탭 넷(소개 · 패키지 · 후기 · 정보) · RN 정본 `tabNav` · `tab` ──
  /* 정본 `tabNav`: 아래 선 1. 좌우는 전역 거터(24)에 맞춘다(정본 20). */
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Layout.pageX,
    borderBottomWidth: 1,
  },
  /* 정본 `tab`: flex 1 · 높이 48 · 가운데 · 켬은 안쪽 아래 선 2. */
  tabBtn: {
    flex: 1,
    height: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Border.focus,
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
  heroName: {
    lineHeight: LineHeight.lh36,
  },
  // ── 「정보」 탭 — RN 정본 frame-007 `infoRow` ──
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: INFO_ROW_MIN,
    paddingVertical: Layout.sectionHeadGap,
    borderBottomWidth: Border.hairline,
  },
  infoK: { width: INFO_KEY_WIDTH },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    minHeight: FIX_ROW_MIN,
    marginTop: Spacing.one + Spacing.half,
  },
  infoV: { flex: 1, lineHeight: LineHeight.lh23 },
  // ── 「후기」 탭 — RN 정본 frame-006 ──
  revTop: {
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  starSumRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  starRow: { flexDirection: 'row', gap: Spacing.half },
  /* 정본 `axesWrap` 사이 20 · `axisBlock` 사이 8 — 질문 묶음이 하나라 8만 쓴다. */
  axisBlock: { gap: Spacing.two },
  axisRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.cardGap },
  axisLabel: { width: AXIS_LABEL_WIDTH },
  axisTrack: { flex: 1, height: AXIS_TRACK_HEIGHT, borderRadius: Radius.pill, overflow: 'hidden' },
  axisFill: { height: '100%', borderRadius: Radius.pill },
  axisNum: { width: AXIS_NUM_WIDTH, textAlign: 'right' },
  /* 정본 `divider` 8. */
  revBand: { height: Spacing.two },
  revItem: {
    paddingVertical: HERO_TEXT_BOTTOM,
    paddingHorizontal: Layout.pageX,
    gap: Layout.cardGap,
    borderBottomWidth: Border.hairline,
  },
  revHead: { flexDirection: 'row', alignItems: 'center', gap: Layout.cardGap },
  revAvatar: {
    width: REV_AVATAR,
    height: REV_AVATAR,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revNameCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  revText: { lineHeight: LineHeight.lh24 },
  // ── 「패키지」 탭 — RN 정본 `secTop`(안쪽 20 · 사이 14) · `pkg` 카드 ──
  pkgSec: {
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  pkgNote: { lineHeight: LineHeight.lh20 },
  pkgCard: {
    borderWidth: Border.hairline,
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  pkgHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  pkgNameCol: { flexShrink: 1, minWidth: 0, gap: Layout.cardNameGap },
  // ── 「소개」 탭 — RN 정본 `sec`: 안쪽 20(좌우는 전역 거터 24) · 제목↔내용 12 ──
  introSec: {
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.cardPadding,
    gap: Layout.inlineGap,
  },
  /* 정본 `galWrap` 사이 8. */
  portfolioStrip: { flexDirection: 'row', gap: Spacing.two },
  /* 정본 `reasonWrap` 사이 10 · `reasonRow` 위 정렬 · 사이 10. */
  reasonWrap: { gap: Layout.cardGap },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.cardGap,
  },
  /* 정본 `reason().mark`: 20 원 · 위 2 · 코랄 면 + 흰 체크 13. */
  reasonMark: {
    width: REASON_MARK,
    height: REASON_MARK,
    marginTop: Spacing.half,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 정본 `reason().text` 15/23. */
  reasonText: { flex: 1, minWidth: 0, lineHeight: LineHeight.lh23 },

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

  // ── ⑦ 현재 혜택 brand 카드 · 시안: coral 7% 바탕 · 32% 테두리 · radius 10 · padding 20 · gap 6 ──

  // ── 실 제보 금액 카드 · 시안: bg gray50 · radius 10 · padding 20 · gap 6 ──

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

  /*
   * Pick 단추 하나 — v3.29 WP-VEND-001~004 `ctaPick`: 전폭 · 높이 56 · radius 6
   * (`Radius.control`) · 코랄 배경 · 흰 하트 20(마진 8) + 흰 글자 18/700. 2026-09-23
   * 재검증에서 잡은 값 — 전에는 규격서 vendor-1.txt를 따라 하트 정사각 + Primary
   * 글자 단추 2개 · radius 16(`Radius.cardLarge`)이었다.
   */
  pickCta: {
    height: PICK_CTA_HEIGHT,
    borderRadius: Radius.control,
    flexDirection: 'row',
    gap: Spacing.two,
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
