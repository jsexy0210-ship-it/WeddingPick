import type { MyReportListResponse } from '@weddingpick/api-contract';
import { TERMS, manwon } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { listMyReports } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { formatMonthDayDot } from '@/features/common/format-date';
import { Layout, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { Badge, Band, Hero, ListRow, NavBar, Screen, Section, type BadgeTone } from '@/features/wedding/screen-kit';
import { useCaptureDraft } from '@/features/capture/capture-draft';

/** `spec/strings.ko.json` `report.*` · 시안 11-report-review #12a. */
const S = {
  nav: TERMS.report,
  heroTitle: '얼마 냈는지 알려주면 다음 사람이 덜 헤매요',
  heroSub: '사진 한 장이면 자동으로 정리돼요',
  pickVerify: 'Pick 인증',
  pickVerifyDesc: '낸 금액이 보이는 사진 한 장이면 업체와 금액을 자동으로 읽어요',
  price: TERMS.priceReport,
  priceDesc: '증빙 없이 들은 금액만 알려주는 방법이에요',
  vendorInfo: '업체정보 제보',
  vendorInfoDesc: '새 업체 등록 · 정보 정정 · 영업종료 알림',
  quote: '견적서 정리', // pick-language: 받는 서류 이름
  quoteDesc: '견적서를 읽어 항목과 별도로 확인할 비용을 정리해요', // pick-language: 받는 서류 이름
  logTitle: TERMS.myReports.replace('내역', ' 내역'),
  seeAll: '전체 보기',
  logEmpty: '아직 제보한 것이 없어요',
} as const;

/** 내 제보 내역 요약의 배지 — 쓰이고 있으면 «반영됨», 사유가 있으면 «확인 필요», 아니면 «반영 전». */
function badgeOf(report: MyReportListResponse['reports'][number]): { label: string; tone: BadgeTone } {
  if (report.inUse) return { label: '반영됨', tone: 'ok' };
  if (report.note) return { label: '확인 필요', tone: 'wait' };

  return { label: '반영 전', tone: 'none' };
}

/**
 * 제보 홈. WP-RPT-001 · 핸드오프 11-report-review #12a.
 *
 *   nav      «제보»
 *   hero     «얼마 냈는지 알려주면 다음 사람이 덜 헤매요» · «사진 한 장이면 자동으로 정리돼요»
 *   카드 3    Pick 인증 · 가격 제보 · 업체정보 제보 — 테두리 1 · radius 10 · padding 20 · 제목 18/24 · 설명 14/19 · chevron
 *   밴드
 *   내 제보 내역  «전체 보기» · 업체명 18/24 700 · «168만원 · 05.16(토)» · 상태 배지
 *
 * 제보는 루트 탭이 아니다(v3.2 §1) — MY와 업체 상세, 웨딩일정 지출에서 들어온다.
 * **Pick 인증이 앞이고 견적서가 뒤다.** 계약서 원본은 받지 않는다(비밀유지 조항 · 법률 확인 전).
 * 견적서 정리는 네 번째 카드로 남긴다 — 촬영 · 앨범 · PDF 입력이 그 안에서 이어진다.
 */
export default function CaptureScreen() {
  const theme = useTheme();
  const { pages } = useCaptureDraft();
  const [reports, setReports] = useState<MyReportListResponse | null>(null);

  const load = useCallback(() => {
    if (!isServerConfigured) return;
    listMyReports()
      .then(setReports)
      .catch(() => setReports(null));
  }, []);

  useEffect(load, [load]);

  const cards: { title: string; desc: string; onPress: () => void }[] = [
    { title: S.pickVerify, desc: S.pickVerifyDesc, onPress: () => router.push('/capture/payment/consent') },
    { title: S.price, desc: S.priceDesc, onPress: () => router.push('/search' as never) },
    {
      title: S.vendorInfo,
      desc: S.vendorInfoDesc,
      onPress: () => router.push({ pathname: '/my/contact', params: { category: 'vendor_info' } } as never),
    },
    {
      title: pages.length > 0 ? `${S.quote} · 작성 중 ${pages.length}장` : S.quote,
      desc: S.quoteDesc,
      /*
       * **동의 화면을 먼저 지난다**(Release Audit 1차 P0-5, 2026-09-09). 예전에는
       * 촬영으로 바로 갔다 — 견적서 원본도 결제 증빙과 똑같이 외부로 나가는데
       * 묻지도 기록하지도 않았다. 이미 동의한 사람은 그 화면이 지나쳐 보낸다.
       */
      onPress: () => router.push('/capture/quote/consent'),
    },
  ];

  const recent = reports?.reports.slice(0, 3) ?? [];

  return (
    <Screen>
      <NavBar title={S.nav} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={S.heroTitle} sub={S.heroSub} />

        <View style={styles.cards}>
          {cards.map((card) => (
            <Pressable
              key={card.title}
              accessibilityRole="button"
              accessibilityLabel={card.title}
              onPress={card.onPress}
              style={({ pressed }) => [styles.card, { borderColor: theme.track }, pressed && styles.pressed]}>
              <View style={styles.cardText}>
                <ThemedText type="t5">{card.title}</ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  {card.desc}
                </ThemedText>
              </View>
              <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
            </Pressable>
          ))}
        </View>

        {isServerConfigured ? (
          <>
            <Band />
            <Section title={S.logTitle} action={{ label: S.seeAll, onPress: () => router.push('/my/reports' as never) }}>
              {recent.length === 0 ? (
                <ListRow title={S.logEmpty} titleColor="textAssistive" divider={false} />
              ) : (
                recent.map((report) => {
                  const badge = badgeOf(report);

                  return (
                    <ListRow
                      key={report.id}
                      title={report.subject}
                      titleBold
                      sub={[report.amount != null ? manwon(report.amount) : report.kindLabel, formatMonthDayDot(report.reportedAt)]
                        .filter(Boolean)
                        .join(' · ')}
                      subLines={1}
                      right={<Badge label={badge.label} tone={badge.tone} />}
                      onPress={() => router.push('/my/reports' as never)}
                    />
                  );
                })
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.two },
  cards: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.rowPaddingY },
  /* 제보 카드 — radius 10 · 테두리 1 · padding 20 · gap 14. */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Layout.cardPadding,
  },
  cardText: { flex: 1, minWidth: 0, gap: Spacing.one },
  pressed: { opacity: 0.8 },
});
