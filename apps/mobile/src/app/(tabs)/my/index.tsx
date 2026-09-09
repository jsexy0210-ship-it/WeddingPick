import type { CurrentUser, MyReportListResponse } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_FIELD_LABEL,
  BUDGET_BRACKET_LABEL,
  BUSINESS_NOTICE_LINES,
  formatDateDot,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import {
  getCurrentUser,
  getMyMonthlyDraw,
  getMyRewards,
  getWeddingInvite,
  listMyReports,
} from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import { participableCount } from '@/features/membership/use-benefit-data';
import { Avatar, Badge, Row, Rows, SectionTitle } from '@/features/settings/my-kit';
import { APP_VERSION } from '@/features/settings/version';

/** 배우자 연결 상태 — CLAUDE.md §8 «커플: 미연결 · 초대 대기 · 연결됨». */
type CoupleState = 'unlinked' | 'invited' | 'linked';

type MyData = {
  me: CurrentUser | null;
  reports: MyReportListResponse | null;
  couple: CoupleState | null;
  /** 혜택 · 이벤트 «N개 참여 가능». 셋 중 하나라도 못 불러오면 적지 않는다. */
  benefits: number | null;
};

const EMPTY: MyData = { me: null, reports: null, couple: null, benefits: null };

/** `spec/strings.ko.json` `my.*`의 확정 카피. 시안 05-root 9d WP-MY-001. */
const S = {
  title: 'MY',
  settings: '설정',
  verifiedBadge: 'Pick 인증 완료',
  nameless: '이름을 정해주세요',
  'group.activity': '내 활동',
  'group.wedding': '웨딩 설정',
  'group.account': '계정',
  'group.biz': '업체 · 플래너',
  'item.report': '제보',
  'item.reportLog': '내 제보 내역',
  'item.myReview': '내 후기',
  'item.benefit': '혜택 · 이벤트',
  'item.weddingSetting': '내 웨딩 설정',
  'item.taste': '스타일 다시 고르기',
  'item.partner': '배우자 연결 관리',
  'item.notification': '알림 설정',
  'item.display': '화면 설정',
  'item.account': '계정',
  'item.support': '고객지원',
  'item.serviceInfo': '서비스 정보',
  'item.bizInquiry': '업체 · 플래너 문의',
  count: (n: number) => `${n}건`,
  benefitCount: (n: number) => `${n}개 참여 가능`,
  /*
   * 시안(08c 18c)은 «광고 제휴»까지 적지만, 광고 제휴 기능은 2026-09-05 정책으로
   * 삭제됐다(CLAUDE.md) — 접수 창구에서도 뺀다.
   */
  bizBody: '정보 수정 · 반론 · 사진 제공 · 혜택 등록을 여기서 접수해요.',
  bizCta: '문의하기',
  'setting.date': '예식일',
  'setting.region': '지역',
  /* v3.19가 «총예산»을 «준비 예산»으로 바꿨다 — 라벨은 domain BUDGET_BRACKET_FIELD_LABEL 한 곳에서 온다. */
  'setting.budget': BUDGET_BRACKET_FIELD_LABEL,
  logout: '로그아웃',
  loginCta: '로그인 · 가입하기',
  loginHint: '웨딩일정과 Pick 인증에 필요해요',
} as const;

const COUPLE_LABEL: Record<CoupleState, string> = {
  unlinked: '미연결',
  invited: '초대 대기',
  linked: '연결됨',
};

/**
 * MY 홈 · WP-MY-001. 디자인 핸드오프 `05-root.dc.html` 9d.
 *
 * 헤더(MY + 설정 톱니) → 프로필 → 웨딩 설정 요약 3행 → 밴드 → 메뉴 3그룹(내 활동 · 웨딩 설정 ·
 * 계정) → 밴드 → 업체 · 플래너 문의(08c · screens.json WP-MY-001 «맨 아래 업체·플래너 문의»).
 * 그 아래는 시안에 없지만 남겨야 하는 것 — 로그아웃과 사업자 정보 공시(법정 표시).
 *
 * **준비 현황은 여기 두지 않는다.** 홈 4칸과 WP-HOME-009 두 곳뿐이다(SPEC §13.9).
 *
 * 로그인 없이는 앱을 쓸 수 없어(2026-09-04) 비회원 상태는 세션이 끊긴 잠깐뿐이다.
 * 그때는 개인화 영역(이름 · 웨딩 정보)을 아는 척하지 않고 로그인 CTA만 둔다.
 */
