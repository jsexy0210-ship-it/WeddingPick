/**
 * MY — WP-MY-001 · `docs/design/html/대메뉴_MY.dc.html` 1.
 *
 * 제목 «MY»(26/700) → 프로필 카드(아바타 + 이름 + Pick 인증 배지 + 예식일 · D-day → 프로필,
 * 선, «내 웨딩설정» 행) → 섹션 다섯(작은 제목 + 테두리 카드 안에 아이콘 18 · 라벨 15 · 꼬리 ·
 * 꺾쇠 16 행) → «앱 버전» 한 줄 → 사업자 정보(법정 공시).
 *
 * **설정 섹션이 없다**(시안 1 「설정 섹션을 없애고 프로필 카드를 눌러 들어가게 합니다」).
 * 알림 · 화면 · 계정 · 로그아웃 · 탈퇴는 프로필(`my/profile.tsx`)이 맡는다.
 *
 * **메뉴 4글자는 붙여 쓴다** — 연결관리 · 인증내역 · 웨딩설정(새 패키지 · 전체 공통).
 * 루트 메뉴는 정본의 내 활동 / 함께 준비하기 / 라운지 / 고객지원 / 약관만 둔다.
 * 정본 WP-MY-001의 내 활동은 Pick 인증내역과 내가 쓴 후기 두 줄이다.
 *
 * 모양은 시안, 수치는 `spec/tokens.json`(카드 radius 10 · 행 56 · 아바타 56 ·
 * 아이콘 18 · 좌우 24). 문구는 `spec/strings.ko.json` `my`.
 */
import { FullScreenError } from '@/features/errors/full-screen-error';
import type { CurrentUser, MyReportListResponse } from '@weddingpick/api-contract';
import { BUSINESS_NOTICE_LINES, POLICY_DOCUMENTS, daysUntil, formatCount } from '@weddingpick/domain';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Badge,
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
  getWeddingInvite,
  listMyInquiries,
  listMyReports,
} from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import { DelayedLoader, DelayedLoadingView } from '@/features/loading/delayed-loader';
import { Avatar } from '@/features/settings/my-kit';
import strings from '../../../../../../spec/strings.ko.json';
import { APP_VERSION } from '@/features/settings/version';
import { openExternal } from '@/features/open-external';

const S = strings.my;

function openPolicy(id: 'terms' | 'privacy') {
  const policy = POLICY_DOCUMENTS.find((document) => document.id === id);
  if (policy?.url) void openExternal(policy.url, { title: policy.title });
}

type CoupleState = 'unlinked' | 'invited' | 'linked';

type MyData = {
  me: CurrentUser | null;
  reports: MyReportListResponse | null;
  couple: CoupleState | null;
  inquiries: number | null;
};

const EMPTY: MyData = { me: null, reports: null, couple: null, inquiries: null };

const COUPLE_LABEL: Record<CoupleState, string> = {
  unlinked: S['couple.unlinked'],
  invited: S['couple.invited'],
  linked: S['couple.linked'],
};

type MenuRow = {
  key: string;
  label: string;
  icon: ProductSymbolName;
  /** 오른쪽 꼬리. 시안 `myCount`(14/700 코랄 tabular) 자리. */
  tail?: string;
  onPress: () => void;
};

