/**
 * MY — WP-MY-001.
 *
 * 피그마 `My.tsx`(2026-09-14 정본 · 최상위 규칙 1)대로 그린다. 제목 «MY»(26/700) → 프로필
 * 카드(이름 · 결혼 예정일 · «내 웨딩 설정» 행) → 섹션(작은 제목 + radius 22 테두리 카드 안에
 * 아이콘 16 · 라벨 14 · 꼬리 · 꺾쇠 16 행) → 앱 버전 카드 → 로그아웃 → 한 줄 표어.
 *
 * 메뉴 항목은 우리 것 그대로다 — 서버에 있는 화면만 세운다. 피그마의 «저장한 웨딩 콘텐츠» ·
 * «개인정보 보호» · «신고 내역» · «업체 반론»은 그 화면이 없어 만들지 않았고, 피그마에 없는
 * «제보» · «혜택 · 이벤트» · «스타일 다시 고르기» · «화면 설정» · «업체 · 플래너 문의»는 가장
 * 가까운 섹션에 남긴다. 알림 설정은 피그마의 토글 하나가 아니라 여러 토글이 있는 화면이라
 * 꺾쇠 행이다. 헤더의 톱니(설정)는 피그마에 없어 뺐다 — 설정 섹션의 행이 그 자리를 맡는다.
 * 사업자 정보 공시는 법이 정한 것이라 맨 아래 그대로 둔다.
 */
import { FullScreenError } from '@/features/errors/full-screen-error';
import type { CurrentUser, MyReportListResponse } from '@weddingpick/api-contract';
import { BUSINESS_NOTICE_LINES, formatCount, TERMS } from '@weddingpick/domain';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Border,
  Layout,
  MaxContentWidth,
  LetterSpacing,
  ProductSymbol,
  type ProductSymbolName,
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
import { DelayedLoader, DelayedLoadingView } from '@/features/loading/delayed-loader';
import strings from '../../../../../../spec/strings.ko.json';
import { APP_VERSION } from '@/features/settings/version';

type CoupleState = 'unlinked' | 'invited' | 'linked';

type MyData = {
  me: CurrentUser | null;
  reports: MyReportListResponse | null;
  couple: CoupleState | null;
  benefits: number | null;
};

const EMPTY: MyData = { me: null, reports: null, couple: null, benefits: null };

/* 문구 — spec/strings.ko.json `my`. 섹션 이름은 피그마 `My.tsx`에서 왔다. */
const S = {
  title: 'MY',
  nameless: '이름을 정해주세요',
  weddingDate: (date: string) => `${date} 결혼 예정`,
  weddingDateUnset: '예식일을 아직 정하지 않았어요',
  'group.activity': '내 활동',
  'group.together': '함께 준비하기',
  'group.settings': '설정',
  'group.support': '고객지원',
  'group.service': '서비스',
  'item.report': '제보',
  'item.reportLog': '내 제보 내역',
  'item.myReview': '내가 쓴 후기',
  'item.benefit': '혜택 · 이벤트',
  'item.weddingSetting': '내 웨딩 설정',
  'item.taste': '스타일 다시 고르기',
  'item.progress': '준비 현황',
  'item.partner': '연결 관리',
  'item.notification': '알림 설정',
  'item.display': '화면 설정',
  'item.account': '계정 설정',
  'item.support': '문의하기',
  'item.bizInquiry': '업체 · 플래너 문의',
  'item.terms': '이용약관',
  'item.privacy': '개인정보처리방침',
  appVersion: '앱 버전',
  count: (n: number) => `${formatCount(n)}건`,
  benefitCount: (n: number) => `${formatCount(n)}개 참여 가능`,
  logout: '로그아웃',
  tagline: '웨딩픽 · 결혼 준비의 시작',
  loginCta: '로그인 · 가입하기',
  loginHint: `${TERMS.ourWedding}와 Pick 인증에 필요해요`,
} as const;

const COUPLE_LABEL: Record<CoupleState, string> = {
  unlinked: '미연결',
  invited: '초대 대기',
  linked: '연결됨',
};

type MenuRow = {
  key: string;
  label: string;
  icon: ProductSymbolName;
  /** 오른쪽 작은 꼬리. 피그마의 `count`(키 컬러 굵은 글자) 자리. */
  tail?: string;
  onPress: () => void;
};

