import type { CurrentUser, MyReportListResponse } from '@weddingpick/api-contract';
import { formatWeddingDate, manwon } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  LineHeight,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, listMyReports } from '@/api/client';
import { useSession } from '@/features/auth/use-session';

type MyData = {
  me: CurrentUser | null;
  reports: MyReportListResponse | null;
};

const EMPTY: MyData = { me: null, reports: null };

/**
 * MY 홈 · WP-MY-001.
 *
 * - 비로그인: 프로필 없음 + 로그인 CTA
 * - 로그인: 아바타 + 이름 + Pick 인증 배지 + 웨딩 설정 + 메뉴 그룹
 *
 * 비회원에게 개인화 영역(이름 · 웨딩 정보)을 보이지 않는다.
 */
export default function MyScreen() {
  const theme = useTheme();
  const { state } = useSession();
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
        const [reports] = await Promise.allSettled([listMyReports()]);
        setData((prev) => ({
          ...prev,
          reports: reports.status === 'fulfilled' ? reports.value : null,
        }));
      })
      .catch(() => setData(EMPTY));
  }, [isSignedIn]);

  useEffect(load, [load]);

  /** 비로그인이면 로그인 화면으로 보낸다. */
  function guestPush(path: string) {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    router.push(path as never);
  }

  const me = data.me;
  const initial = me?.displayName?.slice(0, 1) ?? '나';
  const totalReports = data.reports?.reports.length ?? 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText type="t4">MY</ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* 프로필 행 */}
          <View style={[styles.profileRow, { borderBottomColor: theme.border }]}>
            {/* 아바타 */}
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="t4" themeColor="textSecondary">
                {isSignedIn ? initial : '?'}
              </ThemedText>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <ThemedText type="t5">
                  {isSignedIn && me?.displayName ? `${me.displayName}님` : '비회원'}
                </ThemedText>
                {isSignedIn && me?.hasPaymentProof && (
                  <View
                    style={[
                      styles.verifiedBadge,
                      { backgroundColor: theme.positiveBackground },
                    ]}>
                    <ThemedText
                      type="badge"
                      style={{ color: theme.positive }}>
                      Pick 인증 완료
                    </ThemedText>
                  </View>
                )}
              </View>
              {isSignedIn && me?.tierLabel && (
                <ThemedText type="t7" themeColor="textAssistive">
                  {me.tierLabel}
                </ThemedText>
              )}
            </View>

            {isSignedIn && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="프로필 편집"
                hitSlop={Spacing.two}
                onPress={() => router.push('/my/account' as never)}>
                <ChevronRight color={theme.textAssistive} />
              </Pressable>
            )}
          </View>

          {/* 웨딩 설정 박스 — 로그인 + 온보딩 완료 시 */}
          {isSignedIn && me?.setupComplete && (
            <Pressable
              accessibilityRole="button"
              style={[styles.weddingBox, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push('/setup' as never)}>
              <View style={styles.weddingBoxInner}>
                {me.weddingDate && (
                  <SettingRow label="예식일" value={formatWeddingDate(me.weddingDate)} />
                )}
                {me.region && (
                  <SettingRow label="지역" value={me.region} />
                )}
                {me.budgetAmount && (
                  <SettingRow label="총예산" value={manwon(me.budgetAmount)} />
                )}
              </View>
              <ChevronRight color={theme.textAssistive} />
            </Pressable>
          )}

          {/* ── 메뉴 그룹 ── */}

          {/* Pick 인증 */}
          <MenuGroup title="Pick 인증">
            <MenuItem
              label="내 제보 내역"
              value={totalReports > 0 ? `${totalReports}건` : undefined}
              onPress={() => guestPush('/my/reports')}
            />
            <MenuItem
              label="Pick 인증하기"
              onPress={() => guestPush('/capture/payment/consent')}
              last
            />
          </MenuGroup>

          {/* 혜택 */}
          <MenuGroup title="혜택">
            <MenuItem
              label="웨딩픽 혜택"
              onPress={() => guestPush('/my/rewards')}
            />
            <MenuItem
              label="친구 초대"
              onPress={() => guestPush('/my/referral')}
              last
            />
          </MenuGroup>

          {/* 설정 */}
          <MenuGroup title="설정">
            <MenuItem
              label="알림 설정"
              onPress={() => guestPush('/my/notification-settings')}
            />
            <MenuItem
              label="계정 설정"
              onPress={() => guestPush('/my/account')}
            />
            <MenuItem
              label="서비스 안내"
              onPress={() => router.push('/my/guide' as never)}
            />
            <MenuItem
              label="약관 · 방침"
              onPress={() => router.push('/my/policies' as never)}
              last
            />
          </MenuGroup>

          {/* 업체 · 플래너 문의 */}
          <View
            style={[
              styles.bizBox,
              { borderColor: theme.border },
            ]}>
            <View style={styles.bizContent}>
              <ThemedText type="t6" style={styles.bizTitle}>
                업체·플래너 문의
              </ThemedText>
              <ThemedText type="t7" themeColor="textAssistive" style={styles.bizBody}>
                정보 수정 · 반론 · 사진 제공 · 혜택 등록 · 광고 제휴를 여기서 접수해요
              </ThemedText>
            </View>
            <ActionButton
              variant="ghost"
              label="문의하기"
              onPress={() => router.push('/my/biz' as never)}
            />
          </View>

          {/* 로그아웃 / 로그인 CTA */}
          <View style={styles.footerArea}>
            {isSignedIn ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/my/logout' as never)}>
                <ThemedText type="t6" themeColor="textAssistive">
                  로그아웃
                </ThemedText>
              </Pressable>
            ) : (
              <View style={styles.loginCta}>
                <ActionButton
                  variant="primary"
                  label="로그인 · 가입하기"
                  onPress={() => router.push('/login')}
                />
                <ThemedText type="t7" themeColor="textAssistive" style={styles.loginHint}>
                  우리웨딩과 Pick 인증에 필요해요
                </ThemedText>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.menuGroup}>
      <View style={[styles.menuBand, { backgroundColor: theme.backgroundSelected }]} />
      <View style={styles.menuGroupContent}>
        <ThemedText type="t7" themeColor="textAssistive" style={styles.menuGroupTitle}>
          {title}
        </ThemedText>
        {children}
      </View>
    </View>
  );
}

