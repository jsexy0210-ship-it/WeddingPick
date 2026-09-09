import { POLICY_DOCUMENTS, dDay } from '@weddingpick/domain';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Colors,
  Layout,
  MaxContentWidth,
  Radius,
  SocialColors,
  SocialLogo,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';
import { LoginFailureSheet } from '@/features/auth/login-failure-sheet';
import { maskEmail } from '@/features/auth/mask-email';
import { canSignInWith, hasKakaoReturn, providerTone, useAuthProviders } from '@/features/auth/providers';
import { loadRememberedAccount, type RememberedAccount } from '@/features/auth/remembered-account';
import { takePendingSignInError } from '@/features/auth/sign-in-handoff';
import { SigningInBody } from '@/features/auth/signing-in-view';
import { useSignIn } from '@/features/auth/use-sign-in';
import { openExternal } from '@/features/open-external';

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

/** WP-AUTH-008 마지막 계정 카드의 배지 — strings.ko.json `onboarding.auth.remember.recentLabel`. */
const RECENT_LOGIN_BADGE = '최근 로그인';
/** 카드 첫 줄 — 로그인 방법 이름. 초기 버전은 카카오만이다. */
const KAKAO_PROVIDER_NAME = '카카오';

/**
 * WP-AUTH-001/008 로그인. 디자인 핸드오프 v3.13(2026-09-07)부터 **초기
 * 버전은 카카오만** 쓴다 — 이메일 로그인(v3.12, WP-AUTH-002~007)은 화면·서버
 * 라우트·메일 발송까지 2026-09-08에 전부 지웠다. 네이버·구글·애플은 화면에서만
 * 폐기했다(이미 그 방법으로 가입한 계정의 서버 쪽 검증 코드는 그대로 둔다).
 *
 * 레이아웃은 시안 `01a-login.dc.html` #27a · #27h 그대로다(SPEC §13.5) —
 *
 *   BrandBlock  flex 1 · 세로 중앙 · 마크 64 (아래 24) · 제목 32/43 · 혜택 3줄(위 28)
 *   AuthBlock   flex 0 0 auto · 위 24 · 아래 32 · 사이 10 · 동의 44 · 카카오 · 약관 13px
 *
 * 2026-09-04 정책 변경 — 비회원 진입 삭제. 스플래시(온보딩 소개) 다음은
 * 이 화면이고, 로그인해야만 앱으로 넘어간다.
 *
 * **만 14세 확인 화면도 체크박스도 여기 없다**(v3.24). 카카오가 출생 연도를
 * 필수 동의로 넘기고 서버가 로그인 콜백에서 판정한다. 미달이면 계정을 만들지
 * 않고 `login/age-required`(WP-AUTH-009)로 보낸다.
 *
 * **두 상태를 한 컴포넌트에서 가른다**(WP-AUTH-001 첫 진입 / WP-AUTH-008
 * 로그인 유지). 기억된 계정이 있으면 인사 · D-day · 마지막 계정 카드(카카오
 * 아바타 40 · 마스킹 이메일 · «최근 로그인» 배지) + «카카오로 계속하기» 하나만
 * 보여주고, 없으면 만 14세 확인과 카카오 버튼을 보여준다. 계정 전환 버튼은
 * 두지 않는다(SPEC §3.4 — 초기 버전은 카카오만이라 고를 것이 없다).
 *
 * 카카오 로그인 실패는 화면에 문구를 깔지 않고 시트로 뜬다
 * (`login-failure-sheet.tsx`).
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, busy, error, retry, dismissError, reportError } = useSignIn();
  /** undefined = 아직 안 읽음, null = 기억된 계정 없음(WP-AUTH-001). */
  const [remembered, setRemembered] = useState<RememberedAccount | null | undefined>(undefined);

  useEffect(() => {
    loadRememberedAccount().then(setRemembered);
    /*
     * 웹에서 카카오 리다이렉트 마무리는 부팅(app/_layout.tsx)이 스플래시에서
     * 끝내고 곧장 온보딩/홈으로 간다 — 여기까지 온 것은 그 마무리가 실패했거나
     * 사용자가 취소한 경우뿐이다. 실패 이유가 넘어왔으면 시트로 띄운다.
     */
    const failure = takePendingSignInError();

    if (failure) reportError(failure);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번만
  }, []);

  const kakao = providers?.[0] ?? null;
  const showRemembered = Boolean(remembered);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* BrandBlock — flex:1. 심볼·카피·혜택. 화면 안에서 남는 세로 공간을 전부 가져간다. */}
          <View style={styles.brandBlock}>
            {/* 배경 박스 없이 마크만 — 색은 스킨과 무관한 고정 코랄(§2 "시작 화면"). 시안 markPlain — 아래 24. */}
            <View style={styles.mark}>
              <WeddingMark size={MARK_SIZE} color={Colors.light.tint} />
            </View>

            {showRemembered && remembered ? (
              <>
                <ThemedText type="t1">
                  {remembered.displayName ? `${remembered.displayName}님,\n` : ''}다시 오셨네요
                </ThemedText>
                {remembered.weddingDate ? (
                  <ThemedText type="body" themeColor="textSecondary" style={styles.heroSub}>
                    {remainingLine(remembered.weddingDate)}
                  </ThemedText>
                ) : null}

                <RememberedAccountCard account={remembered} />
              </>
            ) : (
              <>
                <ThemedText type="t1">
                  웨딩 준비,{'\n'}진짜 견적부터{'\n'}확인해 보세요{/* pick-language: 업체에서 실제로 받은 금액을 가리키는 말 — 서류를 고르라는 자리가 아니다 */}
                </ThemedText>

                {/* 시안 benefitWrap — 위 28 · 줄 사이 2. 줄은 최소 44 · 상하 9 · 점과 글자 사이 10. */}
                <View style={styles.benefitList}>
                  {REASONS.map((reason) => (
                    <View key={reason} style={styles.benefitRow}>
                      <View style={[styles.dot, { backgroundColor: theme.tint }]} />
                      <ThemedText type="body" themeColor="textStrong" style={styles.benefitText}>
                        {reason}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* AuthBlock — flex: 0 0 auto. 로그인 버튼·약관·오류. 항상 화면
              하단에 자기 높이만큼만 차지한다. 시안 authWrap — 위 24 · 아래 32 · 사이 10. */}
          <View style={styles.authBlock}>
            {providers === null || remembered === undefined || busy ? (
              /*
               * 로그인 진행 중에는 버튼 대신 이것만 보인다. 카카오에서 돌아온 뒤
               * 세션 교환 한 번(왕복 1회)이 유일한 기다림이다 — 그동안 멀쩡한
               * 로그인 폼이 떠 있으면 «다시 로그인하라는 건가» 하고 읽힌다.
               */
              <ThemedView style={styles.busy}>
                {/*
                  문장은 `SigningInBody` 한 곳에만 있다. 카카오에서 돌아온 부팅이면
                  그 말은 부팅 화면(`SigningInView`)이 이미 하고 있으므로 여기서는
                  로더만 남긴다 — 두 화면이 한 프레임에 겹칠 때 같은 말이 두 번
                  보이던 문제(2026-09-09 보고).
                */}
                <SigningInBody size={28} message={busy && !hasKakaoReturn()} />
              </ThemedView>
            ) : (
              <ThemedView style={styles.section}>
                {showRemembered && remembered ? (
                  <>
                    {/*
                      시안 #27h — «카카오로 계속하기»는 ctaPrimary(코랄 · 로고 없음)다.
                      첫 진입의 카카오 노란 버튼과 다르다. 이미 최소 한 번 확인을 마친
                      계정이라 여기엔 만 14세 체크박스도 없다.
                    */}
                    {kakao ? (
                      <ActionButton
                        variant="primary"
                        size="xlarge"
                        label={kakao.isDevelopmentStandIn ? '개발용 로그인' : '카카오로 계속하기'}
                        disabled={busy || !canSignInWith(kakao)}
                        onPress={() => signIn(kakao)}
                      />
                    ) : null}

                    <ThemedText type="micro" themeColor="textAssistive" style={styles.terms}>
                      이 기기에서 로그인을 유지하고 있어요
                    </ThemedText>
                  </>
                ) : (
                  <>
                    {/*
                      **만 14세 체크박스를 없앴다**(2026-09-09 사용자 결정). 카카오
                      동의항목에서 **출생 연도를 필수로 받고 서버가 그것으로 판정한다**
                      (`routes/auth.ts`). 스스로 «열네 살이 넘어요»를 누르게 하는 것은
                      확인이 아니라 선언이었고, 이제 확인할 값이 실제로 들어온다.

                      미만이면 서버가 계정을 만들지 않고 403으로 막는다 — 그때 앱이
                      WP-AUTH-009(`login/age-required`)으로 보낸다.
                    */}
                    {kakao ? (
                      <ActionButton
                        variant="primary"
                        size="xlarge"
                        tone={providerTone(kakao)}
                        icon={kakao.isDevelopmentStandIn ? undefined : <SocialLogo provider="kakao" size={KAKAO_LOGO} />}
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

                    <ThemedText type="micro" themeColor="textAssistive" style={styles.terms}>
                      시작하면 <PolicyLink id="terms" />과 <PolicyLink id="privacy" />에 동의하게 돼요
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
 * WP-AUTH-008 히어로 서브 — 시안 «예식까지 140일 남았어요». 도메인 `dDay().text`는
 * 조사를 붙인 «140일이 남았어요»라 시안과 다르다 — 남은 일수만 받아 시안 문장으로 적는다.
 * 오늘이거나 지났으면 도메인 문장을 그대로 쓴다.
 */
function remainingLine(weddingDate: string): string {
  const remaining = dDay(weddingDate);

  return remaining.kind === 'upcoming' ? `예식까지 ${remaining.days}일 남았어요` : remaining.text;
}

/**
 * 마지막 계정 카드(시안 #27h lastAccount) — gray50 · radius 10 · 안쪽 16/18 · 사이 12.
 * 카카오 아바타 40(#FEE500 원 + 로고 18) · «카카오» 16/700 · 마스킹 이메일 14 ·
 * «최근 로그인» 배지(옅은 코랄 · 코랄 14/700). 이메일을 모르면(카카오는 닉네임만
 * 받는다) 둘째 줄을 비우고 첫 줄만 남긴다 — 빈 값을 «—»로 채우지 않는다.
 */
function RememberedAccountCard({ account }: { account: RememberedAccount }) {
  const theme = useTheme();

  return (
    <View style={styles.accountWrap}>
      <View style={[styles.account, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.avatar, { backgroundColor: SocialColors.kakao.background }]}>
          <SocialLogo provider="kakao" size={AVATAR_LOGO} />
        </View>

        <View style={styles.accountText}>
          <ThemedText type="t6" numberOfLines={1} style={styles.bold}>
            {KAKAO_PROVIDER_NAME}
          </ThemedText>
          {account.email ? (
            <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
              {maskEmail(account.email)}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.badge, { backgroundColor: theme.tintSubtle }]}>
          <ThemedText type="t7" themeColor="tint" style={styles.bold}>
            {RECENT_LOGIN_BADGE}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

/**
 * 동의 안내 문장 속 약관 링크. 시안 legalLink — #4D5159 · 700 · 밑줄(코랄이나 accent가
 * 아니다). 누르면 웹의 전문을 새 창에 연다. 주소는 @weddingpick/domain POLICY_DOCUMENTS
 * 한 곳에서 온다 — 웹 푸터와 같은 곳이다.
 */
function PolicyLink({ id }: { id: 'terms' | 'privacy' }) {
  const theme = useTheme();
  const policy = POLICY_DOCUMENTS.find((document) => document.id === id);

  if (!policy?.url) return <>{id === 'terms' ? '이용약관' : '개인정보처리방침'}</>;

  const { url } = policy;

  return (
    <ThemedText
      type="micro"
      themeColor="textSecondary"
      accessibilityRole="link"
      style={[styles.policyLink, { textDecorationColor: theme.textSecondary }]}
      onPress={() => {
        void openExternal(url);
      }}>
      {policy.title}
    </ThemedText>
  );
}


/* 시안 고정값 — 마크 64 · 카카오 로고 20 · 아바타 40(로고 18) · 체크 원 18(글리프 12) · 배지 좌우 9 · 카드 안쪽 16/18. */
const MARK_SIZE = 64;
const KAKAO_LOGO = 20;
const AVATAR_LOGO = 18;
const BADGE_PADDING_X = 9;
const ACCOUNT_PADDING_Y = 16;
const ACCOUNT_PADDING_X = 18;

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
  /* 시안 — 좌우 24. 위는 statusBar(안전 영역)만, 아래는 authWrap의 32. */
  content: {
    flex: 1,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.five,
  },
  /** BrandBlock — flex:1 · 세로 중앙. 시안 brandBlock gap 0 — 간격은 요소가 각자 가진다. */
  brandBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  /** AuthBlock — flex: 0 0 auto(RN: flexGrow/flexShrink 0). 시안 authWrap — 위 24 · 사이 10. */
  authBlock: {
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: Spacing.four,
    gap: Layout.cardGap,
  },
  section: {
    gap: Layout.cardGap,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  mark: { marginBottom: Spacing.four },
  /* 시안 heroSub — 제목 아래 10. */
  heroSub: { marginTop: Layout.cardGap },
  /* 시안 legalLine — 13px 400 · 위 6 · 가운데. micro 토큰은 700이라 두께만 되돌린다(링크만 700). */
  terms: {
    textAlign: 'center',
    paddingTop: Spacing.two - Spacing.half,
    fontWeight: 400,
  },
  /* 시안 benefitWrap — 위 28(섹션 사이) · 줄 사이 2. */
  benefitList: {
    paddingTop: Layout.sectionGap,
    gap: Spacing.half,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.cardGap,
    minHeight: Layout.touchTarget,
    paddingVertical: Layout.summaryRowPaddingY,
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
  busy: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  /* 시안 lastWrap — 위 28. */
  accountWrap: { paddingTop: Layout.sectionGap },
  account: {
    borderRadius: Radius.medium,
    paddingVertical: ACCOUNT_PADDING_Y,
    paddingHorizontal: ACCOUNT_PADDING_X,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
  },
  avatar: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountText: { flex: 1, minWidth: 0, gap: Spacing.half },
  /* 시안 badgeOk — 상하 4 · 좌우 9 · radius 4. */
  badge: {
    paddingVertical: Spacing.one,
    paddingHorizontal: BADGE_PADDING_X,
    borderRadius: Radius.badge,
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
  ageUnderline: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  policyLink: { fontWeight: 700, textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  bold: { fontWeight: 700 },
});