export default function MyScreen() {
  const theme = useTheme();
  const { state, signOut, refresh } = useSession();
  const [data, setData] = useState<MyData>(EMPTY);
  const [loadFailed, setLoadFailed] = useState(false);
  const loadVersion = useRef(0);

  const isSignedIn = state.status === 'signedIn';

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    if (!isSignedIn) {
      void Promise.resolve().then(() => {
        if (version === loadVersion.current) setData(EMPTY);
      });
      return;
    }

    setLoadFailed(false);
    void getCurrentUser()
      .then(async (me) => {
        if (version !== loadVersion.current) return;
        setData((prev) => ({ ...prev, me }));
        const [reports, invite, rewards, draw] = await Promise.allSettled([
          listMyReports(),
          me.spouseLinked || !me.weddingId
            ? Promise.resolve(null)
            : getWeddingInvite(me.weddingId),
          getMyRewards(),
          getMyMonthlyDraw(),
        ]);
        if (version !== loadVersion.current) return;
        const couple: CoupleState | null = me.spouseLinked
          ? 'linked'
          : invite.status === 'rejected'
            ? null
            : invite.value?.invite ? 'invited' : 'unlinked';
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
      .catch(() => { if (version === loadVersion.current) setLoadFailed(true); });
  }, [isSignedIn]);

  useFocusEffect(useCallback(() => {
    load();
    return () => { loadVersion.current += 1; };
  }, [load]));

  function guestPush(path: string) {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    router.push(path as never);
  }

  const me = data.me;
  const reports = data.reports?.reports ?? [];
  const totalReports = reports.filter((report) => report.kind !== 'review').length;
  const totalReviews = reports.filter((report) => report.kind === 'review').length;

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  const sections: { title: string; rows: MenuRow[] }[] = [
    {
      title: S['group.activity'],
      rows: [
        { key: 'report', label: S['item.report'], icon: 'checkCircle', tail: totalReports > 0 ? S.count(totalReports) : undefined, onPress: () => guestPush('/capture') },
        { key: 'reportLog', label: S['item.reportLog'], icon: 'file', onPress: () => guestPush('/my/reports') },
        { key: 'myReview', label: S['item.myReview'], icon: 'edit', tail: totalReviews > 0 ? S.count(totalReviews) : undefined, onPress: () => guestPush('/my/reviews') },
        { key: 'benefit', label: S['item.benefit'], icon: 'gift', tail: data.benefits !== null && data.benefits > 0 ? S.benefitCount(data.benefits) : undefined, onPress: () => guestPush('/my/rewards') },
      ],
    },
    {
      title: S['group.together'],
      rows: [
        { key: 'progress', label: S['item.progress'], icon: 'checkCircle', onPress: () => guestPush('/progress') },
        { key: 'partner', label: S['item.partner'], icon: 'twoPeople', tail: data.couple ? COUPLE_LABEL[data.couple] : undefined, onPress: () => guestPush('/wedding/partner') },
      ],
    },
    {
      title: S['group.settings'],
      rows: [
        { key: 'notification', label: S['item.notification'], icon: 'bell', onPress: () => guestPush('/my/notification-settings') },
        { key: 'taste', label: S['item.taste'], icon: 'checkCircle', onPress: () => guestPush('/my/taste') },
        { key: 'display', label: S['item.display'], icon: 'gear', onPress: () => guestPush('/my/display') },
        { key: 'account', label: S['item.account'], icon: 'lock', onPress: () => guestPush('/my/account') },
      ],
    },
    {
      title: S['group.support'],
      rows: [
        { key: 'support', label: S['item.support'], icon: 'headset', onPress: () => guestPush('/my/support') },
        { key: 'biz', label: S['item.bizInquiry'], icon: 'info', onPress: () => router.push('/my/biz' as never) },
      ],
    },
    {
      title: S['group.service'],
      rows: [
        { key: 'terms', label: S['item.terms'], icon: 'file', onPress: () => router.push('/my/policies' as never) },
        { key: 'privacy', label: S['item.privacy'], icon: 'file', onPress: () => router.push('/my/policies' as never) },
      ],
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 제목 `px-5 pb-5` + 위 24 — 26/700 = t2. */}
          <View style={styles.header}>
            {/* 규격서 my.txt: «MY» 26/700 · lh 39 · ls -0.65px. */}
            <ThemedText type="f26" style={[styles.bold, styles.title]}>
              {S.title}
            </ThemedText>
          </View>

          {/* 프로필 카드 `rounded-[22px] border`: 이름 16/700 · 결혼 예정일 14 · 선 · «내 웨딩 설정» 행. */}
          {isSignedIn && me ? (
            <View style={styles.block}>
              <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="프로필"
                  onPress={() => router.push('/my/profile' as never)}
                  style={({ pressed }) => [styles.profile, pressed ? styles.pressed : null]}>
                  {/* 규격서: 이름 «16/700 · lh 24» · 결혼 예정일 «14/400 #868B94 · lh 20 · mar 2». */}
                  <ThemedText type="f16" numberOfLines={1} style={styles.bold}>
                    {me.displayName ? me.displayName : S.nameless}
                  </ThemedText>
                  <ThemedText type="f14" themeColor="textAssistive" numeric numberOfLines={1} style={styles.profileSub}>
                    {me.weddingDate ? S.weddingDate(koreanDate(me.weddingDate)) : S.weddingDateUnset}
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={S['item.weddingSetting']}
                  onPress={() => guestPush('/my/wedding-settings')}
                  style={({ pressed }) => [
                    styles.profileRow,
                    { borderTopColor: theme.border },
                    pressed ? styles.pressed : null,
                  ]}>
                  {/* 규격서: «14/500 · lh 20». */}
                  <ThemedText type="f14" style={[styles.medium, styles.grow]}>
                    {S['item.weddingSetting']}
                  </ThemedText>
                  <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textAssistive} />
                </Pressable>
              </View>
            </View>
          ) : isSignedIn ? (
            <View style={styles.block}>
              {loadFailed ? (
                <ActionButton label={strings.common['cta.retry']} hint={strings.journey.loadFailed} onPress={load} />
              ) : <DelayedLoader size={28} />}
            </View>
          ) : (
            <View style={[styles.block, styles.loginCta]}>
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

          {/* 섹션 — 제목 `mb-2 px-1`(11/700 · muted) + 카드 `rounded-[22px] border`, 행 `px-4 py-3.5 gap-3`. */}
          {sections.map((section) => (
            <View key={section.title} style={styles.block}>
              {/* 규격서: 섹션 제목 «11/700 #868B94 · lh 17 · ls 1.1px · pad 0 4 · mar 0 0 8». */}
              <ThemedText type="f11" themeColor="textAssistive" style={[styles.bold, styles.sectionTitle]}>
                {section.title}
              </ThemedText>
              <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {section.rows.map((row, index) => (
                  <Pressable
                    key={row.key}
                    accessibilityRole="button"
                    accessibilityLabel={row.label}
                    onPress={row.onPress}
                    style={({ pressed }) => [
                      styles.row,
                      index < section.rows.length - 1
                        ? { borderBottomWidth: Border.hairline, borderBottomColor: theme.border }
                        : null,
                      pressed ? styles.pressed : null,
                    ]}>
                    <ProductSymbol name={row.icon} size={Layout.iconField} color={theme.textAssistive} />
                    {/* 규격서: 행 «14/500 · lh 20» · 꼬리 «12/700 키 컬러 · mar 0 4 0 0». */}
                    <ThemedText type="f14" numberOfLines={1} style={[styles.medium, styles.grow]}>
                      {row.label}
                    </ThemedText>
                    {row.tail ? (
                      <ThemedText type="f12" themeColor="tint" numeric style={[styles.bold, styles.tail]}>
                        {row.tail}
                      </ThemedText>
                    ) : null}
                    <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textAssistive} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* 앱 버전 카드 `mb-2` — «앱 버전» 14 muted · 오른쪽 12 muted. */}
          <View style={styles.versionBlock}>
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.row}>
                {/* 규격서: «앱 버전» 14/400 · 값 12/400. */}
                <ThemedText type="f14" themeColor="textAssistive" style={styles.grow}>
                  {S.appVersion}
                </ThemedText>
                <ThemedText type="f12" themeColor="textAssistive" numeric>
                  {APP_VERSION}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* 로그아웃 — 피그마 «잘 안 보이게»: 가운데 · 12 · muted 60% · 밑줄 · 앞에 나가기 기호 12. */}
          {isSignedIn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={S.logout}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.logout, pressed ? styles.pressed : null]}
              onPress={() => {
                void signOut().finally(() => router.replace('/login'));
              }}>
              <ProductSymbol name="signout" size={Layout.iconMicro} color={theme.textAssistive} />
              {/* 규격서: «로그아웃» 12/500 · 60% · 기호 12 · mar 0 4 0 0. */}
              <ThemedText type="f12" themeColor="textAssistive" style={[styles.medium, styles.underline]}>
                {S.logout}
              </ThemedText>
            </Pressable>
          ) : null}

          {/* 표어 `mt-4 text-center text-[11px] muted/50` + 사업자 정보(2026-09-08 등록 · 법정 공시). */}
          <View style={styles.footer}>
            {/* 규격서: 표어 «11/400 · 50% · lh 17 · mar 16». */}
            <ThemedText type="f11" themeColor="textAssistive" style={styles.center}>
              {S.tagline}
            </ThemedText>
            <View style={styles.businessNotice}>
              {BUSINESS_NOTICE_LINES.map((line) => (
                <ThemedText key={line} type="micro" themeColor="textAssistive" style={[styles.regular, styles.center]}>
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

/** «2027년 1월 15일» — 피그마 프로필 카드의 날짜 꼴. 저장값은 ISO 그대로다. */
function koreanDate(iso: string): string {
  const value = new Date(iso);
  return `${value.getFullYear()}년 ${value.getMonth() + 1}월 ${value.getDate()}일`;
}

// ─── Styles — 값은 피그마 `My.tsx`(2026-09-14 정본) ───────────────────

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
  scroll: { flex: 1 },
  /* 바깥 `pb-12` = 48. */
  scrollContent: { paddingBottom: Spacing.four + Spacing.four },
  bold: { fontWeight: 700 },
  /* `micro`는 기본이 700 — 시안에서 regular인 작은 글자는 400. */
  regular: { fontWeight: 400 },
  /* 규격서의 굵기 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  medium: { fontWeight: 500 },
  /* 규격서 «MY» «ls -0.65px». */
  title: { letterSpacing: LetterSpacing.n065 },
  center: { textAlign: 'center' },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
  underline: { textDecorationLine: 'underline' },

  /* 제목 — 위 24(`h-6` 빈 칸) · 좌우 24 · 아래 20. */
  /* 규격서 「div 430×24」 + 「header 430×59 pad 0 20 20 20」 — 위 24 · 좌우 20 · 아래 20. */
  header: {
    paddingTop: Spacing.four,
    paddingHorizontal: Layout.pageX,
    paddingBottom: Layout.listGap,
  },
  /* 덩어리 `mx-5 mb-6` — 좌우 24 · 아래 24. */
  /* 규격서 「div 390×… mar 0 20 24 20」 — 좌우 20 · 아래 24. */
  block: {
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.four,
  },
  loginCta: { gap: Spacing.two },
  /* 카드 `rounded-[22px] border overflow-hidden`. */
  card: {
    borderRadius: Radius.hero,
    borderWidth: Border.hairline,
    overflow: 'hidden',
  },
  /* 프로필 위 `px-5 py-4`. */
  profile: {
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Spacing.three,
  },
  profileSub: { marginTop: Spacing.half },
  /* «내 웨딩 설정» `border-t px-5 py-3.5 gap-3` — 안쪽 20/14 · 사이 12. */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    borderTopWidth: Border.hairline,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Layout.fieldPaddingX,
  },
  /* 섹션 제목 `mb-2 px-1`. */
  sectionTitle: {
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
    letterSpacing: LetterSpacing.p11,
  },
  /* 행 `px-4 py-3.5 gap-3` — 안쪽 16/14 · 사이 12. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingHorizontal: Spacing.three,
    paddingVertical: Layout.fieldPaddingX,
  },
  /* 꼬리 `mr-1`. */
  tail: { marginRight: Spacing.one },
  /* 앱 버전 카드 `mx-5 mb-2`. */
  versionBlock: {
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.two,
  },
  /* 로그아웃 `mt-3` 가운데 · 기호↔글 4. */
  logout: {
    marginTop: Layout.inlineGap,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: Layout.touchTarget,
    opacity: 0.6,
  },
  /* 표어 `mt-4`. 아래 사업자 정보는 8 띄운다. */
  footer: {
    marginTop: Spacing.three,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.two,
    opacity: 0.5,
  },
  businessNotice: { gap: Spacing.half },
});
