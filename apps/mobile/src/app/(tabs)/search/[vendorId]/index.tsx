import type { ConditionStats, VendorDetail } from '@weddingpick/api-contract';
import {
  DOCUMENT_TYPE_LABEL,
  manwon,
  MAX_RATING,
  PAYMENT_PROOF_CAVEAT,
  rangeLabel,
  STILL_COLLECTING,
  VENDOR_CATEGORY_LABEL,
  withParticle,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addCandidate, ensureWedding, getVendor, getVendorConditions } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { LoginSheet } from '@/features/auth/login-sheet';
import { savePendingAction } from '@/features/auth/pending-action';
import {
  ActionButton,
  MaxContentWidth,
  ProgressBar,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { won } from '@/features/quotes/quote-result-view';

/**
 * A-17 업체 상세.
 *
 * 별점도 후기도 없다. 확인된 실제 계약이 충분히 모인 상품만 가격을 보여주고, 그렇지
 * 않으면 그렇다고 말한다 — 자료가 없는 업체와 싼 업체가 같은 얼굴이 되면 안 된다.
 */
export default function VendorDetailScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const theme = useTheme();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  /** 조건이 비슷한 결제 사례. 상세와 따로 읽는다 — 하나가 늦어도 나머지는 뜬다. */
  const [conditions, setConditions] = useState<ConditionStats | null>(null);
  /** 출처를 펼쳤는가. 배지를 눌러 연다. */
  const [sourceOpen, setSourceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 로그인 시트가 떠 있는가. 첫 Pick이 대표 트리거다(v3.10 §3). */
  const [loginOpen, setLoginOpen] = useState(false);

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
  }, [vendorId]);

  if (error) {
    return (
      <Frame>
        <ThemedText type="subtitle">불러오지 못했습니다</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  if (!vendor) {
    return (
      <Frame>
        <ActivityIndicator color={theme.tint} />
      </Frame>
    );
  }

  /**
   * Pick. 통합정책 v3.10 §3 — **첫 Pick이 대표 로그인 트리거**다.
   *
   * 로그인 전이면 누른 것을 적어두고 시트를 연다. 로그인 화면으로 밀어내지 않는
   * 이유는, 돌아왔을 때 이 업체도 스크롤 위치도 사라지기 때문이다. 로그인이
   * 끝나면 적어둔 Pick을 시트가 대신 마친다.
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">{vendor.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {VENDOR_CATEGORY_LABEL[vendor.category]} · {vendor.region}
            </ThemedText>
            {/*
              공식정보 배지. 핸드오프 8번 — 눌러서 기관·출처·기준일을 본다.

              배지만 두고 출처를 감추지 않는다. `공공데이터`라는 말은 그 자체로는
              아무것도 확인해주지 않는다 — 어느 기관의 무엇을 언제 확인했는지가
              그 배지의 내용이다.
            */}
            {vendor.sourceNote ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="업체 정보 출처 보기"
                accessibilityState={{ expanded: sourceOpen }}
                onPress={() => setSourceOpen((open) => !open)}
                style={styles.sourceRow}>
                <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="badge" themeColor="textSecondary">
                    공공데이터
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
          </ThemedView>

          {/*
            실제 결제. **잠기지 않는다** — 최종통합정책 v2.0 K-6이 "결제인증 회원만
            접근"을 폐기했다. 무엇을 보여줄지는 사람이 아니라 데이터 수가 정한다
            (0~2 수집 중 / 3~4 구간+안내 / 5~9 구간 / 10+ 중앙값).

            타입이 단계별로 갈려 있어, 수집 중인 업체에 구간을 그리는 코드는
            애초에 컴파일되지 않는다.
          */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">실제 결제</ThemedText>

            {vendor.prices.paidPrice.stage === 'collecting' ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t5" themeColor="textSecondary">
                  {STILL_COLLECTING}
                </ThemedText>
                <ThemedText type="t7" themeColor="textSecondary">
                  {vendor.prices.paidPrice.caption}
                </ThemedText>
              </ThemedView>
            ) : (
              /* 핸드오프 8번의 잉크 블록. 이 화면에서 가장 중요한 숫자다. */
              <ThemedView style={[styles.ink, { backgroundColor: theme.tint }]}>
                <ThemedText type="amount" numeric style={styles.onTint}>
                  {rangeLabel(vendor.prices.paidPrice.low, vendor.prices.paidPrice.high)}
                </ThemedText>
                {/* 원문 16번: 데이터 수와 기준 기간을 금액 옆에 반드시 함께 적는다. */}
                <ThemedText type="t7" style={styles.onTint}>
                  {vendor.prices.paidPrice.caption}
                </ThemedText>
                {vendor.prices.paidPrice.stage === 'detailed' ? (
                  <ThemedText type="t6" style={styles.onTint}>
                    기준금액 {manwon(vendor.prices.paidPrice.median)}
                  </ThemedText>
                ) : null}
              </ThemedView>
            )}

            {/*
              무엇을 세는 숫자인지 늘 함께 적는다. 계약 전체 금액과 그때 결제한
              금액은 다른 값이고, 옆에 나란히 놓이면 같은 것으로 읽힌다.
            */}
            <ThemedText type="t7" themeColor="textSecondary">
              {PAYMENT_PROOF_CAVEAT}
            </ThemedText>

            {/*
              결제인증이 여는 것은 구간이 아니라 깊이다. 이미 열려 있는 사람에게는
              권하지 않는다 — 서버가 null을 준다.
            */}
            {vendor.prices.deepDataNote ? (
              <ActionButton
                label="결제내역 등록하기"
                hint={vendor.prices.deepDataNote}
                onPress={() => router.push('/capture/payment/consent')}
              />
            ) : null}

            {/*
              조건이 비슷한 결제 사례. v2.0 D-1.
              위의 구간은 이 업체의 것이고, 이건 같은 업종에서 조건을 좁힌
              것이다 — 둘을 나란히 두면 어느 쪽이 비싼지 보인다.
             */}
            {conditions?.available ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t7" themeColor="textSecondary">
                  조건이 비슷한 결제
                </ThemedText>
                {/* 어느 조건의 숫자인지가 숫자보다 먼저다. */}
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

            {/*
              못 낼 때는 왜 못 내는지 적는다. 결제인증으로 여는 안내는 위에 이미
              있으므로, 여기서는 자료가 모이는 중이라는 말만 한다.
             */}
            {conditions && !conditions.available && !vendor.prices.deepDataNote ? (
              <ThemedText type="t7" themeColor="textSecondary">
                {conditions.note}
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">실제 계약 가격</ThemedText>

            {vendor.prices.products.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {vendor.comparableQuoteCount === 0
                    ? '이 업체의 확인된 계약 자료가 아직 없습니다.'
                    : `확인된 계약이 ${vendor.comparableQuoteCount}건 모였지만, 같은 상품끼리 견주기에는 아직 모자랍니다.`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  자료가 모이기 전에는 가격을 지어내지 않습니다.
                </ThemedText>
              </ThemedView>
            ) : (
              vendor.prices.products.map((product) => (
                <ThemedView
                  key={`${product.productLabel}-${product.docType}`}
                  type="backgroundElement"
                  style={styles.card}>
                  <ThemedText type="smallBold">{product.productLabel}</ThemedText>
                  <ThemedText type="subtitle">{won(product.stat.median)}</ThemedText>
                  {/* 데이터 수와 기준 기간을 늘 함께 보인다. */}
                  <ThemedText type="small" themeColor="textSecondary">
                    {DOCUMENT_TYPE_LABEL[product.docType]} · 확인된 계약{' '}
                    {product.stat.sampleCount}건 · {product.stat.periodStart}~
                    {product.stat.periodEnd}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    가운데 절반이 {won(product.stat.p25)}~{won(product.stat.p75)} 사이입니다
                  </ThemedText>
                </ThemedView>
              ))
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">이용점수</ThemedText>

            {/*
              확인된 후기만 들어간다. 데이터가 모자라면 숫자를 만들지 않고 이유를 준다 —
              가격과 같은 규칙이다. 후기 두세 건으로 만든 점수는 정보가 아니라 소음이고,
              업체 하나를 망칠 수도 살릴 수도 있다.
            */}
            <ThemedView type="backgroundElement" style={styles.card}>
              {vendor.usageScore.available ? (
                <>
                  <ThemedText type="subtitle">{vendor.usageScore.average.toFixed(1)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    확인된 후기 {vendor.usageScore.count}건
                  </ThemedText>
                  {/* 별점은 5점 만점을 채운 비율로 그린다. 핸드오프 8번. */}
                  {vendor.usageScore.aspects.map((aspect) => (
                    <ThemedView key={aspect.key} type="backgroundElement" style={styles.meter}>
                      <ThemedView type="backgroundElement" style={styles.meterHead}>
                        <ThemedText type="t7" themeColor="textSecondary">
                          {aspect.label}
                        </ThemedText>
                        <ThemedText type="t7" numeric>
                          {aspect.average.toFixed(1)}
                        </ThemedText>
                      </ThemedView>
                      <ProgressBar value={aspect.average / MAX_RATING} />
                    </ThemedView>
                  ))}

                  {/*
                    체크리스트는 별점과 다른 배열로 온다. 4.2점과 78%는 다른 것을
                    재는 숫자라 같은 막대로 그리지 않는다. 표본이 모자라면 숫자
                    대신 "수집 중"이다 — 흐린 숫자도 숫자다.
                  */}
                  {vendor.usageScore.checklist.map((item) => (
                    <ThemedView key={item.key} type="backgroundElement" style={styles.meter}>
                      <ThemedView type="backgroundElement" style={styles.meterHead}>
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
                      </ThemedView>

                      {/*
                        데이터가 모자라면 막대를 그리지 않고 빈 트랙만 둔다 —
                        흐린 숫자도 숫자고, 사람들은 숫자를 읽는다.
                        70 미만은 주황(핸드오프 8번).
                      */}
                      <ProgressBar
                        value={item.collecting ? 0 : item.percent / 100}
                        color={item.needsAttention ? 'cautionary' : 'tint'}
                      />

                      {item.collecting ? null : (
                        <ThemedText type="t7" themeColor="textAssistive">
                          {item.answered}명 답함
                        </ThemedText>
                      )}
                    </ThemedView>
                  ))}
                  {vendor.usageScore.caption ? (
                    <ThemedText type="small" themeColor="textAssistive">
                      {vendor.usageScore.caption}
                    </ThemedText>
                  ) : null}
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {vendor.usageScore.reason}
                </ThemedText>
              )}
            </ThemedView>

            <ActionButton
              label="후기 보기"
              hint="이용하신 분들이 남긴 글입니다"
              onPress={() => router.push(`/search/${vendor.id}/reviews`)}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            {/*
              Pick하는 자리. 사람이 아니라 웨딩에 매단다 — 배우자가 같은 목록을
              보고, 그래야 같은 이야기를 할 수 있다.
            */}
            <ActionButton
              variant="primary"
              label={saving ? 'Pick하는 중…' : 'Pick하기'}
              hint="배우자와 함께 보는 목록에 들어가요"
              disabled={saving}
              onPress={() => void pick()}
            />
            {saveNote ? (
              <ThemedText type="small" themeColor="textSecondary">
                {saveNote}
              </ThemedText>
            ) : null}
            <ActionButton
              label="내 견적서와 비교하기"
              hint="견적서를 올리면 이 업체의 실제 계약과 견줘 보여드립니다"
              onPress={() => router.push('/capture')}
            />
            <ActionButton
              label="업체 정보가 다릅니다"
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
            {/*
              업체 쪽 사람이 들어오는 문. v2.0 26번 — 관계자로 확인되면 자기
              업체 후기에 반론을 낼 수 있다.
            */}
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
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <LoginSheet
        visible={loginOpen}
        reason={`로그인하면 ${withParticle(vendor.name, '을를')} 바로 Pick해드려요.`}
        onSignedIn={(result) => {
          setLoginOpen(false);
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

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    minHeight: 32,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  meter: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /** 실제 결제 잉크 블록. 핸드오프 8번 — 이 화면에서 가장 중요한 숫자다. */
  ink: {
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  onTint: {
    color: '#ffffff',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
