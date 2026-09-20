import { POLICY_DOCUMENTS, dDay } from '@weddingpick/domain';
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
  SocialColors,
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
import { maskEmail } from '@/features/auth/mask-email';
import {
  canSignInWith,
  providerLabel,
  providerTone,
  useAuthProviders,
} from '@/features/auth/providers';
import { loadRememberedAccount, type RememberedAccount } from '@/features/auth/remembered-account';
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

/** WP-AUTH-008 마지막 계정 카드의 배지 — strings.ko.json `onboarding.auth.remember.recentLabel`. */
const RECENT_LOGIN_BADGE = '최근 로그인';
/** 카드 첫 줄 — 로그인 방법 이름. 초기 버전은 카카오만이다. */
const KAKAO_PROVIDER_NAME = '카카오';

export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, busy, busyProvider, error, retry, dismissError, reportError } = useSignIn();
  /** «만 14세 이상이에요»를 사람이 눌렀는가. 기본값은 꺼짐 — 미리 켜두지 않는다. */
  const [ageChecked, setAgeChecked] = useState(false);
  /** undefined = 아직 안 읽음, null = 기억된 계정 없음(WP-AUTH-001). */
  const [remembered, setRemembered] = useState<RememberedAccount | null | undefined>(undefined);

  useEffect(() => {
    loadRememberedAccount().then(setRemembered);
    const failure = takePendingSignInError();

    if (failure) reportError(failure);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번만
  }, []);

  const showRemembered = Boolean(remembered);
  /* 서버 목록 그대로 — 순서(카카오 · 애플 · 개발용)와 거르기는 `usableProviders`가 정한다. */
  const options = providers ?? [];
  const primary = options.find((provider) => provider.provider === 'kakao' && !provider.isDevelopmentStandIn)
    ?? options[0]
    ?? null;
  /* 신규 로그인은 화면에서 연령 확인을 먼저 받아야 시작할 수 있다. 로그인 유지는 다시 묻지 않는다. */
  const ageBlocked = !showRemembered && !ageChecked;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={styles.markBox}>
              <WeddingMark size={64} color={theme.tint} />
            </View>
            <ThemedText type="f32" style={styles.title}>
              {showRemembered && remembered
                ? `${remembered.displayName ? `${remembered.displayName}님,\n` : ''}다시 오셨네요`
                : HERO_TITLE}
            </ThemedText>
            {showRemembered && remembered?.weddingDate ? (
              <ThemedText type="f16" themeColor="textSecondary" style={styles.sub}>
                {remainingLine(remembered.weddingDate)}
              </ThemedText>
            ) : null}

            <View style={styles.benefitWrap}>
              {showRemembered && remembered ? (
                <RememberedAccountCard account={remembered} />
              ) : (
                BENEFITS.map((benefit) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <View style={[styles.benefitDot, { backgroundColor: theme.tint }]} />
                    <ThemedText type="f15" themeColor="textSecondary" style={styles.benefitText}>
                      {benefit}
                    </ThemedText>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.authBlock}>
            {providers === null || remembered === undefined || busy ? (
              <ThemedView style={styles.busy}>
                <SigningInBody
                  size={28}
                  show={busy && !bootOwnsSigningInMessage() ? 'message' : 'loader'}
                  message={signingInMessage(busyProvider)}
                />
              </ThemedView>
            ) : (
              <>
                <AgeConfirmRow
                  visible={!showRemembered}
                  checked={ageChecked}
                  onToggle={() => setAgeChecked((was) => !was)}
                />

                {primary ? (
                  <ProviderButton
                    tone={providerTone(primary) ?? { background: theme.tint, text: theme.onTint }}
                    icon={
                      primary.isDevelopmentStandIn ? null : (
                        <SocialLogo provider={primary.provider} size={KAKAO_LOGO} />
                      )
                    }
                    label={providerLabel(primary, showRemembered ? 'continue' : 'start')}
                    hint={
                      primary.isDevelopmentStandIn
                        ? '실제 카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                        : null
                    }
                    disabled={busy || !canSignInWith(primary) || ageBlocked}
                    onPress={() => signIn(primary, { ageAcknowledged: ageChecked })}
                  />
                ) : null}

                <ThemedText type="f13" themeColor="textAssistive" style={styles.terms}>
                  {showRemembered ? (
                    '이 기기에서 로그인을 유지하고 있어요'
                  ) : (
                    <>
                      시작하면 <PolicyLink id="terms" />과 <PolicyLink id="privacy" />에 동의하게 돼요
                    </>
                  )}
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

function remainingLine(weddingDate: string): string {
  const remaining = dDay(weddingDate);

  return remaining.kind === 'upcoming' ? `예식까지 ${remaining.days}일 남았어요` : remaining.text;
}

function AgeConfirmRow({
  visible,
  checked,
  onToggle,
}: {
  visible: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  if (!visible) return null;

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
          { borderBottomColor: theme.line },
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
            : { borderWidth: Border.checkbox, borderColor: theme.track },
        ]}>
        {checked ? <ProductSymbol name="check" size={12} color={theme.onTint} /> : null}
      </View>
      <ThemedText type="f15" themeColor="textSecondary" style={styles.grow}>
        {AGE_CONFIRM_LABEL}
      </ThemedText>
    </Pressable>
  );
}

/** 기억된 계정 카드(WP-AUTH-008) — 규격서에 없는 기존 정본. 값은 옛 시안 그대로(아바타 40 · 로고 18 · 배지 좌우 9). */
function RememberedAccountCard({ account }: { account: RememberedAccount }) {
  const theme = useTheme();

  return (
    <View style={styles.accountWrap}>
      <View style={[styles.account, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.avatar, { backgroundColor: SocialColors.kakao.background }]}>
          <SocialLogo provider="kakao" size={AVATAR_LOGO} />
        </View>

        <View style={styles.accountText}>
          <ThemedText type="f16" numberOfLines={1} style={styles.bold}>
            {KAKAO_PROVIDER_NAME}
          </ThemedText>
          {account.email ? (
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>
              {maskEmail(account.email)}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.badge, { backgroundColor: theme.tintSubtle }]}>
          <ThemedText type="f12" themeColor="tint" style={styles.bold}>
            {RECENT_LOGIN_BADGE}
          </ThemedText>
        </View>
      </View>
    </View>
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

/* 규격서 고정값 — 카카오 로고 20(«span 20×20»). 기억된 계정 카드는 옛 시안 — 로고 18 · 배지 좌우 9 · 카드 안쪽 16/18. */
const KAKAO_LOGO = 20;
const AVATAR_LOGO = 18;
const BADGE_PADDING_X = 9;
const ACCOUNT_PADDING_Y = 16;
const ACCOUNT_PADDING_X = 18;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { flexGrow: 1 },
  brandBlock: {
    flex: 1,
    paddingTop: 88,
    paddingHorizontal: Layout.gutter,
  },
  markBox: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontWeight: 700, lineHeight: LineHeight.t1, letterSpacing: LetterSpacing.n064 },
  sub: { lineHeight: LineHeight.lh24, marginTop: 10 },
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
  section: { gap: Layout.cardGap },
  ageConfirmRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: Border.hairline,
  },
  ageCheck: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
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
  terms: { textAlign: 'center', paddingTop: 6, lineHeight: LineHeight.lh19 },
  busy: { alignItems: 'center', justifyContent: 'center', minHeight: Layout.ctaSheet },
  accountWrap: {},
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
  badge: { paddingVertical: Spacing.one, paddingHorizontal: BADGE_PADDING_X, borderRadius: Radius.badge },
  policyLink: { fontWeight: 700, textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  bold: { fontWeight: 700 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
