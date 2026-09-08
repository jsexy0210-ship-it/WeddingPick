import type { CurrentUser, MyReportListResponse } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_FIELD_LABEL,
  BUDGET_BRACKET_LABEL,
  BUSINESS_NOTICE_LINES,
  formatDateDot,
  PREPARED_CATEGORIES_LABEL,
  summarizePreparedCategories,
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
import { getCurrentUser, getWeddingInvite, listMyReports } from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import { APP_VERSION } from '@/features/settings/version';

/** 배우자 연결 상태 — CLAUDE.md §8 «커플: 미연결 · 초대 대기 · 연결됨». */
type CoupleState = 'unlinked' | 'invited' | 'linked';

type MyData = {
  me: CurrentUser | null;
  reports: MyReportListResponse | null;
  couple: CoupleState | null;
};

const EMPTY: MyData = { me: null, reports: null, couple: null };

/** `spec/strings.ko.json` `my.*`의 확정 카피. */
const S = {
  title: 'MY',
  verifiedBadge: 'Pick 인증 완료',
  'group.activity': '내 활동',
  'group.wedding': '웨딩 설정',
  'group.account': '계정',
  'group.biz': '업체 · 플래너',
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
  /*
   * 시안(08c 18c)은 «광고 제휴»까지 적지만, 광고 제휴 기능은 2026-09-05 정책으로
   * 삭제됐다(CLAUDE.md) — 접수 창구에서도 뺀다.
   */
  bizBody: '정보 수정 · 반론 · 사진 제공 · 혜택 등록을 여기서 접수해요.',
  bizCta: '문의하기',
  'setting.date': '예식일',
  'setting.region': '지역',
  /*
   * v3.19가 «총예산»을 «준비 예산»으로 바꿨다(앞으로 준비에 쓸 예산) — 라벨은
   * domain BUDGET_BRACKET_FIELD_LABEL 한 곳에서 온다. 준비 현황(v3.22)도 같다.
   */
  'setting.budget': BUDGET_BRACKET_FIELD_LABEL,
  'setting.prepared': PREPARED_CATEGORIES_LABEL,
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
 * MY 홈 · WP-MY-001. 디자인 핸드오프 v3.16 `08c-schedule-my.dc.html` 18c.
 *
 * 프로필 → 웨딩 설정 → 밴드 → 메뉴 3그룹(내 활동 · 웨딩 설정 · 계정) → 밴드 →
 * 업체 · 플래너 문의. 그 아래는 시안에 없지만 남겨야 하는 것 — 로그아웃과 사업자
 * 정보 공시(법정 표시).
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
        const [reports, invite] = await Promise.allSettled([
          listMyReports(),
          /* 연결 전이면 살아 있는 초대가 있는지 본다 — «초대 대기»는 그때만이다. */
          me.spouseLinked || !me.weddingId
            ? Promise.resolve(null)
            : getWeddingInvite(me.weddingId),
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
  const totalReports = reports.length;
  const totalReviews = reports.filter((report) => report.kind === 'review').length;
  /*
   * 설정을 한 번이라도 마쳤으면 박스를 둔다 — v3.19부터 예식일 · 지역 · 예산이 전부
   * «미정»일 수 있어 값의 유무로는 알 수 없다. 그때도 준비 현황 한 줄은 있다.
   */
  const hasWeddingSetting = Boolean(
    me?.setupComplete || me?.weddingDate || me?.region || me?.budgetBracket
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 헤더 — 08c 18c는 오른쪽 아이콘이 없다. 아래 선도 없다. */}
        <View style={styles.header}>
          <ThemedText type="t4">{S.title}</ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* 프로필 행 */}
          {isSignedIn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="계정"
              style={styles.profileRow}
              onPress={() => router.push('/my/account' as never)}>
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="t4" themeColor="textAssistive">
                  {initial}
                </ThemedText>
              </View>

              <View style={styles.profileInfo}>
                <ThemedText type="t3" numberOfLines={1}>
                  {me?.displayName ? `${me.displayName}님` : '이름을 정해주세요'}
                </ThemedText>
                {me?.hasPaymentProof && (
                  <View style={[styles.verifiedBadge, { backgroundColor: theme.positiveBackground }]}>
                    <ThemedText type="t7" style={[styles.bold, { color: theme.positive }]}>
                      {S.verifiedBadge}
                    </ThemedText>
                  </View>
                )}
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

          {/* 웨딩 설정 박스 — 누르는 곳이 아니다. 바꾸기는 아래 «내 웨딩 설정»이 한다. */}
          {isSignedIn && hasWeddingSetting && (
            <View style={styles.weddingBoxWrap}>
              <View style={[styles.weddingBox, { backgroundColor: theme.backgroundElement }]}>
                {me?.weddingDate && (
                  <SettingRow label={S['setting.date']} value={formatDateDot(me.weddingDate)} />
                )}
                {me?.region && <SettingRow label={S['setting.region']} value={me.region} />}
                {/* 준비 현황(온보딩 3/5) — «웨딩홀 외 2곳». 하나도 없으면 «아직 시작 전이에요». */}
                {me && (
                  <SettingRow
                    label={S['setting.prepared']}
                    value={summarizePreparedCategories(me.preparedCategories)}
                  />
                )}
                {me?.budgetBracket && (
                  <SettingRow label={S['setting.budget']} value={BUDGET_BRACKET_LABEL[me.budgetBracket]} />
                )}
              </View>
            </View>
          )}

          <Band />

          {/* 내 활동 */}
          <MenuGroup title={S['group.activity']}>
            <MenuItem
              label={S['item.reportLog']}
              value={totalReports > 0 ? `${totalReports}건` : undefined}
              onPress={() => guestPush('/my/reports')}
            />
            {/* 내 후기만 모아 보는 화면은 아직 없다 — 제보 내역이 후기도 같이 보여준다. */}
            <MenuItem
              label={S['item.myReview']}
              value={totalReviews > 0 ? `${totalReviews}건` : undefined}
              onPress={() => guestPush('/my/reports')}
            />
            <MenuItem label={S['item.benefit']} onPress={() => guestPush('/my/rewards')} />
          </MenuGroup>

          {/* 웨딩 설정 */}
          <MenuGroup title={S['group.wedding']}>
            <MenuItem label={S['item.weddingSetting']} onPress={() => guestPush('/setup')} />
            <MenuItem label={S['item.taste']} onPress={() => guestPush('/my/taste')} />
            <MenuItem
              label={S['item.partner']}
              value={data.couple ? COUPLE_LABEL[data.couple] : undefined}
              onPress={() => guestPush('/wedding/partner')}
            />
            <MenuItem label={S['item.notification']} onPress={() => guestPush('/my/notification-settings')} />
            {/* 화면(스킨) 설정 화면은 아직 없다 — 설정으로 보낸다. */}
            <MenuItem label={S['item.display']} onPress={() => guestPush('/my/settings')} />
          </MenuGroup>

          {/* 계정 */}
          <MenuGroup title={S['group.account']}>
            <MenuItem label={S['item.account']} onPress={() => guestPush('/my/account')} />
            <MenuItem label={S['item.support']} onPress={() => guestPush('/my/contact')} />
            {/* 이용약관 · 개인정보처리방침이 이 화면(약관 및 정책)에 있다. */}
            <MenuItem
              label={S['item.serviceInfo']}
              value={`v${APP_VERSION}`}
              onPress={() => router.push('/my/policies' as never)}
            />
          </MenuGroup>

          <Band />

          {/* 업체 · 플래너 문의 — 사용자용 메뉴와 구분한다. */}
          <View style={styles.bizSection}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
              {S['group.biz']}
            </ThemedText>
            <View
              style={[
                styles.bizBox,
                { backgroundColor: theme.background, borderColor: theme.track },
              ]}>
              <ThemedText type="t5">{S['item.bizInquiry']}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {S.bizBody}
              </ThemedText>
              <View style={styles.bizCta}>
                <ActionButton
                  variant="ghost"
                  size="large"
                  label={S.bizCta}
                  onPress={() => router.push('/my/biz' as never)}
                />
              </View>
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
            {/*
              사업자 정보(2026-09-08 등록). 값은 @weddingpick/domain BUSINESS 한 곳에서
              온다 — 웹 푸터·약관·처리방침과 같은 줄이다.
            */}
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

/** 섹션 구분 밴드. 08c는 웨딩 설정 박스 뒤와 업체 · 플래너 앞, 두 곳에만 둔다. */
function Band() {
  const theme = useTheme();

  return <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />;
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.menuGroup}>
      <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
        {title}
      </ThemedText>
      <View style={styles.menuItems}>{children}</View>
    </View>
  );
}

function MenuItem({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <Pressable accessibilityRole="button" style={styles.menuItem} onPress={onPress}>
        <ThemedText type="t5" numberOfLines={1} style={styles.menuItemLabel}>
          {label}
        </ThemedText>
        {value !== undefined && (
          <ThemedText type="t6" themeColor="textAssistive" numeric numberOfLines={1}>
            {value}
          </ThemedText>
        )}
        <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
      </Pressable>
      {/* 08c는 마지막 항목 아래에도 선을 둔다. */}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </View>
  );
}

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
  header: {
    height: Layout.navBar,
    justifyContent: 'center',
    paddingHorizontal: Layout.gutter,
  },
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

  /* 프로필 — 08c: padding 12 24 24 · gap 14 */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
  },
  /* 시안 아바타 56. 아바타 토큰이 없어 같은 값의 행 최소 높이를 빌려 쓴다. */
  avatar: {
    width: Layout.rowMinHeight,
    height: Layout.rowMinHeight,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  loginCta: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },

  /* 웨딩 설정 박스 — 08c statBox: radius 10 · padding 20 */
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

  /* 밴드 — 16 · 아래 28 */
  band: {
    height: Layout.sectionBand,
    marginBottom: Layout.sectionGap,
  },

  /* 메뉴 그룹 — 08c: padding 0 24 28 · gap 8 · 항목 사이 2 */
  menuGroup: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },
  menuItems: {
    gap: Spacing.half,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.cardGap,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  /* 항목명은 18/24 regular — t5는 bold라 굵기만 내린다. */
  menuItemLabel: {
    flex: 1,
    minWidth: 0,
    fontWeight: '400',
  },
  divider: {
    height: 1,
  },

  /* 업체 · 플래너 — 08c: padding 0 24 32 · gap 10 · 박스 border 1 · padding 20 · gap 8 */
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
  bizCta: {
    marginTop: Spacing.half,
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
