import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  ActionButton,
  Colors,
  MaxContentWidth,
  Radius,
  SocialLogo,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { LoginFailureSheet } from '@/features/auth/login-failure-sheet';
import { OtherLoginSheet } from '@/features/auth/other-login-sheet';
import {
  PROVIDER_CONTINUE_LABEL,
  PROVIDER_LABEL,
  canSignInWith,
  providerTone,
  useAuthProviders,
} from '@/features/auth/providers';
import { loadRememberedAccount, type RememberedAccount } from '@/features/auth/remembered-account';
import { useSignIn } from '@/features/auth/use-sign-in';

/**
 * WP-AUTH-001 "첫 진입" 상태에만 쓴다 — WP-AUTH-003(로그인 유지)엔 없다.
 * 디자인 핸드오프 v3.11(`current/html/01a-login.dc.html`)의 확정 카피 —
 * `spec/strings.ko.json`의 `auth.login.benefit*`과 같은 문장을 유지한다.
 */
const REASONS = [
  '확인된 제보로 실제 금액대를 볼 수 있어요',
  '배우자와 일정과 지출을 같이 봐요',
  '기기를 바꿔도 고른 곳이 그대로 있어요',
];

/**
 * Pick Mark — spec/tokens.json `symbol` 그대로. 배경 박스 없이 이 2개
 * path만 그린다(§2 "시작 화면" 적용처 — 앱 아이콘의 코랄 박스+흰 마크와는
 * 다른 자리). 색은 스킨과 무관한 고정 코랄(`Colors.light.tint`) — 다른
 * 고정 코랄 요소(앱 아이콘·스플래시)와 같은 이유.
 */
const PICK_MARK_VIEWBOX = 24;
const PICK_MARK_STROKE = 1.9;
const PICK_MARK_PATHS = [
  'M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z',
  'M8.7 11.9l2.2 2.2 4.4-4.4',
];

