import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Border,
  Layout,
  LetterSpacing,
  LineHeight,
  MaxContentWidth,
  Radius,
  SocialLogo,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';
import { AgeConfirmSheet } from '@/features/auth/age-confirm-sheet';
import { LoginFailureSheet } from '@/features/auth/login-failure-sheet';
import {
  canSignInWith,
  providerLabel,
  providerTone,
  useAuthProviders,
} from '@/features/auth/providers';
import { bootOwnsSigningInMessage, takePendingSignInError } from '@/features/auth/sign-in-handoff';
import { SigningInBody, signingInMessage } from '@/features/auth/signing-in-view';
import { useSignIn } from '@/features/auth/use-sign-in';

/**
 * WP-AUTH-001 — v3.29 정본 `대메뉴_홈(로그인, 온보딩).dc.html` 2번 화면(`loginTitle` ·
 * `benefits`).
 *
 * **v3.29가 타이틀·혜택을 다시 바꿨다**(CHANGELOG v3.29 「로그인 화면 타이틀 · 혜택 4줄
 * 교체」). 핵심 메시지 「플래너 없이, 직접 고르는 웨딩 준비」를 그대로 로그인 타이틀에
 * 쓴다 — README.md·PROJECT_RULES.md 맨 앞줄과 같은 문장이다.
 */
const HERO_TITLE = '플래너 없이,\n직접 고르는\n웨딩 준비'; // pick-language: v3.29 로그인 정본 카피
const BENEFITS = [
  '업체별 가격과 조건을 한눈에 확인해요', // pick-language: v3.29 로그인 정본 혜택(dc.html benefits)
  '광고보다 내 기준으로 직접 골라요',
  '플래너를 거치지 않고 직접 연결돼요',
  '계약부터 결혼식까지 한곳에서 챙겨요',
] as const;

/*
 * «기억된 계정» 변형(옛 WP-AUTH-008 — «다시 오셨네요» · 최근 로그인 카드 · «카카오로
 * 계속하기»)은 2026-09-23에 걷어냈다. 정본 홈 파일에 그 화면이 없고, 「정본에 없는
 * 기능은 제거한다」(CLAUDE.md 2026-09-23 대표 지시)가 화면 안 요소까지 덮는다. 기기에
 * 적어 둔 계정(`features/auth/remembered-account.ts`)은 로그인 유지 판정이 계속 쓰므로
 * 그대로다.
 *
 * **v3.29에서 만 14세 체크 · 약관 문구가 이 화면에서 빠졌다**(CHANGELOG v3.29 「만 14세
 * 체크 · 약관 문구를 약관 동의 화면으로 일원화」). dc.html 2번 화면은 브랜드 블록 +
 * 「카카오로 시작하기」 버튼뿐이다. 그 둘은 WP-AUTH-010(`app/login/consent.tsx`)으로
 * 옮겼다 — 로그인 성공 뒤(카카오가 연령대를 줘서 통과한 대부분의 경우) 그 화면이 연다.
 *
 * **카카오가 연령대를 안 줘 판정하지 못하는 드문 경우**(`needsAgeConfirm`)는 다르다 —
 * 그 판정은 세션이 열리기 «전»에 끝나야 해서 약관 동의 화면(세션이 있어야 여는 화면)으로
 * 미룰 수 없다. dc.html에는 이 상태가 없다 — 그려둔 화면이 아니라 로그인 자체를 한 번 더
 * 받는 기존 안전장치이므로, 코랄 체크박스 화면 대신 `AgeConfirmSheet`(작은 확인 시트)로
 * 남긴다. 「확인 못 함」의 기본값은 통과가 아니라 차단이다(`packages/domain/src/signup.ts`).
 */

