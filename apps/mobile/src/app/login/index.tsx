import { dDay } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, Colors, Layout, MaxContentWidth, Radius, SocialLogo, Spacing, ThemedText, ThemedView, WeddingMark, useTheme } from '@weddingpick/ui';
import { LoginFailureSheet } from '@/features/auth/login-failure-sheet';
import { canSignInWith, providerTone, useAuthProviders } from '@/features/auth/providers';
import { loadRememberedAccount, type RememberedAccount } from '@/features/auth/remembered-account';
import { useSignIn } from '@/features/auth/use-sign-in';

/**
 * WP-AUTH-001 "첫 진입" 상태에만 쓴다 — WP-AUTH-008(로그인 유지)엔 없다.
 * 디자인 핸드오프 v3.12의 확정 카피 — `spec/strings.ko.json`의
 * `auth.login.benefit*`과 같은 문장을 유지한다.
 */
const REASONS = [
  '실제 견적 금액을 비교해요', // pick-language: 업체에서 실제로 받은 금액을 가리키는 말 — 서류를 고르라는 자리가 아니다
  '마음에 드는 곳을 함께 Pick해요',
  '일정과 지출도 한곳에서 관리해요',
];


/**
 * WP-AUTH-001/008 로그인. 디자인 핸드오프 v3.13(2026-09-07)부터 **초기
 * 버전은 카카오만** 쓴다 — 이메일 로그인은 화면에서 전면 연결을 끊었다(단,
 * 차후에 다시 쓸 수 있게 `login/email.tsx` 이하 화면과 서버 라우트는 그대로
 * 둔다 — 지우지 않는다). 네이버·구글·애플도 화면에서만 폐기했다(이미 그
 * 방법으로 가입한 계정의 서버 쪽 검증 코드는 그대로 둔다).
 *
 * 2026-09-04 정책 변경 — 비회원 진입 삭제. 스플래시(온보딩 소개) 다음은
 * 이 화면이고, 로그인해야만 앱으로 넘어간다.
 *
 * **만 14세 확인은 여기서 체크박스 하나로 끝낸다**(§3.5). 별도 화면을 두지
 * 않는다. 체크하지 않고 카카오를 누르면 로그인을 시작하지도 않고
 * `login/age-required`(WP-AUTH-010)로 보낸다 — 버튼을 진짜로 비활성화하면
 * 왜 안 눌리는지 말할 자리가 없다. 체크박스는 첫 진입(WP-AUTH-001)에만
 * 있다 — 이미 확인을 마친 WP-AUTH-008(로그인 유지)에는 없다.
 *
 * **두 상태를 한 컴포넌트에서 가른다**(WP-AUTH-001 첫 진입 / WP-AUTH-008
 * 로그인 유지). 기억된 계정이 있으면 인사 + «카카오로 계속하기» 하나만
 * 보여주고, 없으면 만 14세 확인과 카카오 버튼을 보여준다. «다른 계정으로
 * 시작하기»·«카카오 · 최근 로그인» 계정 행은 없앴다(2026-09-08) — 로그인
 * 방법이 카카오 하나뿐이라 고를 것도 알려줄 것도 없고, 계정을 바꾸는 일은
 * 카카오 동의 화면이 맡는다.
 *
 * 카카오 로그인 실패는 화면에 문구를 깔지 않고 시트로 뜬다
 * (`login-failure-sheet.tsx`).
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, resumeRedirect, busy, error, retry, dismissError } = useSignIn();
  /** undefined = 아직 안 읽음, null = 기억된 계정 없음(WP-AUTH-001). */
  const [remembered, setRemembered] = useState<RememberedAccount | null | undefined>(undefined);
  /** 만 14세 이상이에요 체크박스. 기본 해제(§3.5 "화면 규칙"). */
  const [ageChecked, setAgeChecked] = useState(false);

  useEffect(() => {
    loadRememberedAccount().then(setRemembered);
    /*
     * 웹에서 카카오가 같은 창으로 `/login?code=…`에 돌려보낸 경우다. 여기서
     * 마무리하지 않으면 동의까지 마친 사람이 로그인 화면을 다시 보게 된다.
     */
    void resumeRedirect();
  }, [resumeRedirect]);

  const kakao = providers?.[0] ?? null;
  const showRemembered = Boolean(remembered);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* BrandBlock — flex:1. 심볼·카피·혜택. 화면 안에서 남는 세로 공간을 전부 가져간다. */}
          <View style={styles.brandBlock}>
            {/* 배경 박스 없이 마크만 — 색은 스킨과 무관한 고정 코랄(§2 "시작 화면"). */}
            <WeddingMark size={64} color={Colors.light.tint} />

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
                {/*
                  «카카오 · 최근 로그인» 계정 행은 없앴다 — 로그인 방법이 카카오
                  하나뿐이라 어느 계정인지 알려줄 것이 없다. 계정을 바꾸는 일은
                  카카오 동의 화면이 맡는다.
                */}
              </ThemedView>
            ) : (
              <>
                <ThemedView style={styles.section}>
                  <ThemedText type="t1">
                    웨딩 준비,{'\n'}진짜 견적부터{'\n'}확인해 보세요{/* pick-language: 업체에서 실제로 받은 금액을 가리키는 말 — 서류를 고르라는 자리가 아니다 */}
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
                    {/*
                      이메일 로그인은 화면에서 연결을 끊었다(v3.13) — 기억된 계정이
                      이메일이었어도 다시 그 경로로 보내지 않는다. 이미 최소 한 번
                      확인을 마친 계정이라 여기엔 만 14세 체크박스도 없다.
                    */}
                    {kakao ? (
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

                    <ThemedText type="small" themeColor="textAssistive" style={styles.terms}>
                      이 기기에서 로그인을 유지하고 있어요
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <AgeConsentCheckbox checked={ageChecked} onToggle={() => setAgeChecked((v) => !v)} />

                    {kakao ? (
                      <View style={{ opacity: ageChecked ? 1 : 0.4 }}>
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
                          onPress={() => (ageChecked ? signIn(kakao) : router.push('/login/age-required'))}
                        />
                      </View>
                    ) : null}

                    <ThemedText type="small" themeColor="textAssistive" style={styles.terms}>
                      시작하면 이용약관과 개인정보처리방침에 동의하게 돼요
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

      <LoginFailureSheet visible={error !== null} onRetry={retry} onDismiss={dismissError} />
    </ThemedView>
  );
}

/**
 * «만 14세 이상이에요» 체크박스. §3.5 "화면 규칙" — 카카오 위 · 배경 없는
 * 텍스트 · 터치 영역 44 · coral은 체크 원에만 쓰고 라벨은 밑줄로만 표시한다.
 * 카드나 버튼으로 만들면 카카오와 경쟁하게 되어 낮춘 형태다.
 */
function AgeConsentCheckbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="만 14세 이상이에요"
      onPress={onToggle}
      style={styles.ageCard}
      hitSlop={4}>
      <View
        style={[
          styles.ageCheck,
          checked ? { backgroundColor: theme.tint } : { borderWidth: 1.5, borderColor: theme.track },
        ]}>
        {checked ? (
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke={theme.onTint}
              strokeWidth={3.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={[styles.bold, styles.ageUnderline, { textDecorationColor: theme.track }]}>
        만 14세 이상이에요
      </ThemedText>
    </Pressable>
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
  /* §3.5 — 카드가 아니라 44 터치 영역 안의 텍스트 한 줄이다. 좌측 정렬. */
  ageCard: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Layout.touchTarget,
    paddingHorizontal: Spacing.one,
  },
  /* 시안 고정 18 — 8단계 타이포와 무관한 아이콘 크기라 토큰이 아닌 값이다. */
  ageCheck: { width: 18, height: 18, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  ageUnderline: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  bold: { fontWeight: 700 },
});