export default function MyScreen() {
  const theme = useTheme();
  const { state, refresh } = useSession();
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
        const [reports, invite, inquiries] = await Promise.allSettled([
          listMyReports(),
          me.spouseLinked || !me.weddingId
            ? Promise.resolve(null)
            : getWeddingInvite(me.weddingId),
          listMyInquiries(),
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
          inquiries: inquiries.status === 'fulfilled' ? inquiries.value.inquiries.length : null,
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
  /* 인증내역의 꼬리는 Pick 인증 건수다 — 후기는 «내가 쓴 후기»가 센다. */
  const totalProofs = reports.filter((report) => report.kind !== 'review').length;
  const totalReviews = reports.filter((report) => report.kind === 'review').length;

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  const count = (n: number) => (n > 0 ? S.count.replace('{n}', formatCount(n)) : undefined);

  /* 순서와 묶음은 시안 `mySections` 그대로다. 남긴 줄 · 뺀 줄의 사유는 파일 머리에 있다. */
  const sections: { title: string; rows: MenuRow[] }[] = [
    {
      title: S['group.activity'],
      rows: [
        { key: 'certLog', label: S['item.certLog'], icon: 'checkCircle', tail: count(totalProofs), onPress: () => guestPush('/my/reports') },
        { key: 'myReview', label: S['item.myReview'], icon: 'edit', tail: count(totalReviews), onPress: () => guestPush('/my/reviews') },
      ],
    },
    {
      title: S['group.together'],
      rows: [
        { key: 'partner', label: S['item.partner'], icon: 'twoPeople', tail: data.couple ? COUPLE_LABEL[data.couple] : undefined, onPress: () => guestPush('/wedding/partner') },
      ],
    },
    /*
     * **라운지로 들어오는 두 자리 중 하나다.** 2026-09-17 대표 지시로 라운지가 Root 탭에서
     * 내려왔다 — 화면을 없앤 것이 아니라 진입을 옮긴 것이므로 **이 줄이 없으면 라운지에
     * 들어갈 길이 사라진다.** 나머지 한 자리는 홈 「웨딩 소식」 섹션 우측이다. 주소는
     * `/community` 그대로다(저장된 링크 · 공유 주소).
     *
     * **v3.28에서 한 줄이 세 줄이 됐다**(시안 1 `mySections` — 「라운지」 섹션에
     * 리얼후기 · 웨딩정보 · 박람회). 라운지는 한 화면 세 탭이므로 각 줄이 그 탭으로
     * 바로 들어간다 — 들어가서 탭을 한 번 더 고르게 하지 않는다.
     */
    {
      title: S['group.lounge'],
      rows: [
        { key: 'realReview', label: S['item.realReview'], icon: 'edit', onPress: () => guestPush('/community?from=my&tab=review') },
        { key: 'weddingInfo', label: S['item.weddingInfo'], icon: 'file', onPress: () => guestPush('/community?from=my&tab=feed') },
        { key: 'expo', label: S['item.expo'], icon: 'calendar', onPress: () => guestPush('/community?from=my&tab=expo') },
      ],
    },
    /*
     * **「FAQ」는 아직 바꾸지 않았다 — 판단 필요.** v3.28 대조표는 「자주 묻는 질문 → FAQ」
     * (시안 12 WP-MY-013의 헤더도 «FAQ»)인데, 2026-09-15 대표 지시 「사용자 화면에 영문을
     * 쓰지 않는다 · 남는 것은 Pick · Npay 둘뿐」과 부딪힌다. 둘 중 어느 쪽이 이기는지는
     * 대표님·MASTER가 정한다 — 그때 `spec/strings.ko.json` `my.item.faq` 한 칸만 바꾸면 된다.
     */
    {
      title: S['group.support'],
      rows: [
        { key: 'faq', label: S['item.faq'], icon: 'info', onPress: () => router.push({ pathname: '/my/guide', params: { mode: 'faq' } } as never) },
        { key: 'contact', label: S['item.contact'], icon: 'headset', tail: data.inquiries !== null ? count(data.inquiries) : undefined, onPress: () => guestPush('/my/contact') },
      ],
    },
    {
      title: S['group.terms'],
      rows: [
        { key: 'terms', label: S['item.terms'], icon: 'file', onPress: () => openPolicy('terms') },
        { key: 'privacy', label: S['item.privacy'], icon: 'file', onPress: () => openPolicy('privacy') },
      ],
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="f26" style={[styles.bold, styles.title]}>
            {S.title}
          </ThemedText>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 프로필 카드 — 아바타 + 이름 18/700 + Pick 인증 배지 + 예식일 · D-day 13 muted + 꺾쇠 → 프로필. 선. «내 웨딩설정» 행. */}
          {isSignedIn && me ? (
            <View style={styles.block}>
              <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.track }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="프로필"
                  onPress={() => router.push('/my/profile' as never)}
                  style={({ pressed }) => [styles.profile, pressed ? styles.pressed : null]}>
                  <Avatar initial={me.displayName?.slice(0, 1) ?? '나'} size={Layout.avatarProfile} />
                  <View style={styles.profileCol}>
                    <View style={styles.profileNameRow}>
                      <ThemedText type="f18" numberOfLines={1} style={[styles.bold, styles.shrink]}>
                        {me.displayName ? me.displayName : S.nameless}
                      </ThemedText>
                      {/* 상태를 먼저 보여준다 — Pick 인증 회원만 배지가 붙는다. */}
                      {me.hasPaymentProof ? <Badge kind="ok">{S.verifiedBadge}</Badge> : null}
                    </View>
                    <ThemedText type="f13" themeColor="textAssistive" numeric numberOfLines={1}>
                      {me.weddingDate ? weddingLine(me.weddingDate) : S.weddingDateUnset}
                    </ThemedText>
                  </View>
                  <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} />
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
                  <ThemedText type="f15" style={styles.grow}>
                    {S['item.weddingSetting']}
                  </ThemedText>
                  <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} />
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

          {/* 섹션 — 제목 13/700 muted + 테두리 카드(radius 10), 행 56 · 안쪽 16 · gap 12. */}
          {sections.map((section) => (
            <View key={section.title} style={styles.block}>
              <ThemedText type="f13" themeColor="textAssistive" style={[styles.bold, styles.sectionTitle]}>
                {section.title}
              </ThemedText>
              <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.track }]}>
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
                    <ProductSymbol name={row.icon} size={Layout.iconInline} color={theme.textAssistive} />
                    <ThemedText type="f15" numberOfLines={1} style={styles.grow}>
                      {row.label}
                    </ThemedText>
                    {row.tail ? (
                      <ThemedText type="f14" themeColor="tint" numeric style={styles.bold}>
                        {row.tail}
                      </ThemedText>
                    ) : null}
                    <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* 시안 secFoot: «앱 버전 1.0.0» 13 muted 가운데. 로그아웃 · 탈퇴는 프로필에 있다. */}
          <View style={styles.footer}>
            <ThemedText type="f13" themeColor="textAssistive" numeric style={styles.center}>
              {S.appVersion.replace('{version}', APP_VERSION)}
            </ThemedText>
            {/* 사업자 정보 — 2026-09-08 등록 · 법정 공시라 시안에 없어도 둔다. */}
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

/** «2027.05.16(토) · 250일 남았어요» — 시안 `profSub`. 저장값은 `YYYY-MM-DD`다. */
function weddingLine(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  const dot = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}(${WEEKDAY[date.getDay()]})`;
  const days = daysUntil(iso);
  const dday =
    days > 0
      ? S['dday.upcoming'].replace('{n}', formatCount(days))
      : days === 0
        ? S['dday.today']
        : S['dday.past'].replace('{n}', formatCount(-days));
  return S.weddingDate.replace('{date}', dot).replace('{dday}', dday);
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const;

// ─── Styles — 모양은 대메뉴_MY.dc.html 1, 수치는 spec/tokens.json ───

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
  scrollContent: { paddingTop: Spacing.three, paddingBottom: Spacing.four },
  bold: { fontWeight: 700 },
  /* `micro`는 기본이 700 — 시안에서 regular인 작은 글자는 400. */
  regular: { fontWeight: 400 },
  /* «MY» 26/700 · ls -0.65px(규격서). */
  title: { letterSpacing: LetterSpacing.n065 },
  center: { textAlign: 'center' },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },

  /* Root 바깥 여백은 공통 24px. */
  header: {
    height: Layout.navBar,
    justifyContent: 'center',
    paddingHorizontal: Layout.gutter,
  },
  /* WP-MY-001 sec: 공통 좌우 24 · 아래 20 · 제목↔카드 12. */
  block: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
  },
  loginCta: { gap: Spacing.two },
  /* profCard · listCard: radius 10 · 1 테두리(handoff card.defaultBorder) · overflow hidden. */
  card: {
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    overflow: 'hidden',
  },
  /* profTop `gap:14px;padding:18px`. */
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
    padding: Layout.cardPaddingCompactY,
  },
  profileCol: { flex: 1, minWidth: 0, gap: Spacing.one },
  /* WP-MY-001 profNameRow: 이름과 배지 사이 7. */
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  /* WP-MY-001 profRow: gap 12 · 최소 높이 52 · 좌우 18. */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 52,
    borderTopWidth: Border.hairline,
    paddingHorizontal: Layout.cardPaddingCompactY,
  },
  /* secLabel 13/700 muted. */
  sectionTitle: { marginBottom: Layout.inlineGap },
  /* WP-MY-001 메뉴 행: gap 12 · 최소 높이 52 · 좌우 16. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  /* WP-MY-001 secFoot: 위 4 · 공통 좌우 24 · gap 14. */
  footer: {
    paddingTop: Spacing.one,
    paddingHorizontal: Layout.gutter,
    alignItems: 'center',
    gap: 14,
  },
  businessNotice: { gap: Spacing.half, opacity: 0.5 },
});
