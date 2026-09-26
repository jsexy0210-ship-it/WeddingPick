import type { AuthProvider } from '@weddingpick/api-contract';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { CircleLoader, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { useAuthProgressVisible } from '@/features/loading/auth-progress';

/**
 * «카카오로 로그인하는 중이에요»는 **이 파일에만 있다.**
 *
 * 예전에는 로그인 화면(`app/login/index.tsx`)이 같은 문장을 따로 적어, 부팅 화면과
 * 로그인 화면이 한 프레임에 겹치는 순간 같은 말이 두 번 보였다(2026-09-09 보고).
 * 문장을 한 군데로 모으고, 누가 이 말을 하는지도 한 곳에서 정한다 — 부팅이
 * 말하는 동안 로그인 화면은 말하지 않는다(`owner` 참고).
 */
export const SIGNING_IN_MESSAGE = '카카오로 로그인하는 중이에요';
/** 애플 차례. 제공자가 둘이 되면서 문장도 둘이 됐다 — 자리는 여전히 이 파일 하나다. */
export const APPLE_SIGNING_IN_MESSAGE = 'Apple로 로그인하는 중이에요';

/**
 * 어느 제공자로 로그인하는 중인지에 맞는 한 줄.
 *
 * 애플을 눌렀는데 «카카오로 로그인하는 중»이라고 적히면, 사용자는 자기가 잘못
 * 눌렀다고 읽는다. 개발용 대체는 서버가 `apple` 자리에 얹어 보내지만 실제 애플이
 * 아니라 기본 문장을 쓴다. 아직 모르는 상태(null)도 기본이다 — 부팅이 잇는 것은
 * 카카오 리다이렉트뿐이다.
 */
export function signingInMessage(provider: AuthProvider | null | undefined): string {
  if (provider?.provider === 'apple' && !provider.isDevelopmentStandIn) {
    return APPLE_SIGNING_IN_MESSAGE;
  }

  return SIGNING_IN_MESSAGE;
}

/**
 * 로그인 · 약관 동의 · 온보딩 사이의 기다림 화면 — **원형 고리 하나**(2026-09-26 대표 지시 —
 * 「스플래시 → 카카오 로그인 → 로더가 두 번 돈다. 로더 써클만 돌도록 통합한다」).
 *
 *   고리 40 — RN 정본 `docs/design/React_Native/common.js:244` `spinBig`(40 · 테두리 3 ·
 *            #EAEBEE 트랙 · 스킨 색 머리 · 900ms) = `CircleLoader size={40}`
 *   문구    — 고리 **아래** 한 줄(CLAUDE.md 「로그인은 기본 로더 위·문구 아래로 한 덩어리」).
 *            `message={null}`이면 고리만(약관 동의 제출 · 온보딩 첫 읽기)
 *
 * **전에는 모양이 둘이었다.** 부팅의 카카오 복귀는 숨쉬는 원형 뼈대(`DelayedLoader
 * shape="mark"`), 로그인 화면은 문구만, 스플래시 뒤에는 홈 뼈대가 한 번 스쳤다 — 한 번의
 * 로그인에 로더가 모양을 바꿔 가며 두 번 섰다. 이제 이 화면 하나가 로그인 단추를 누른
 * 순간(웹은 카카오에서 돌아온 새 페이지의 첫 HTML부터 — `app/+html.tsx`)부터 약관 동의 폼이
 * 설 때까지 같은 자리에 선다.
 *
 * **고리 자리는 처음부터 잡아 둔다.** 700ms 규칙(`features/loading/auth-progress`)으로 고리가
 * 늦게 나타나도 문구가 밀려 내려가지 않는다 — 2026-09-11 「문구가 먼저 자리를 잡았다가 로더가
 * 나타나면서 아래로 밀린다」가 다시 생기지 않게.
 *
 * 700ms는 이 화면이 뜬 때가 아니라 **흐름이 시작된 때**부터 센다 — 화면이 갈아 끼워져도
 * 이미 보인 고리는 그대로 보이고, 각도도 이어 돈다(`spinPhaseMs`).
 */
export function SigningInView({ message = SIGNING_IN_MESSAGE }: { message?: string | null }) {
  const visible = useAuthProgressVisible();

  useEffect(() => {
    /* 웹 첫 HTML이 그려 둔 같은 모양(`+html.tsx` `AUTH_RETURN_STATIC_ID`)은 이 화면이 서면 걷는다. */
    removeStaticAuthReturn();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.circleSlot}>{visible ? <CircleLoader size={40} /> : null}</View>
      {message ? (
        <ThemedText type="small" themeColor="textAssistive">
          {message}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

/**
 * 화면 위에 덮는 같은 기다림 — **700ms가 지나기 전에는 아무것도 그리지 않는다**(빈 흰 판으로
 * 폼을 가리지 않는다). 약관 동의 «동의하고 시작하기»를 누른 뒤 서버 답을 기다리는 자리가 쓴다.
 */
export function SigningInOverlay({ active }: { active: boolean }) {
  const visible = useAuthProgressVisible();

  if (!active || !visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <SigningInView message={null} />
    </View>
  );
}

/** 웹 첫 HTML의 «로그인하는 중» 판(`app/+html.tsx`). 한 곳에서 이름을 정한다. */
export const AUTH_RETURN_STATIC_ID = 'wp-auth-return';

/** 웹 첫 HTML이 그려 둔 판을 걷는다. 없거나 네이티브면 아무것도 안 한다. */
export function removeStaticAuthReturn(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.getElementById(AUTH_RETURN_STATIC_ID)?.remove();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  circleSlot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