export default function MyScreen() {
  const theme = useTheme();
  const { state, signOut } = useSession();
  const [data, setData] = useState<MyData>(EMPTY);

  const isSignedIn = state.status === 'signedIn';

  const load = useCallback(() => {
    if (!isSignedIn) {
      void Promise.resolve().then(() => setData(EMPTY));
      return;
    }

    void getCurrentUser()
      .then(async (me) => {
        setData((prev) => ({ ...prev, me }));
        const [reports, invite, rewards, draw] = await Promise.allSettled([
          listMyReports(),
          /* 연결 전이면 살아 있는 초대가 있는지 본다 — «초대 대기»는 그때만이다. */
          me.spouseLinked || !me.weddingId
            ? Promise.resolve(null)
            : getWeddingInvite(me.weddingId),
          getMyRewards(),
          getMyMonthlyDraw(),
        ]);
        const couple: CoupleState = me.spouseLinked
          ? 'linked'
          : invite.status === 'fulfilled' && invite.value?.invite
            ? 'invited'
            : 'unlinked';
        setData((prev) => ({
          ...prev,
          reports: reports.status === 'fulfilled' ? reports.value : null,
          couple,
          benefits: participableCount({
            me,
            rewards: rewards.status === 'fulfilled' ? rewards.value : null,
            draw: draw.status === 'fulfilled' ? draw.value : null,
          }),
        }));
      })
      .catch(() => setData(EMPTY));
  }, [isSignedIn]);

  useEffect(load, [load]);

  /** 세션이 끊긴 채 메뉴를 누르면 로그인으로 보낸다. */
  function guestPush(path: string) {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    router.push(path as never);
  }

  const me = data.me;
  const initial = me?.displayName?.slice(0, 1) ?? '나';
  const reports = data.reports?.reports ?? [];
  /* «제보 N건»은 후기를 빼고 센다 — 후기는 «내 후기» 줄이 따로 센다. */
  const totalReports = reports.filter((report) => report.kind !== 'review').length;
  const totalReviews = reports.filter((report) => report.kind === 'review').length;
  /*
   * 설정을 한 번이라도 마쳤으면 박스를 둔다 — v3.19부터 예식일 · 지역 · 예산이 전부
   * «미정»일 수 있어 값의 유무로는 알 수 없다.
   */
  const hasWeddingSetting = Boolean(
    me?.setupComplete || me?.weddingDate || me?.region || me?.budgetBracket
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 헤더 56 — 제목 20/27 · 오른쪽 설정 톱니 40 원형. 아래 선 없다. */}
        <View style={styles.header}>
          <ThemedText type="t4">{S.title}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={S.settings}
            onPress={() => guestPush('/my/settings')}
            style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}>
            <ProductSymbol name="gear" size={Layout.iconTab} color={theme.textStrong} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 프로필 — 아바타 56 · 이름 24/32 · Pick 인증 배지 · chevron 18 */}
          {isSignedIn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="프로필"
              style={styles.profileRow}
              onPress={() => router.push('/my/profile' as never)}>
              <Avatar initial={initial} />
              <View style={styles.profileInfo}>
                <ThemedText type="t3" numberOfLines={1}>
                  {me?.displayName ? `${me.displayName}님` : S.nameless}
                </ThemedText>
                {me?.hasPaymentProof ? <Badge kind="ok">{S.verifiedBadge}</Badge> : null}
              </View>
              <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
            </Pressable>
          ) : (
            <View style={styles.loginCta}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={S.loginCta}
                onPress={() => router.push('/login')}
              />
              <ThemedText type="t7" themeColor="textAssistive" style={styles.center}>
                {S.loginHint}
              </ThemedText>
            </View>
          )}

          {/* 웨딩 설정 요약 3행 — 누르는 곳이 아니다. 바꾸기는 아래 «내 웨딩 설정»이 한다. */}
          {isSignedIn && hasWeddingSetting && (
            <View style={styles.weddingBoxWrap}>
              <ThemedView type="backgroundElement" style={styles.weddingBox}>
                {me?.weddingDate && (
                  <SettingRow label={S['setting.date']} value={formatDateDot(me.weddingDate)} />
                )}
                {me?.region && <SettingRow label={S['setting.region']} value={me.region} />}
                {me?.budgetBracket && (
                  <SettingRow label={S['setting.budget']} value={BUDGET_BRACKET_LABEL[me.budgetBracket]} />
                )}
              </ThemedView>
            </View>
          )}

          <Band />

          {/* 내 활동 — 제보 · 내 제보 내역 · 내 후기 · 혜택 · 이벤트 */}
          <MenuGroup title={S['group.activity']}>
            <Row
              name={S['item.report']}
              tail={totalReports > 0 ? S.count(totalReports) : undefined}
              tailDim
              chevron
              onPress={() => guestPush('/capture')}
            />
            <Row name={S['item.reportLog']} chevron onPress={() => guestPush('/my/reports')} />
            <Row
              name={S['item.myReview']}
              tail={totalReviews > 0 ? S.count(totalReviews) : undefined}
              tailDim
              chevron
              onPress={() => guestPush('/my/reviews')}
            />
            <Row
              name={S['item.benefit']}
              tail={data.benefits !== null && data.benefits > 0 ? S.benefitCount(data.benefits) : undefined}
              tailDim
              chevron
              onPress={() => guestPush('/my/rewards')}
            />
          </MenuGroup>

          {/* 웨딩 설정 */}
          <MenuGroup title={S['group.wedding']}>
            <Row name={S['item.weddingSetting']} chevron onPress={() => guestPush('/my/wedding-settings')} />
            <Row name={S['item.taste']} chevron onPress={() => guestPush('/my/taste')} />
            <Row
              name={S['item.partner']}
              tail={data.couple ? COUPLE_LABEL[data.couple] : undefined}
              tailDim
              chevron
              onPress={() => guestPush('/wedding/partner')}
            />
            <Row name={S['item.notification']} chevron onPress={() => guestPush('/my/notification-settings')} />
            <Row name={S['item.display']} chevron onPress={() => guestPush('/my/display')} />
          </MenuGroup>

          {/* 계정 */}
          <MenuGroup title={S['group.account']}>
            <Row name={S['item.account']} chevron onPress={() => guestPush('/my/account')} />
            <Row name={S['item.support']} chevron onPress={() => guestPush('/my/support')} />
            <Row
              name={S['item.serviceInfo']}
              tail={`v${APP_VERSION}`}
              tailDim
              chevron
              onPress={() => router.push('/my/policies' as never)}
            />
          </MenuGroup>

          <Band />

          {/* 업체 · 플래너 문의 — 사용자용 메뉴와 구분한다(08c 18c). */}
          <View style={styles.bizSection}>
            <SectionTitle>{S['group.biz']}</SectionTitle>
            <View style={[styles.bizBox, { backgroundColor: theme.background, borderColor: theme.track }]}>
              <ThemedText type="t5">{S['item.bizInquiry']}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {S.bizBody}
              </ThemedText>
              <ActionButton
                variant="secondary"
                size="large"
                label={S.bizCta}
                onPress={() => router.push('/my/biz' as never)}
              />
            </View>
          </View>

          {/* 시안 밖 — 로그아웃과 사업자 정보 공시. 시안이 보여주는 것 전부의 아래에 둔다. */}
          <View style={styles.footerArea}>
            {isSignedIn && (
              <Pressable
                accessibilityRole="button"
                style={styles.logout}
                onPress={() => {
                  /* 로그아웃·세션 만료는 항상 WP-AUTH-001로 보낸다(CLAUDE.md v3.11). */
                  void signOut().finally(() => router.replace('/login'));
                }}>
                <ThemedText type="t7" themeColor="textAssistive">
                  {S.logout}
                </ThemedText>
              </Pressable>
            )}
            {/* 사업자 정보(2026-09-08 등록). 값은 @weddingpick/domain BUSINESS 한 곳에서 온다. */}
            <View style={styles.businessNotice}>
              {BUSINESS_NOTICE_LINES.map((line) => (
                <ThemedText key={line} type="t7" themeColor="textAssistive" style={styles.center}>
                  {line}
                </ThemedText>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

/** 섹션 구분 밴드 16 · 위아래 28. 웨딩 설정 박스 뒤와 업체 · 플래너 앞, 두 곳. */
function Band() {
  const theme = useTheme();

  return <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />;
}

/** 메뉴 그룹 — 제목 14/19 700 gray600, 아래 10, 행 사이 2. */
function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.menuGroup}>
      <SectionTitle>{title}</SectionTitle>
      <Rows>{children}</Rows>
    </View>
  );
}

