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
  ThemedText,
  ThemedView,
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
import { CheckDot } from '@/features/settings/my-kit';
import { SigningInBody, signingInMessage } from '@/features/auth/signing-in-view';
import { useSignIn } from '@/features/auth/use-sign-in';
import { openExternal } from '@/features/open-external';

/**
 * 로그인 — 규격서 docs/figma-spec/login.txt(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 430×932  pad 64 24 32 24
 *     p "WEDDING, LESS OVERWHELMING" · 10/400 primary · lh 15 · ls 2.4px   ← **넣지 않는다**(아래)
 *     h1 "결정은 가볍게, 준비는 단단하게." · 42/700 #1A1C20 · lh 45 · ls -1.05px · mar 20 0 0 0
 *     p "흩어진 웨딩 정보를 …" · 15/400 #868B94 · lh 28 · mar 20 0 0 0 · (max-w 300)
 *     div 382×82  pad 20 · mar 48 0 0 0 · bg #EE8888 6% · r28 · border 1 #E4868D 15%
 *       div flex · gap 12 · align center
 *         span 40×40 "✦" · 18/400 #FFFFFF · lh 28 · bg primary · r9999
 *         p "나에게 맞는 순서부터" · 14/700 · lh 20      p "예산, 지역, 날짜를 기준으로 시작해요" · 12/400 #868B94 · mar 2 0 0 0
 *     div 382×132  pad 40 0 0 0
 *       button 382×56  "카카오로 3초 만에 시작하기" · 15/700 #191600 · lh 23 · gap 8 · bg #FEE500 · r16
 *         span 20×20 "k" …(카카오 심볼 자리)
 *       p "시작하면 웨딩픽 이용약관과 개인정보 처리방침에 동의하게 됩니다." · 11/400 #868B94 · lh 20 · mar 16 0 0 0
 *
 * **규격서와 다르게 둔 것과 근거.**
 * - **영문 eyebrow(`WEDDING, LESS OVERWHELMING`)는 넣지 않는다 — 되살리지 마라.**
 *   2026-09-15 대표 지시 「위와 같이 온보딩, 전체 메뉴에 이런 형식에 맞지 않는 화면 있으면
 *   싹다 찾아서 삭제해」다. 한국어로 옮기는 것도 아니고 **줄째 없앤다.** 제목은 규격서와
 *   같은 자리에 둔다 — eyebrow가 차지하던 높이를 위 여백으로 돌렸다
 *   (`Layout.headTopLogin` = 64 + lh 15 + mar 20 = 99). `extract-figma-spec.mjs`를 다시
 *   돌리면 규격서에는 영문이 되살아나므로, 「규격서에 있는데 왜 없냐」며 되돌리지 않는다.
 * - 안내 카드 면 `#EE8888 6%` · 테두리 `#E4868D 15%`는 토큰에 없다 — 색은 MASTER 몫이라 `tintSurface` ·
 *   `tintBorder`로 두고 PR에 보고했다.
 * - 카카오 단추 안의 «k» 글자 배지는 카카오 공식 심볼(`SocialLogo`)로 그린다 — 카카오 로그인 버튼 디자인
 *   가이드가 요구하는 자리라 글자로 대신하지 않는다. 크기(20)와 사이(8)는 규격서다.
 * - 애플 · 개발용 제공자, 만 14세 확인, 기억된 계정 카드(WP-AUTH-008)는 규격서에 없는 기존 정본이라
 *   그대로 둔다(CLAUDE.md 3번). 카카오 단추 규격(56 · r16 · 15/700)을 같이 쓴다.
 */

const HERO_TITLE = '결정은 가볍게,\n준비는 단단하게.';
const HERO_SUB = '흩어진 웨딩 정보를 한곳에 모아, 우리에게 맞는 선택만 남겨드릴게요.';
const CALLOUT_MARK = '✦';
const CALLOUT_TITLE = '나에게 맞는 순서부터';
const CALLOUT_BODY = '예산, 지역, 날짜를 기준으로 시작해요';

const AGE_CONFIRM_LABEL = '만 14세 이상이에요';
const AGE_CONFIRM_NOTICE = '만 14세 이상인지 확인하면 시작할 수 있어요';

