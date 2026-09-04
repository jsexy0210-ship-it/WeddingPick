import type { ConditionStats, Review, VendorDetail, VendorPhoto } from '@weddingpick/api-contract';
import {
  manwon,
  MAX_RATING,
  NOT_ENOUGH_DATA,
  PAYMENT_PROOF_CAVEAT,
  STILL_COLLECTING,
  TERMS,
  countsTowardScore,
  rangeLabel,
  VENDOR_CATEGORY_LABEL,
  withParticle,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addCandidate,
  ensureWedding,
  getVendor,
  getVendorConditions,
  listVendorPhotos,
  listVendorReviews,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { LoginSheet } from '@/features/auth/login-sheet';
import { savePendingAction } from '@/features/auth/pending-action';
import {
  ActionButton,
  Colors,
  ErrorView,
  Layout,
  LineHeight,
  LoadingView,
  MaxContentWidth,
  ProgressBar,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  VendorImage,
  useTheme,
} from '@weddingpick/ui';

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
      })
      .catch(() => undefined);
  }, [vendorId]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!vendor) {
    return <LoadingView />;
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
   * 비교에 담기. 이 앱에는 별도의 "비교 바구니"가 없다 — 비교는 같은 업종에
   * Pick해둔 후보끼리 한다(Pick 탭 SharedSection과 동일한 모델). 그래서 이
   * 버튼도 Pick과 같은 저장을 하고, 대신 바로 그 업종의 후보 목록으로
   * 이동시켜 비교가 시작되는 자리를 보여준다.
   */
  async function addToCompare() {
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
      router.push({
        pathname: '/pick/[category]',
        params: { category: vendor!.category },
      });
    } catch (caught) {
      setSaveNote(caught instanceof Error ? caught.message : '담지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  const paidPrice = vendor.prices.paidPrice;
  const isCollecting = paidPrice.stage === 'collecting';
  const isLimited = paidPrice.stage === 'limited';
  const isDetailed = paidPrice.stage === 'detailed';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
              category={vendor.category as Parameters<typeof VendorImage>[0]['category']}
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

          {/* ③ 추천 이유 — 검색·TOP3에서 넘어올 때만 */}
          {reasons.length > 0 ? (
            <>
              <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
              <View style={styles.section}>
                <ThemedText type="t4">추천 이유</ThemedText>
                <View style={styles.bulletList}>
                  {reasons.map((reason) => (
                    <View key={reason} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: theme.tint }]} />
                      <ThemedText type="t6" style={styles.bulletText}>{reason}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}

          {/* ④ 확인된 정보 — 4단계 표시 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">{TERMS.verifiedData}</ThemedText>

            {isCollecting ? (
              /* 0~2건: 수집 중, 금액 구간 비공개 */
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t5" themeColor="textSecondary">{STILL_COLLECTING}</ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  {paidPrice.caption}
                </ThemedText>
              </ThemedView>
            ) : (
              <>
                {/* 3~4건: 구간 + 정보가 적다는 안내 / 5+ 건: 구간 */}
                <View style={styles.priceBlock}>
                  <ThemedText type="amount" numeric style={styles.amountText}>
                    {rangeLabel(paidPrice.low, paidPrice.high)}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive">
                    {paidPrice.caption}
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

          {/* ⑧ 후기 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">{TERMS.experience}</ThemedText>

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

            <ActionButton
              label="후기 보기"
              hint="이용하신 분들이 남긴 글이에요"
              onPress={() => router.push(`/search/${vendor.id}/reviews`)}
            />
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
              onPress={() => void addToCompare()}>
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
            router.push('/signup');
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

  // ── 확인된 정보 금액 블록 ──
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
