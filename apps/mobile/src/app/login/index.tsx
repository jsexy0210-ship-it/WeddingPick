import { dDay } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, Colors, MaxContentWidth, Radius, SocialLogo, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { LoginFailureSheet } from '@/features/auth/login-failure-sheet';
import { maskEmail } from '@/features/auth/mask-email';
import { canSignInWith, providerTone, useAuthProviders } from '@/features/auth/providers';
import { loadRememberedAccount, type RememberedAccount } from '@/features/auth/remembered-account';
import { useSignIn } from '@/features/auth/use-sign-in';

/**
 * WP-AUTH-001 "첫 진입" 상태에만 쓴다 — WP-AUTH-008(로그인 유지)엔 없다.
 * 디자인 핸드오프 v3.12의 확정 카피 — `spec/strings.ko.json`의
 * `auth.login.benefit*`과 같은 문장을 유지한다.
 */
const REASONS = [
  '실제 견적 금액을 비교해요',
  '마음에 드는 곳을 함께 Pick해요',
  '일정과 지출도 한곳에서 관리해요',
];

/**
 * Pick Mark — spec/tokens.json `symbol` 그대로. 배경 박스 없이 이 2개
 * path만 그린다(§2 "시작 화면" 적용처). 색은 스킨과 무관한 고정 코랄.
 */
const PICK_MARK_VIEWBOX = 24;
const PICK_MARK_STROKE = 1.9;
const PICK_MARK_PATHS = [
  'M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z',
  'M8.7 11.9l2.2 2.2 4.4-4.4',
];

/**
 * WP-AUTH-001/008 로그인. 디자인 핸드오프 v3.12(2026-09-06)의 로그인 방식
 * 개편 — 카카오 + 이메일 2종. 네이버·구글·애플은 폐기했다(화면에서만 — 이미
 * 그 방법으로 가입한 계정의 서버 쪽 검증 코드는 그대로 둔다).
 *
 * 2026-09-04 정책 변경 — 비회원 진입 삭제. 스플래시(온보딩 소개) 다음은
 * 이 화면이고, 로그인해야만 앱으로 넘어간다.
 *
 * **두 상태를 한 컴포넌트에서 가른다**(WP-AUTH-001 첫 진입 / WP-AUTH-008
 * 로그인 유지). 기억된 계정이 있으면 그 계정의 "계속하기" 버튼 하나 +
 * "다른 계정으로 시작하기"만 보여주고, 없거나 다른 계정을 고르면 카카오
 * (Primary)와 이메일(Secondary)을 나란히 보여준다.
 *
 * "이메일로 시작하기"는 시트가 아니라 화면 이동이다(`login/email.tsx`).
 * 카카오 로그인 실패는 화면에 문구를 깔지 않고 시트로 뜬다
 * (`login-failure-sheet.tsx`).
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, busy, error, retry, dismissError } = useSignIn();
  /** undefined = 아직 안 읽음, null = 기억된 계정 없음(WP-AUTH-001). */
  const [remembered, setRemembered] = useState<RememberedAccount | null | undefined>(undefined);
  /** "다른 계정으로 시작하기"를 누르면 기억된 계정을 무시하고 첫 진입 화면을 보여준다. */
  const [chooseNew, setChooseNew] = useState(false);

  useEffect(() => {
    loadRememberedAccount().then(setRemembered);
  }, []);

  const kakao = providers?.[0] ?? null;
  const showRemembered = Boolean(remembered) && !chooseNew;

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

            {showRemembered && remembered ? (
              <ThemedView style={styles.section}>
                <ThemedText type="t1">
                  {remembered.displayName ? `${remembered.displayName}님,\n` : ''}다시 오셨네요
                </ThemedText>
                {remembered.weddingDate ? (
                  <ThemedText type="t6" themeColor="textSecondary">
                    {dDay(remembered.weddingDate).text}
                  </ThemedText>
                ) : null}

                <ThemedView type="backgroundElement" style={styles.accountRow}>
                  <View
                    style={[
                      styles.accountAvatar,
                      { backgroundColor: theme.tintSubtle },
                    ]}>
                    {remembered.provider === 'email' ? (
                      <ThemedText type="t5" themeColor="tint">
                        @
                      </ThemedText>
                    ) : (
                      <SocialLogo provider="kakao" />
                    )}
                  </View>
                  <View style={styles.accountLabel}>
                    <ThemedText type="t5">
                      {remembered.provider === 'email'
                        ? (remembered.email ? maskEmail(remembered.email) : '이메일')
                        : '카카오'}
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
                    웨딩 준비,{'\n'}진짜 견적부터{'\n'}확인해 보세요
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
            ) : (
              <ThemedView style={styles.section}>
                {showRemembered && remembered ? (
                  <>
                    {remembered.provider === 'email' ? (
                      <ActionButton
                        variant="primary"
                        size="xlarge"
                        label="이메일로 계속하기"
                        onPress={() =>
                          router.push({ pathname: '/login/password', params: { email: remembered.email ?? '' } })
                        }
                      />
                    ) : kakao ? (
                      <ActionButton
                        variant="primary"
                        size="xlarge"
                        tone={providerTone(kakao)}
                        icon={kakao.isDevelopmentStandIn ? undefined : <SocialLogo provider="kakao" />}
                        label={kakao.isDevelopmentStandIn ? '개발용 로그인' : '카카오로 계속하기'}
                        disabled={busy || !canSignInWith(kakao)}
                        onPress={() => signIn(kakao)}
                      />
                    ) : null}

                    <ActionButton
                      variant="secondary"
                      size="xlarge"
                      label="다른 계정으로 시작하기"
                      disabled={busy}
                      onPress={() => setChooseNew(true)}
                    />

                    <ThemedText type="small" themeColor="textAssistive" style={styles.terms}>
                      이 기기에서 로그인을 유지하고 있어요
                    </ThemedText>
                  </>
                ) : (
                  <>
                    {kakao ? (
                      <ActionButton
                        variant="primary"
                        size="xlarge"
                        tone={providerTone(kakao)}
                        icon={kakao.isDevelopmentStandIn ? undefined : <SocialLogo provider="kakao" />}
                        label={kakao.isDevelopmentStandIn ? '개발용 로그인' : '카카오로 시작하기'}
                        hint={
                          kakao.isDevelopmentStandIn
                            ? '실제 카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                            : undefined
                        }
                        disabled={busy || !canSignInWith(kakao)}
                        onPress={() => signIn(kakao)}
                      />
                    ) : null}

                    <ActionButton
                      variant="secondary"
                      size="xlarge"
                      label="이메일로 시작하기"
                      disabled={busy}
                      onPress={() => router.push('/login/email')}
                    />

                    <ThemedText type="small" themeColor="textAssistive" style={styles.terms}>
                      시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요
                    </ThemedText>
                  </>
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

      <LoginFailureSheet
        visible={error !== null}
        onRetry={retry}
        onUseEmail={() => {
          dismissError();
          router.push('/login/email');
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