/** WP-AUTH-008 마지막 계정 카드의 배지 — strings.ko.json `onboarding.auth.remember.recentLabel`. */
const RECENT_LOGIN_BADGE = '최근 로그인';
/** 카드 첫 줄 — 로그인 방법 이름. 초기 버전은 카카오만이다. */
const KAKAO_PROVIDER_NAME = '카카오';

export default function LoginScreen() {
  const theme = useTheme();
  const { providers, error: loadError } = useAuthProviders();
  const { signIn, busy, busyProvider, error, retry, dismissError, reportError, needsAgeConfirm } =
    useSignIn();
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
  /* 만 14세 확인이 필요한데 아직 안 눌렀으면 어느 제공자든 시작하지 않는다. */
  const ageBlocked = needsAgeConfirm && !ageChecked;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {showRemembered && remembered ? (
            <>
              <ThemedText type="f42" style={styles.title}>
                {remembered.displayName ? `${remembered.displayName}님,\n` : ''}다시 오셨네요
              </ThemedText>
              {remembered.weddingDate ? (
                <ThemedText type="f15" themeColor="textAssistive" style={styles.sub}>
                  {remainingLine(remembered.weddingDate)}
                </ThemedText>
              ) : null}

              <RememberedAccountCard account={remembered} />
            </>
          ) : (
            <>
              <ThemedText type="f42" style={styles.title}>
                {HERO_TITLE}
              </ThemedText>
              <ThemedText type="f15" themeColor="textAssistive" style={styles.sub}>
                {HERO_SUB}
              </ThemedText>
              <View style={[styles.callout, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
                <View style={[styles.calloutMark, { backgroundColor: theme.tint }]}>
                  <ThemedText type="f18" themeColor="onTint">
                    {CALLOUT_MARK}
                  </ThemedText>
                </View>
                <View style={styles.calloutText}>
                  <ThemedText type="f14" style={styles.bold}>
                    {CALLOUT_TITLE}
                  </ThemedText>
                  <ThemedText type="f12" themeColor="textAssistive" style={styles.calloutBody}>
                    {CALLOUT_BODY}
                  </ThemedText>
                </View>
              </View>
            </>
          )}

          {/* «div 382×132 · pad 40 0 0 0» — 단추와 약관. */}
          <View style={styles.authBlock}>
            {providers === null || remembered === undefined || busy ? (
              <ThemedView style={styles.busy}>
                {/*
                  문구   지금 로그인을 진행 중이고(`busy`), 그 말을 이 화면이 맡았을 때
                  로더   그 밖 — 제공자·기억된 계정을 읽어오는 중이거나, 문구는 부팅 화면이 맡았을 때
                  문장은 `SigningInBody` 한 곳에만 있고, 누가 말하는지는 `bootOwnsSigningInMessage()`가 정한다.
                */}
                <SigningInBody
                  size={28}
                  show={busy && !bootOwnsSigningInMessage() ? 'message' : 'loader'}
                  message={signingInMessage(busyProvider)}
                />
              </ThemedView>
            ) : (
              <View style={styles.section}>
                <AgeConfirmRow
                  visible={needsAgeConfirm}
                  checked={ageChecked}
                  onToggle={() => setAgeChecked((was) => !was)}
                />

                {options.map((provider) => {
                  /* 시안 #27h — 기억된 계정의 카카오 «계속하기»는 로고 없는 ctaPrimary다. 애플은 심사지침 때문에 마크를 지우지 않는다. */
                  const plain = showRemembered && provider.provider !== 'apple';
                  const tone = plain ? { background: theme.tint, text: theme.onTint } : (providerTone(provider) ?? { background: theme.tint, text: theme.onTint });

                  return (
                    <ProviderButton
                      key={provider.provider}
                      tone={tone}
                      icon={
                        provider.isDevelopmentStandIn || plain ? null : (
                          <SocialLogo provider={provider.provider} size={KAKAO_LOGO} />
                        )
                      }
                      label={providerLabel(provider, showRemembered ? 'continue' : 'start')}
                      hint={
                        provider.isDevelopmentStandIn
                          ? '실제 카카오 로그인이 아니에요. 개발 중인 서버에만 있어요'
                          : null
                      }
                      disabled={busy || !canSignInWith(provider) || ageBlocked}
                      onPress={() => signIn(provider, { ageAcknowledged: ageChecked })}
                    />
                  );
                })}

                <ThemedText type="f11" themeColor="textAssistive" style={styles.terms}>
                  {showRemembered ? (
                    '이 기기에서 로그인을 유지하고 있어요'
                  ) : (
                    <>
                      시작하면 <PolicyLink id="terms" />과 <PolicyLink id="privacy" />에 동의하게 돼요
                    </>
                  )}
                </ThemedText>
              </View>
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
        <ThemedText type="f15" style={[styles.providerLabel, { color: tone.text }]}>
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
  if (!visible) return null;

  return (
    <View style={styles.ageConfirm}>
      <ThemedText type="f12" themeColor="textSecondary">
        {AGE_CONFIRM_NOTICE}
      </ThemedText>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={AGE_CONFIRM_LABEL}
        onPress={onToggle}
        style={styles.ageConfirmRow}>
        <CheckDot on={checked} />
        <ThemedText type="f14" themeColor="textStrong" style={styles.grow}>
          {AGE_CONFIRM_LABEL}
        </ThemedText>
      </Pressable>
    </View>
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
        void openExternal(url);
      }}>
      {policy.title}
    </ThemedText>
  );
}

/* 규격서 고정값 — 카카오 로고 20(«span 20×20»). 기억된 계정 카드는 옛 시안 — 로고 18 · 배지 좌우 9 · 카드 안쪽 16/18. */
const KAKAO_LOGO = 20;
/** 부제 `max-w-[300px]` — 규격서 «p 300×56». */
const SUB_MAX_WIDTH = 300;
const AVATAR_LOGO = 18;
const BADGE_PADDING_X = 9;
const ACCOUNT_PADDING_Y = 16;
const ACCOUNT_PADDING_X = 18;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  /* «pad 64 24 32 24». */
  content: {
    flexGrow: 1,
    paddingTop: Layout.headTopLogin,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.five,
  },
  /* «10/400 · ls 2.4px». */
  /* «42/700 · lh 45 · ls -1.05px» — «mar 20»은 위 여백에 합쳐졌다(eyebrow 삭제). */
  title: { fontWeight: 700, letterSpacing: LetterSpacing.n105 },
  /* «15/400 · lh 28 · mar 20 0 0 0 · max-w 300». */
  sub: { lineHeight: LineHeight.lh28, marginTop: Layout.listGap, maxWidth: SUB_MAX_WIDTH },
  /* «pad 20 · mar 48 0 0 0 · r28 · border 1 · gap 12». */
  callout: {
    marginTop: Spacing.four + Spacing.four,
    borderRadius: Radius.callout,
    borderWidth: Border.hairline,
    padding: Layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
  },
  /* «span 40×40 · r9999». */
  calloutMark: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutText: { flex: 1, minWidth: 0 },
  /* «12/400 · mar 2 0 0 0». */
  calloutBody: { marginTop: Spacing.half },
  /* «pad 40 0 0 0». */
  authBlock: { paddingTop: Spacing.five + Spacing.two, gap: Layout.cardGap },
  section: { gap: Layout.cardGap },
  /* 확인 행 — 안내 한 줄 위, 체크 행 아래. 사이 10. */
  ageConfirm: { gap: Layout.cardGap },
  ageConfirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Layout.rowPaddingY },
  grow: { flex: 1 },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  /* «button 382×56 · gap 8 · r16». */
  provider: {
    height: Layout.ctaSheet,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  /* «15/700 · lh 23». */
  providerLabel: { fontWeight: 700, lineHeight: LineHeight.lh23 },
  hint: { textAlign: 'center', marginTop: Spacing.one },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  /* «11/400 · lh 20 · mar 16 0 0 0 · 가운데». 단추와의 사이는 section gap 10 + 6. */
  terms: { textAlign: 'center', marginTop: Spacing.three - Layout.cardGap, lineHeight: LineHeight.lh20 },
  busy: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  /* 기억된 계정 카드 — 옛 시안 lastWrap 위 28. */
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
  badge: { paddingVertical: Spacing.one, paddingHorizontal: BADGE_PADDING_X, borderRadius: Radius.badge },
  policyLink: { fontWeight: 700, textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  bold: { fontWeight: 700 },
});