/** 웨딩 설정 요약 행 — 16/22 gray700 ↔ 16/22 700 tabular · 상하 9. */
function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <ThemedText type="t6" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="t6" numeric numberOfLines={1} style={[styles.bold, styles.settingValue]}>
        {value}
      </ThemedText>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  /* 헤더 56 · 왼쪽 24 · 오른쪽 아이콘 버튼 40이 거터선에 앉는다. */
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Layout.gutter,
    paddingRight: Layout.gutter - (Layout.iconButton - Layout.iconTab) / 2,
  },
  headerIcon: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  /* SEED는 400 · 700 둘뿐이다 — 굵기는 이 한 곳에서만 올린다. */
  bold: {
    fontWeight: '700',
  },
  center: {
    textAlign: 'center',
  },

  /* 프로필 — 05-root: padding 12 24 24 · gap 14 · 이름 아래 3 */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  loginCta: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },

  /* 웨딩 설정 박스 — radius 10 · padding 20 · 행 사이 2 · 아래 밴드까지 28 */
  weddingBoxWrap: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
  },
  weddingBox: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.half,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Layout.summaryRowPaddingY,
  },
  settingValue: {
    flexShrink: 1,
  },

  /* 밴드 16 · 아래 28 */
  band: {
    height: Layout.sectionBand,
    marginBottom: Layout.sectionGap,
  },

  /* 메뉴 그룹 — 0 24 28 · 제목 아래 10 */
  menuGroup: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: Layout.cardGap,
  },

  /* 업체 · 플래너 — 08c: 0 24 32 · gap 10 · 박스 1 테두리 · 20 · gap 8 */
  bizSection: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.five,
    gap: Layout.cardGap,
  },
  bizBox: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },

  /* 푸터 — 시안 아래 16 띄우고 로그아웃 · 사업자 정보 */
  footerArea: {
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  logout: {
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },
  businessNotice: {
    width: '100%',
    gap: Spacing.one,
  },
});
