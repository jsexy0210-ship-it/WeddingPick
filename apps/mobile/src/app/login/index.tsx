import { POLICY_DOCUMENTS } from '@weddingpick/domain';
import { useEffect, useState, type ReactNode } from 'react';
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
  ProductSymbol,
  readWebInteractionState,
  ThemedText,
  ThemedView,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';
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
import { openExternal } from '@/features/open-external';

/** WP-AUTH-001 — 2026-09-20 전달 정본의 최신 로그인 계약. */
const HERO_TITLE = '웨딩 준비,\n진짜 견적부터\n확인해 보세요'; // pick-language: 로그인 정본 카피
const BENEFITS = [
  '실제 견적 금액을 비교해요', // pick-language: 로그인 정본 혜택
  '마음에 드는 곳을 함께 Pick해요',
  '일정과 지출도 한곳에서 관리해요',
] as const;

const AGE_CONFIRM_LABEL = '만 14세 이상이에요';

/*
 * «기억된 계정» 변형(옛 WP-AUTH-008 — «다시 오셨네요» · 최근 로그인 카드 · «카카오로
 * 계속하기»)은 2026-09-23에 걷어냈다. v3.28 정본 홈 파일에 그 화면이 없고, 「정본에 없는
 * 기능은 제거한다」(CLAUDE.md 2026-09-23 대표 지시)가 화면 안 요소까지 덮는다. 로그인은
 * 언제나 한 모양이다 — 만 14세 체크 + «카카오로 시작하기». 기기에 적어 둔 계정
 * (`features/auth/remembered-account.ts`)은 로그인 유지 판정이 계속 쓰므로 그대로다.
 */

export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, busy, busyProvider, error, retry, dismissError, reportError } = useSignIn();
  /** «만 14세 이상이에요»를 사람이 눌렀는가. 기본값은 꺼짐 — 미리 켜두지 않는다. */
  const [ageChecked, setAgeChecked] = useState(false);

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
  /* 화면에서 연령 확인을 먼저 받아야 시작할 수 있다. */
  const ageBlocked = !ageChecked;

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
                <AgeConfirmRow checked={ageChecked} onToggle={() => setAgeChecked((was) => !was)} />

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
                    disabled={busy || !canSignInWith(primary) || ageBlocked}
                    onPress={() => signIn(primary, { ageAcknowledged: ageChecked })}
                  />
                ) : null}

                <ThemedText type="f12" themeColor="textAssistive" style={styles.terms}>
                  시작하면 <PolicyLink id="terms" />과 <PolicyLink id="privacy" />에 동의하게 돼요
                </ThemedText>
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

/**
 * 만 14세 확인 — v3.28 WP-AUTH-001 `ageCta`. 카카오 버튼 «위»에 같은 높이 56으로
 * 선다: 코랄 면(tintSurface) · 코랄 1.5 테두리 · radius 6 · 가운데 정렬 · 체크 22
 * (radius 6) + 16/700 코랄 글자. 켜기 전에도 같은 모양이고 체크 안만 비어 있다.
 */
function AgeConfirmRow({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={AGE_CONFIRM_LABEL}
      onPress={onToggle}
      style={(state) => {
        const { focused } = readWebInteractionState(state);

        return [
          styles.ageConfirmRow,
          { backgroundColor: theme.tintSurface, borderColor: theme.tint },
          focused
            ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 }
            : null,
        ];
      }}>
      <View
        style={[
          styles.ageCheck,
          checked
            ? { backgroundColor: theme.tint }
            : { borderWidth: Border.checkbox, borderColor: theme.tint },
        ]}>
        {checked ? <ProductSymbol name="check" size={14} color={theme.onTint} /> : null}
      </View>
      <ThemedText type="f16" themeColor="tint" style={styles.ageLabel}>
        {AGE_CONFIRM_LABEL}
      </ThemedText>
    </Pressable>
  );
}

function PolicyLink({ id }: { id: 'terms' | 'privacy' }) {
  const theme = useTheme();
  const policy = POLICY_DOCUMENTS.find((document) => document.id === id);

  if (!policy?.url) return <>{id === 'terms' ? '이용약관' : '개인정보처리방침'}</>;

  const { url } = policy;

  return (
    <ThemedText
      type="f11"
      themeColor="textSecondary"
      accessibilityRole="link"
      style={[styles.policyLink, { textDecorationColor: theme.textSecondary }]}
      onPress={() => {
        void openExternal(url, { title: policy.title });
      }}>
      {policy.title}
    </ThemedText>
  );
}

/*
 * v3.28 WP-AUTH-001 고정값 — 브랜드 블록 위 72(`loginBrand`) · 마크 상자 64 안의 마크 40
 * (`markBox`) · 만 14세 체크 22(`ageCheck`) · 카카오 로고 20(`kakaoMark`).
 */
const BRAND_TOP = 72;
const MARK = 40;
const AGE_CHECK = 22;
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
  title: { fontWeight: 700, lineHeight: LineHeight.t1, letterSpacing: LetterSpacing.n064 },
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
    paddingTop: Spacing.four + Spacing.four,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four + Spacing.four,
    gap: 10,
  },
  ageConfirmRow: {
    height: Layout.ctaSheet,
    borderRadius: Radius.control,
    borderWidth: Border.selected,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.iconTextGap,
  },
  ageCheck: {
    width: AGE_CHECK,
    height: AGE_CHECK,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageLabel: { fontWeight: 700 },
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
  terms: { textAlign: 'center', paddingTop: Spacing.one, lineHeight: LineHeight.micro },
  busy: { alignItems: 'center', justifyContent: 'center', minHeight: Layout.ctaSheet },
  policyLink: { fontWeight: 700, textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  bold: { fontWeight: 700 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