/**
 * WP-AUTH-001/003 로그인. 디자인 핸드오프 v3.11(2026-09-06)의 로그인 정책
 * 전환을 반영한다.
 *
 * 2026-09-04 정책 변경 — 비회원 진입 삭제. 스플래시(온보딩 소개) 다음은
 * 이 화면이고, 로그인해야만 앱으로 넘어간다. `_layout.tsx`의 진입 로직이
 * 비로그인 상태면 항상 이 화면으로 보낸다 — 뒤에 아무것도 없으니 건너뛸 수
 * 없다. 이메일 로그인은 지원하지 않는다(비밀번호 입력·찾기·재설정 화면 없음).
 *
 * **두 상태를 한 컴포넌트에서 가른다**(WP-AUTH-001 첫 진입 / WP-AUTH-003
 * 로그인 유지) — 레이아웃은 다르지만 "카카오(또는 기억된 계정)가 기본,
 * 나머지는 시트로"라는 구조는 같다. `featured`가 기억된 계정이 있으면 그
 * 계정으로, 없으면 카카오로 정해지고 나머지 로직은 그대로 따라간다.
 *
 * "다른 방법으로 시작"은 화면 이동이 아니라 시트다(`other-login-sheet.tsx`).
 * 로그인 실패는 화면에 문구를 깔지 않고 시트로 뜬다(`login-failure-sheet.tsx`,
 * WP-AUTH-004).
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, busy, error, retry, dismissError } = useSignIn();
  const [showOthers, setShowOthers] = useState(false);
  /** undefined = 아직 안 읽음, null = 기억된 계정 없음(WP-AUTH-001). */
  const [remembered, setRemembered] = useState<RememberedAccount | null | undefined>(undefined);

  useEffect(() => {
    loadRememberedAccount().then(setRemembered);
  }, []);

  const rememberedProvider =
    remembered && providers?.find((provider) => provider.provider === remembered.provider);
  const featured = rememberedProvider ?? providers?.find((provider) => provider.provider === 'kakao') ?? providers?.[0] ?? null;
  const others = providers?.filter((provider) => provider !== featured) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* BrandBlock — flex:1. 심볼·카피·혜택. 화면 안에서 남는 세로 공간을 전부 가져간다. */}
          <View style={styles.brandBlock}>
            <Svg width={64} height={64} viewBox={`0 0 ${PICK_MARK_VIEWBOX} ${PICK_MARK_VIEWBOX}`} fill="none">
              {PICK_MARK_PATHS.map((d) => (
                <Path
                  key={d}
                  d={d}
                  stroke={Colors.light.tint}
                  strokeWidth={PICK_MARK_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>

            {rememberedProvider ? (
            <ThemedView style={styles.section}>
              <ThemedText type="t1">
                {remembered?.displayName ? `${remembered.displayName}님,\n` : ''}다시 오셨네요
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.accountRow}>
                <View
                  style={[
                    styles.accountAvatar,
                    { backgroundColor: providerTone(rememberedProvider)?.background ?? theme.backgroundSelected },
                  ]}>
                  {rememberedProvider.isDevelopmentStandIn ? null : (
                    <SocialLogo provider={rememberedProvider.provider} />
                  )}
                </View>
                <View style={styles.accountLabel}>
                  <ThemedText type="t5">
                    {rememberedProvider.isDevelopmentStandIn
                      ? '개발용 로그인'
                      : rememberedProvider.provider === 'kakao'
                        ? '카카오'
                        : rememberedProvider.provider === 'naver'
                          ? '네이버'
                          : rememberedProvider.provider === 'google'
                            ? 'Google'
                            : 'Apple'}
                  </ThemedText>
                </View>
                <ThemedText type="badge" themeColor="tint" style={styles.recentBadge}>
                  최근 로그인
                </ThemedText>
              </ThemedView>
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="t1">
                  웨딩 준비,{'\n'}여기서 같이 해요
                </ThemedText>
                <ThemedText type="t6" themeColor="textSecondary">
                  확인된 제보로 고르고 배우자와 함께 정해요
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.benefitList}>
                {REASONS.map((reason) => (
                  <View key={reason} style={styles.benefitRow}>
                    <View style={[styles.dot, { backgroundColor: theme.tint }]} />
                    <ThemedText type="t6" themeColor="textSecondary" style={styles.benefitText}>
                      {reason}
                    </ThemedText>
                  </View>
                ))}
              </ThemedView>
            </>
          )}
          </View>

          {/* AuthBlock — flex: 0 0 auto. 로그인 버튼·약관·오류. 항상 화면
              하단에 자기 높이만큼만 차지한다. */}
          <View style={styles.authBlock}>
          {providers === null || remembered === undefined ? (
            <ActivityIndicator color={theme.tint} />
          ) : providers.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                지금은 로그인할 수 없어요. 잠시 후 다시 시도해주세요.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.section}>
              {featured ? (
                <ActionButton
                  key={featured.provider}
                  variant="primary"
                  size="xlarge"
                  tone={providerTone(featured)}
                  icon={featured.isDevelopmentStandIn ? undefined : <SocialLogo provider={featured.provider} />}
                  label={
                    featured.isDevelopmentStandIn
                      ? '개발용 로그인'
                      : rememberedProvider
                        ? PROVIDER_CONTINUE_LABEL[featured.provider]
                        : PROVIDER_LABEL[featured.provider]
                  }
                  hint={
                    featured.isDevelopmentStandIn
                      ? '실제 애플·카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                      : undefined
                  }
                  disabled={busy || !canSignInWith(featured)}
                  onPress={() => signIn(featured)}
                />
              ) : null}

              {others.length > 0 ? (
                <ActionButton
                  variant="secondary"
                  size="xlarge"
                  label={rememberedProvider ? '다른 계정으로 시작하기' : '다른 방법으로 시작하기'}
                  disabled={busy}
                  onPress={() => setShowOthers(true)}
                />
              ) : null}

              {!rememberedProvider ? (
                <ThemedText type="small" themeColor="textAssistive" style={styles.terms}>
                  시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textAssistive" style={styles.terms}>
                  이 기기에서 로그인을 유지하고 있어요
                </ThemedText>
              )}
            </ThemedView>
          )}

          {loadError ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {loadError}
              </ThemedText>
            </ThemedView>
          ) : null}
          </View>
        </View>
      </SafeAreaView>

      <OtherLoginSheet
        visible={showOthers}
        providers={others}
        busy={busy}
        onSelect={(provider) => {
          /* 실패하면 이 시트가 아니라 LoginFailureSheet가 뜬다 — 두 Modal이
             동시에 떠 있으면 iOS에서 시트가 겹쳐 그려진다. */
          setShowOthers(false);
          signIn(provider);
        }}
        onDismiss={() => setShowOthers(false)}
      />

      <LoginFailureSheet
        visible={error !== null}
        onRetry={retry}
        onOtherAccount={() => {
          dismissError();
          setShowOthers(true);
        }}
        onDismiss={dismissError}
      />
    </ThemedView>
  );
}

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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
  },
  /** BrandBlock — flex:1. 남는 세로 공간을 전부 가져가 심볼·카피·혜택을 화면 중앙쪽에 둔다. */
  brandBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  /** AuthBlock — flex: 0 0 auto(RN: flexGrow/flexShrink 0). 로그인 버튼 영역은 항상 자기 높이만 차지한다. */
  authBlock: {
    flexGrow: 0,
    flexShrink: 0,
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
  terms: {
    textAlign: 'center',
  },
  benefitList: {
    gap: Spacing.half,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  benefitText: {
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLabel: {
    flex: 1,
  },
  recentBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    backgroundColor: Colors.light.tintSubtle,
    overflow: 'hidden',
  },
});