export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const {
    signIn,
    busy,
    busyProvider,
    error,
    retry,
    dismissError,
    reportError,
    needsAgeConfirm,
    dismissAgeConfirm,
  } = useSignIn();

  useEffect(() => {
    const failure = takePendingSignInError();

    if (failure) reportError(failure);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번만
  }, []);

  /* 서버 목록 그대로 — 순서(카카오 · 애플 · 개발용)와 거르기는 `usableProviders`가 정한다. */
  const options = providers ?? [];
  const primary = options.find((provider) => provider.provider === 'kakao' && !provider.isDevelopmentStandIn)
    ?? options[0]
    ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={[styles.markBox, { backgroundColor: theme.tintSurface }]}>
              <WeddingMark size={MARK} color={theme.tint} />
            </View>
            <ThemedText type="f32" style={styles.title}>
              {HERO_TITLE}
            </ThemedText>

            <View style={styles.benefitWrap}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <View style={[styles.benefitDot, { backgroundColor: theme.tint }]} />
                  <ThemedText type="f15" themeColor="textSecondary" style={styles.benefitText}>
                    {benefit}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.authBlock}>
            {providers === null || busy ? (
              <ThemedView style={styles.busy}>
                <SigningInBody
                  size={28}
                  show={busy && !bootOwnsSigningInMessage() ? 'message' : 'loader'}
                  message={signingInMessage(busyProvider)}
                />
              </ThemedView>
            ) : (
              <>
                {/*
                 * v3.29 dc.html 2번 화면 — 브랜드 블록 아래 카카오 버튼 하나뿐이다.
                 * 만 14세 체크 · 약관 안내 줄은 WP-AUTH-010(약관 동의 화면)으로 옮겼다.
                 */}
                {primary ? (
                  <ProviderButton
                    tone={providerTone(primary) ?? { background: theme.tint, text: theme.onTint }}
                    icon={
                      primary.isDevelopmentStandIn ? null : (
                        <SocialLogo provider={primary.provider} size={KAKAO_LOGO} />
                      )
                    }
                    label={providerLabel(primary, 'start')}
                    hint={
                      primary.isDevelopmentStandIn
                        ? '실제 카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                        : null
                    }
                    disabled={busy || !canSignInWith(primary)}
                    onPress={() => signIn(primary, {})}
                  />
                ) : null}
              </>
            )}

            {loadError ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="f12" themeColor="textSecondary">
                  {loadError}
                </ThemedText>
              </ThemedView>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      <LoginFailureSheet visible={error !== null} onRetry={retry} onDismiss={dismissError} />
      {/* 카카오가 연령대를 안 준 드문 경우만(`needsAgeConfirm`) — v3.29 dc.html에 없는 상태다. */}
      <AgeConfirmSheet
        visible={needsAgeConfirm}
        busy={busy}
        onConfirm={() => { if (primary) void signIn(primary, { ageAcknowledged: true }); }}
        onDismiss={dismissAgeConfirm}
      />
    </ThemedView>
  );
}

/** 로그인 단추 — 규격서 «button 382×56 · 15/700 · lh 23 · gap 8 · r16». 면 · 글자색은 제공자(`providerTone`)가 준다. */
function ProviderButton({
  tone,
  icon,
  label,
  hint,
  disabled,
  onPress,
}: {
  tone: { background: string; text: string; border?: string };
  icon: ReactNode;
  label: string;
  hint: string | null;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.provider,
          { backgroundColor: tone.background, borderColor: tone.border ?? tone.background },
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}>
        {icon}
        <ThemedText type="f17" style={[styles.providerLabel, { color: tone.text }]}>
          {label}
        </ThemedText>
      </Pressable>
      {hint ? (
        <ThemedText type="f12" themeColor="textAssistive" style={styles.hint}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/*
 * v3.29 WP-AUTH-001 고정값 — 브랜드 블록 위 72(`loginBrand`) · 마크 상자 64 안의 마크 40
 * (`markBox`) · 카카오 로고 20(`kakaoMark`). 만 14세 체크(`ageCheck`)는 이 화면에서 빠졌다.
 */
const BRAND_TOP = 72;
const MARK = 40;
const KAKAO_LOGO = 20;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { flexGrow: 1 },
  brandBlock: {
    flex: 1,
    paddingTop: BRAND_TOP,
    paddingHorizontal: Layout.gutter,
  },
  markBox: {
    width: Spacing.six,
    height: Spacing.six,
    borderRadius: Radius.cardLarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontWeight: 700, lineHeight: 44, letterSpacing: LetterSpacing.n064 },
  benefitWrap: {
    flexShrink: 0,
    paddingTop: 24,
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  benefitDot: { width: 5, height: 5, borderRadius: Radius.pill, marginTop: 9 },
  benefitText: { flex: 1, lineHeight: LineHeight.lh23 },
  authBlock: {
    flexShrink: 0,
    paddingTop: 0,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four + Spacing.two,
    gap: 10,
  },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  provider: {
    height: Layout.ctaSheet,
    borderRadius: Radius.control,
    borderWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  providerLabel: { fontWeight: 700, lineHeight: LineHeight.lh23 },
  hint: { textAlign: 'center', marginTop: Spacing.one },
  busy: { alignItems: 'center', justifyContent: 'center', minHeight: Layout.ctaSheet },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
