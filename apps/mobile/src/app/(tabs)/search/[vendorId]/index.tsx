import type {
  ConditionStats,
  CurrentUser,
  Review,
  VendorDetail,
  VendorPhoto,
} from '@weddingpick/api-contract';
import {
  DISCLOSURE_THRESHOLDS,
  manwon,
  MAX_RATING,
  NOT_ENOUGH_DATA,
  PAYMENT_PROOF_CAVEAT,
  TERMS,
  WEDDING_STYLE_LABEL,
  countsTowardScore,
  needsPickProof,
  priceLine,
  rangeLabel,
  styleMatchReason,
  styleOverlap,
  VENDOR_CATEGORY_LABEL,
  withParticle,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addCandidate,
  ensureWedding,
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
import { savePendingAction } from '@/features/auth/pending-action';
import { readCurrentUserSnapshot } from '@/features/loading/current-user-snapshot';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import {
  ActionButton,
  Colors,
  ErrorView,
  Layout,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  ProgressBar,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  VendorImage,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';

/**
 * «이용한 사람들의 경험»을 보여주는 최소 답한 사람 수(SPEC §2 빈 섹션 처리).
 * 그 아래면 섹션째 숨긴다 — 두 사람의 점수는 경험이 아니라 두 사람이다.
 */
const EXPERIENCE_MIN_PEOPLE = 3;

/** 후기 0건일 때의 한 줄(SPEC §2). 빈 섹션 대신 이 줄이 들어간다. */
const NO_REVIEWS_YET = '아직 후기가 없어요 · 첫 후기를 남겨주세요';

/** 0층일 때 실 제보 금액으로 자동 교체된다는 안내. 기준 건수는 공개 사다리에서 읽는다. */
const GUIDE_REPLACED_NOTE = [TERMS.verifiedData, `${DISCLOSURE_THRESHOLDS.limited}건이 되면`, TERMS.verifiedData, '금액으로 바뀌어요'].join(' ');

/**
 * WP-VEND-001 업체 상세. 섹션 순서 고정(orderLocked).
 *
 * 별점도 후기도 없다. 확인된 실제 계약이 충분히 모인 상품만 가격을 보여주고, 그렇지
 * 않으면 그렇다고 말한다 — 자료가 없는 업체와 싼 업체가 같은 얼굴이 되면 안 된다.
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
  /** Pick 인증 후기 (verification !== 'reported'). 최대 3건. */
  const [verifiedReviews, setVerifiedReviews] = useState<Review[]>([]);
  /** 일반 후기 미리보기 (상담제보). 최대 3건. */
  const [previewReviews, setPreviewReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 출처를 펼쳤는가. */
  const [sourceOpen, setSourceOpen] = useState(false);
  /** 로그인 시트가 떠 있는가. 첫 Pick이 대표 트리거다(v3.10 §3). */
  const [loginOpen, setLoginOpen] = useState(false);
  /**
   * «나». 고른 스타일과 업체 태그의 일치를 그리려고 읽는다(SPEC §13.6). 로그인 전이면
   * null이고 그때는 칩이 전부 회색이다 — 없는 취향을 지어내지 않는다.
   */
  const [me, setMe] = useState<CurrentUser | null>(() => readCurrentUserSnapshot());
  /** 후기 목록을 읽어 왔는가. 읽기 전에는 «아직 후기가 없어요»를 단정하지 않는다. */
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

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
         * Pick 인증 후기(payment / contract / usage 확인)와 일반 후기(상담제보)를
         * 분리한다. 두 종류가 한 목록에 섞이면 어떤 근거로 쓴 글인지가 흐려진다.
         */
        const verified = res.reviews.filter((r) => countsTowardScore(r.verification));
        const regular = res.reviews.filter((r) => !countsTowardScore(r.verification));
        setVerifiedReviews(verified.slice(0, 3));
        setPreviewReviews(regular.slice(0, 3));
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

  /**
   * Pick. 통합정책 v3.10 §3 — **첫 Pick이 대표 로그인 트리거**다.
   *
   * 로그인 전이면 누른 것을 적어두고 시트를 연다.
   */
  async function pick() {
    setSaving(true);
    setSaveNote(null);

    try {
      if (isServerConfigured && !(await loadToken())) {
        await savePendingAction({ kind: 'pick', vendorId: vendor!.id, vendorName: vendor!.name });
        setLoginOpen(true);
        return;
      }

      const weddingId = await ensureWedding();
      await addCandidate(weddingId, vendor!.id);
      setSaveNote('Pick했어요. Pick 탭에서 보실 수 있어요.');
    } catch (caught) {
      setSaveNote(caught instanceof Error ? caught.message : 'Pick하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * 비교에 담기(SPEC §13.11). 비교 화면은 WP-CMP-002 하나고 진입에 따라 후보 초기값만
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
  const isCollecting = paidPrice.stage === 'collecting';
  const isLimited = paidPrice.stage === 'limited';
  const isDetailed = paidPrice.stage === 'detailed';
  /* 금액 한 줄 — 0층 «업체 안내 150만원~» · 1층 «수집 중» · 3건+ 구간. 검색·비교와 같은 규칙. */
  const line = priceLine(paidPrice, vendor.guidePrice);
  /* 실 제보도 업체 안내도 없다 — «수집 중» + Pick 인증 CTA로 채운다(빈 섹션 처리). */
  const wantsPickProof = needsPickProof(paidPrice, vendor.guidePrice);

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

  /* «이용한 사람들의 경험»은 3명 미만이면 섹션째 숨긴다(SPEC §2). */
  const showExperience = vendor.usageScore.count >= EXPERIENCE_MIN_PEOPLE;
  const hasReviews = verifiedReviews.length > 0 || previewReviews.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/*
          뒤로가기. 스택 헤더를 끈 화면이라(search/_layout) 화면 안에 둔다 —
          데스크톱 웹은 이 버튼이 유일한 길이다(2026-09-08).
        */}
        <View style={styles.navBar}>
          <BackButton />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>

          {/*
            ①  대표 이미지 390×260.
            승인된 실사진이 있으면 그 대표 이미지를, 없으면 카테고리 기본으로
            대체한다(CLAUDE.md §8). `VendorImage`가 로드 실패까지 대신
            처리해준다 — source가 깨져도 카테고리 기본으로 조용히 되돌아간다.
          */}
          <View style={styles.hero}>
            <VendorImage
              source={photos[0] ? { uri: photos[0].url } : undefined}
              category={vendorImageCategory(vendor.category)}
              width={undefined}
              height={HERO_HEIGHT}
              radius={0}
            />
            {/*
              실제 사진이 한 장이라도 있을 때만 진입 버튼을 보여준다 — 없으면
              눌러도 소득이 없는 버튼이 된다(CLAUDE.md §8).
            */}
            {photos.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`사진 ${photos.length}장 보기`}
                onPress={() => router.push(`/search/${vendor.id}/images`)}
                style={[styles.photoCountBadge, { backgroundColor: theme.scrim }]}>
                <ThemedText type="t7" style={{ color: theme.onTint }}>
                  사진 {photos.length}장 보기
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {/* ② Identity — 영업 배지 + 업체명 + 핵심조건 */}
          <View style={styles.identitySection}>
            {vendor.sourceNote ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="업체 정보 출처 보기"
                accessibilityState={{ expanded: sourceOpen }}
                onPress={() => setSourceOpen((open) => !open)}
                style={styles.badgeRow}>
                <View style={[styles.sourceBadge, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="badge" themeColor="textSecondary">
                    공공기관 확인
                  </ThemedText>
                </View>
                <ThemedText type="t7" themeColor="textAssistive">
                  {sourceOpen ? '−' : '출처'}
                </ThemedText>
              </Pressable>
            ) : null}

            {sourceOpen && vendor.sourceNote ? (
              <ThemedText type="t7" themeColor="textSecondary">
                {vendor.sourceNote}
              </ThemedText>
            ) : null}

            {/* 업체명. WP-VEND-001: 26px 700 */}
            <ThemedText type="t2">{vendor.name}</ThemedText>

            {/* 핵심조건. WP-VEND-001: 16px 400 */}
            <ThemedText type="t6" themeColor="textSecondary">
              {VENDOR_CATEGORY_LABEL[vendor.category]} · {vendor.region}
            </ThemedText>
          </View>

          {/*
            ③ 추천 이유. 첫 줄은 업체 styleTags 전부를 칩으로 — 내가 고른 것과 겹치는
            것만 coral + 체크, 업체만 가진 것은 회색(SPEC §13.6). 첫 불릿은 일치 개수.
            조건 칩에 «도시적인»이 떠도 이 업체에 어떻게 반영됐는지 보이지 않으면 추천을
            믿지 않는다.
          */}
          {hasRecommendation ? (
            <>
              <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
              <View style={styles.section}>
                <ThemedText type="t4">추천 이유</ThemedText>
                {vendor.styleTags.length > 0 ? (
                  <View style={styles.styleChipRow}>
                    {vendor.styleTags.map((style) => {
                      const matched = matchedStyles.includes(style);
                      return (
                        <View
                          key={style}
                          accessibilityLabel={
                            matched
                              ? `${WEDDING_STYLE_LABEL[style]} · 고른 스타일`
                              : WEDDING_STYLE_LABEL[style]
                          }
                          style={[
                            styles.styleChip,
                            { backgroundColor: matched ? theme.tint : theme.backgroundSelected },
                          ]}>
                          {matched ? (
                            <ProductSymbol
                              name="check"
                              size={Layout.iconChipClose}
                              color={theme.onTint}
                            />
                          ) : null}
                          <ThemedText
                            type="badge"
                            style={[
                              styles.styleChipText,
                              { color: matched ? theme.onTint : theme.textSecondary },
                            ]}>
                            {WEDDING_STYLE_LABEL[style]}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                {reasonLines.length > 0 ? (
                  <View style={styles.bulletList}>
                    {reasonLines.map((reason) => (
                      <View key={reason} style={styles.bulletRow}>
                        <View style={[styles.bullet, { backgroundColor: theme.tint }]} />
                        <ThemedText type="t6" style={styles.bulletText}>{reason}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* ④ 실 제보 — 4단계 표시 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">{TERMS.verifiedData}</ThemedText>

            {isCollecting ? (
              /*
               * 실 제보 3건 미만. 업체 안내가 있으면 0층 — «업체 안내 150만원~» 회색 +
               * 출처 + 3건이 되면 바뀐다는 한 줄. 둘 다 없으면 1층 — «수집 중» + Pick 인증
               * CTA. 화면 절반이 빈 채로 나오지 않는다(SPEC §2 빈 섹션 처리).
               */
              <View style={styles.priceBlock}>
                <ThemedText
                  type="amount"
                  numeric
                  themeColor="textAssistive"
                  style={styles.amountText}>
                  {line.text}
                </ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  {line.caption}
                </ThemedText>
                {line.guide ? (
                  <ThemedText type="t7" themeColor="textSecondary">
                    {GUIDE_REPLACED_NOTE}
                  </ThemedText>
                ) : null}
                {wantsPickProof ? (
                  <ActionButton
                    label="Pick 인증"
                    hint="금액과 조건을 알려주시면 이 업체의 제보 금액이 여기 생겨요"
                    onPress={() => router.push(`/search/${vendor.id}/price-report`)}
                  />
                ) : null}
              </View>
            ) : (
              <>
                {/* 3~4건: 구간 + 정보가 적다는 안내 / 5+ 건: 구간 */}
                <View style={styles.priceBlock}>
                  <ThemedText type="amount" numeric style={styles.amountText}>
                    {line.text}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive">
                    {line.caption}
                  </ThemedText>
                  {/* 10+ 건: 기준금액 추가 */}
                  {isDetailed ? (
                    <ThemedText type="t6" themeColor="textSecondary">
                      {TERMS.baseAmount} {manwon(paidPrice.median)}
                    </ThemedText>
                  ) : null}
                  {/* 3~4건 안내 */}
                  {isLimited ? (
                    <ThemedText type="t7" themeColor="textAssistive">
                      {NOT_ENOUGH_DATA}
                    </ThemedText>
                  ) : null}
                </View>

                <ThemedText type="t7" themeColor="textAssistive">
                  {PAYMENT_PROOF_CAVEAT}
                </ThemedText>

                <ThemedText type="t7" themeColor="textAssistive">
                  마지막 확인 {vendor.lastVerifiedAt.slice(0, 10)}
                </ThemedText>
              </>
            )}

            {/* 조건이 비슷한 결제 사례 */}
            {conditions?.available ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t7" themeColor="textSecondary">
                  조건이 비슷한 Pick 가격
                </ThemedText>
                <ThemedText type="t5">{conditions.condition}</ThemedText>
                {conditions.price.stage === 'collecting' ? (
                  <ThemedText type="t6" themeColor="textSecondary">
                    {conditions.price.caption}
                  </ThemedText>
                ) : (
                  <>
                    <ThemedText type="t4" numeric>
                      {rangeLabel(conditions.price.low, conditions.price.high)}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textSecondary">
                      {conditions.price.caption}
                    </ThemedText>
                  </>
                )}
              </ThemedView>
            ) : null}

            {conditions && !conditions.available ? (
              <ThemedText type="t7" themeColor="textSecondary">
                {conditions.note}
              </ThemedText>
            ) : null}
          </View>

          {/* ⑥ 업체 안내 — 포함 항목 + 별도 비용 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">업체 안내</ThemedText>

            {vendor.prices.products.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t6" themeColor="textSecondary">
                  {vendor.comparableQuoteCount === 0
                    ? '이 업체의 확인된 계약 자료가 아직 없어요.'
                    : `확인된 계약이 ${vendor.comparableQuoteCount}건 모였지만, 같은 상품끼리 견주기에는 아직 모자라요.`}
                </ThemedText>
              </ThemedView>
            ) : (
              vendor.prices.products.map((product) => (
                <ThemedView
                  key={`${product.productLabel}-${product.docType}`}
                  type="backgroundElement"
                  style={styles.card}>
                  <ThemedText type="t5">{product.productLabel}</ThemedText>
                  <ThemedText type="t4" numeric>
                    {manwon(product.stat.median)}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary">
                    확인된 계약 {product.stat.sampleCount}건 · {product.stat.periodStart}~{product.stat.periodEnd}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive">
                    가운데 절반이 {manwon(product.stat.p25)}~{manwon(product.stat.p75)} 사이예요
                  </ThemedText>
                </ThemedView>
              ))
            )}

            {vendor.prices.deepDataNote ? (
              <ActionButton
                label={TERMS.reportCta}
                hint={vendor.prices.deepDataNote}
                onPress={() => router.push('/capture/payment/consent')}
              />
            ) : null}
          </View>

          {/* ⑦ 위치 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">위치</ThemedText>
            <ActionButton
              label="카카오맵에서 보기"
              hint={`${vendor.name} · ${vendor.region}`}
              onPress={() => {
                const query = encodeURIComponent(`${vendor.name} ${vendor.region}`);
                void Linking.openURL(`https://map.kakao.com/?q=${query}`);
              }}
            />
          </View>

          {/*
            ⑧ 경험 · 후기. «이용한 사람들의 경험»은 3명 미만이면 섹션째 숨기고 «후기»만
            남긴다. 후기가 0건이면 빈 섹션 대신 한 줄(SPEC §2 빈 섹션 처리).
          */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            {showExperience ? (
              <ThemedText type="t4">{TERMS.experience}</ThemedText>
            ) : (
              <ThemedText type="t4">{TERMS.review}</ThemedText>
            )}

            {showExperience ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                {vendor.usageScore.available ? (
                  <>
                    <ThemedText type="t1" numeric>{vendor.usageScore.average.toFixed(1)}</ThemedText>
                    <ThemedText type="t7" themeColor="textSecondary">
                      확인된 후기 {vendor.usageScore.count}건
                    </ThemedText>
                    {vendor.usageScore.aspects.map((aspect) => (
                      <View key={aspect.key} style={styles.meter}>
                        <View style={styles.meterHead}>
                          <ThemedText type="t7" themeColor="textSecondary">{aspect.label}</ThemedText>
                          <ThemedText type="t7" numeric>{aspect.average.toFixed(1)}</ThemedText>
                        </View>
                        <ProgressBar value={aspect.average / MAX_RATING} />
                      </View>
                    ))}
                    {vendor.usageScore.checklist.map((item) => (
                      <View key={item.key} style={styles.meter}>
                        <View style={styles.meterHead}>
                          <ThemedText
                            type="t7"
                            themeColor={item.needsAttention ? 'cautionary' : 'textSecondary'}>
                            {item.label}
                          </ThemedText>
                          <ThemedText
                            type="t7"
                            numeric
                            themeColor={item.collecting ? 'textAssistive' : undefined}>
                            {item.collecting ? '수집 중' : `${item.percent}%`}
                          </ThemedText>
                        </View>
                        <ProgressBar
                          value={item.collecting ? 0 : item.percent / 100}
                          color={item.needsAttention ? 'cautionary' : 'tint'}
                        />
                        {item.collecting ? null : (
                          <ThemedText type="t7" themeColor="textAssistive">
                            {item.answered}명 답함
                          </ThemedText>
                        )}
                      </View>
                    ))}
                    {vendor.usageScore.caption ? (
                      <ThemedText type="t7" themeColor="textAssistive">
                        {vendor.usageScore.caption}
                      </ThemedText>
                    ) : null}
                  </>
                ) : (
                  <ThemedText type="t6" themeColor="textSecondary">
                    {vendor.usageScore.reason}
                  </ThemedText>
                )}
              </ThemedView>
            ) : null}

            {/* Pick 인증 후기 */}
            {verifiedReviews.length > 0 ? (
              <>
                <ThemedText type="t5">Pick 인증 후기</ThemedText>
                {verifiedReviews.map((review) => (
                  <ThemedView key={review.id} type="backgroundElement" style={styles.card}>
                    <View style={styles.reviewHead}>
                      <View style={styles.reviewHeadLeft}>
                        <ThemedText type="t7" themeColor="textSecondary">{review.roleLabel}</ThemedText>
                        <View style={[styles.verifiedBadge, { backgroundColor: theme.positiveBackground }]}>
                          <ThemedText type="badge" themeColor="positive">Pick 인증</ThemedText>
                        </View>
                      </View>
                      <ThemedText type="t7" numeric>{review.overall.toFixed(1)}</ThemedText>
                    </View>
                    <ThemedText type="t6" numberOfLines={1}>{review.title}</ThemedText>
                    <ThemedText type="t7" themeColor="textSecondary" numberOfLines={2}>
                      {review.body}
                    </ThemedText>
                  </ThemedView>
                ))}
              </>
            ) : null}

            {/* 일반 후기 미리보기 */}
            {previewReviews.map((review) => (
              <ThemedView key={review.id} type="backgroundElement" style={styles.card}>
                <View style={styles.reviewHead}>
                  <ThemedText type="t7" themeColor="textSecondary">
                    {review.roleLabel} · {review.verificationLabel}
                  </ThemedText>
                  <ThemedText type="t7" numeric>{review.overall.toFixed(1)}</ThemedText>
                </View>
                <ThemedText type="t6" numberOfLines={1}>{review.title}</ThemedText>
                <ThemedText type="t7" themeColor="textSecondary" numberOfLines={2}>
                  {review.body}
                </ThemedText>
              </ThemedView>
            ))}

            {hasReviews ? (
              <ActionButton
                label="후기 보기"
                hint="이용하신 분들이 남긴 글이에요"
                onPress={() => router.push(`/search/${vendor.id}/reviews`)}
              />
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

          {/* 공식정보 — 출처 근거 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">공식정보</ThemedText>
            {vendor.sourceNote ? (
              <ThemedText type="t6" themeColor="textSecondary">
                {vendor.sourceNote}
              </ThemedText>
            ) : (
              <ThemedText type="t6" themeColor="textSecondary">
                공공기관이 확인한 정보를 기준으로 안내해요.
              </ThemedText>
            )}
          </View>

          {/* ⑤ Action — Pick(52px 코랄) + 비교에 담기(48px secondary). 순서 고정. */}
          <View style={styles.actionSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saving ? 'Pick하는 중' : `${vendor.name} Pick하기`}
              disabled={saving}
              style={[styles.pickBtn, { backgroundColor: theme.tint }]}
              onPress={() => void pick()}>
              <ThemedText type="t5" style={styles.pickBtnText}>
                {saving ? 'Pick하는 중…' : 'Pick하기'}
              </ThemedText>
            </Pressable>
            {saveNote ? (
              <ThemedText type="t7" themeColor="textSecondary">{saveNote}</ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="비교에 담기"
              disabled={saving}
              style={[styles.compareBtn, { borderColor: theme.border }]}
              onPress={addToCompare}>
              <ThemedText type="t6" themeColor="text">비교에 담기</ThemedText>
            </Pressable>
          </View>

          {/* ⑨ Pick 인증 권유 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">Pick 인증</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              자료를 올리면 이 업체의 실제 가격대를 더 정확하게 보여드려요.
            </ThemedText>
            <ActionButton
              label="가격 제보"
              hint="문서 없이 금액과 조건만 알려주시면 다음 분께 도움이 돼요"
              onPress={() => router.push(`/search/${vendor.id}/price-report`)}
            />
            <ActionButton
              label="내 금액과 비교하기"
              hint="자료를 올리면 이 업체의 Pick 가격대와 견줘 보여드려요"
              onPress={() => router.push('/capture')}
            />
            <ActionButton
              label="업체 정보가 달라요"
              hint="이름·지역이 실제와 다르면 알려주세요"
              onPress={() =>
                router.push({
                  pathname: '/my/contact',
                  params: {
                    category: 'data_correction',
                    subjectKind: 'vendor',
                    subjectId: vendor.id,
                    subjectName: vendor.name,
                  },
                })
              }
            />
            <ActionButton
              label="이 업체의 관계자예요"
              hint="확인되면 우리 업체 후기에 반론을 낼 수 있어요"
              onPress={() =>
                router.push({
                  pathname: '/my/vendor-claims/[vendorId]',
                  params: { vendorId: vendor.id, vendorName: vendor.name },
                })
              }
            />
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>

      <LoginSheet
        visible={loginOpen}
        reason={`로그인하면 ${withParticle(vendor.name, '을를')} 바로 Pick해드려요.`}
        onSignedIn={(result) => {
          setLoginOpen(false);

          if (result.needsSignup) {
            router.push('/setup');
            return;
          }

          setSaveNote(
            [
              result.completed ? 'Pick했어요. Pick 탭에서 보실 수 있어요.' : null,
              result.weddingError,
            ]
              .filter(Boolean)
              .join(' ') || null
          );
        }}
        onDismiss={() => setLoginOpen(false)}
      />
    </ThemedView>
  );
}

// ─── 레이아웃 상수 ──────────────────────────────────────────────────────────

/** 핸드오프 WP-VEND-001 대표 이미지 높이 260px */
const HERO_HEIGHT = 260;

/**
 * 스타일 칩(SPEC §13.6): 28px · radius 999 · 13px 700. 글자 13은 spec/tokens.json
 * typography «micro»(13/18/700)다 — @weddingpick/ui FontSize에는 아직 없어 줄 높이만
 * 토큰(LineHeight.micro)을 쓴다. 높이 28은 핸드오프 값 그대로다.
 */
const STYLE_CHIP_HEIGHT = 28;
const STYLE_CHIP_FONT_SIZE = 13;

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
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  /* 상단 내비 56 — 핸드오프 navBar. */
  navBar: {
    height: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    justifyContent: 'center',
  },

  // ── 대표 이미지 ──
  hero: {
    width: '100%',
    height: HERO_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  photoCountBadge: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },

  // ── Identity 블록 ──
  identitySection: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    minHeight: Layout.touchTarget,
  },
  sourceBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },

  // ── 밴드 구분선 ──
  band: {
    height: Layout.sectionBand,
  },

  // ── 공통 섹션 ──
  section: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },

  // ── 추천 이유 · 스타일 칩 (SPEC §13.6: 28px · radius 999 · 13px 700) ──
  styleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  styleChip: {
    height: STYLE_CHIP_HEIGHT,
    borderRadius: Radius.pill,
    paddingHorizontal: Layout.cardGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  styleChipText: {
    fontSize: STYLE_CHIP_FONT_SIZE,
    lineHeight: LineHeight.micro,
    fontWeight: 700,
  },

  // ── 추천 이유 불릿 ──
  bulletList: {
    gap: Spacing.two,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: (LineHeight.t6 - 6) / 2,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
  },

  // ── 실 제보 금액 블록 ──
  priceBlock: {
    gap: Spacing.one,
  },
  amountText: {
    fontVariant: ['tabular-nums'],
  },

  // ── 공통 카드 ──
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },

  // ── Action 섹션 ──
  actionSection: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },
  /** Pick 버튼. WP-VEND-001: height 52px 코랄. */
  pickBtn: {
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBtnText: {
    color: Colors.light.onTint,
  },
  /** 비교에 담기. WP-VEND-001: height 48px secondary. */
  compareBtn: {
    height: Layout.controlLarge,
    borderRadius: Radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 이용 점수 미터 ──
  meter: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── 후기 ──
  /* 후기 0건 한 줄. 행 최소 높이 44 — 눌러서 첫 후기로 간다. */
  noReviewsRow: {
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  verifiedBadge: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },

  bottomPad: {
    height: Spacing.five,
  },
});