function MenuItem({
  label,
  value,
  onPress,
  last = false,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useTheme();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={styles.menuItem}
        onPress={onPress}>
        <ThemedText type="t6" style={styles.menuItemLabel}>
          {label}
        </ThemedText>
        <View style={styles.menuItemRight}>
          {value !== undefined && (
            <ThemedText type="t6" themeColor="textAssistive">
              {value}
            </ThemedText>
          )}
          <ChevronRight color={theme.textAssistive} />
        </View>
      </Pressable>
      {!last && (
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
      )}
    </>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <ThemedText type="t7" themeColor="textAssistive" style={styles.settingLabel}>
        {label}
      </ThemedText>
      <ThemedText type="t6" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function ChevronRight({ color }: { color: string }) {
  return (
    <View
      style={[
        styles.chevron,
        { borderColor: color },
      ]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: Layout.navBar,
    justifyContent: 'center',
    paddingHorizontal: Layout.gutter,
    borderBottomWidth: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },

  /* 프로필 */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },

  /* 웨딩 설정 박스 */
  weddingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Layout.gutter,
    marginTop: Spacing.three,
    borderRadius: Radius.medium,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  weddingBoxInner: {
    flex: 1,
    gap: Spacing.two,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  settingLabel: {
    width: 52,
    flexShrink: 0,
  },

  /* 메뉴 그룹 */
  menuGroup: {
    marginTop: Layout.sectionGap,
  },
  menuBand: {
    height: Layout.sectionBand,
  },
  menuGroupContent: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
  },
  menuGroupTitle: {
    marginBottom: Spacing.two,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
  },
  menuItemLabel: {
    flex: 1,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    height: 1,
  },

  /* 업체·플래너 */
  bizBox: {
    marginHorizontal: Layout.gutter,
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Layout.gutter,
    gap: Spacing.three,
  },
  bizContent: {
    gap: Spacing.one,
  },
  bizTitle: {
    fontWeight: '700',
  },
  bizBody: {
    lineHeight: LineHeight.t7,
  },

  /* 푸터 */
  footerArea: {
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
  },
  loginCta: {
    width: '100%',
    gap: Spacing.two,
    alignItems: 'center',
  },
  loginHint: {
    textAlign: 'center',
  },

  /* 쉐브론 */
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
});
