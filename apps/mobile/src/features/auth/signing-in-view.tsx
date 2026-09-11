import { StyleSheet } from 'react-native';

import { Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';

/**
 * «카카오로 로그인하는 중이에요»는 **이 파일에만 있다.**
 *
 * 예전에는 로그인 화면(`app/login/index.tsx`)이 같은 문장을 따로 적어, 부팅 화면과
 * 로그인 화면이 한 프레임에 겹치는 순간 같은 말이 두 번 보였다(2026-09-09 보고).
 * 문장을 한 군데로 모으고, 누가 이 말을 하는지도 한 곳에서 정한다 — 부팅이
 * 말하는 동안 로그인 화면은 말하지 않는다(`owner` 참고).
 */
export const SIGNING_IN_MESSAGE = '카카오로 로그인하는 중이에요';

/**
 * 이 자리가 무엇 **하나**를 보여줄 것인가.
 *
 * ```
 * 'message'   문구 한 줄만
 * 'loader'    기본 로더 · 써클만
 * ```
 */
export type SigningInShow = 'message' | 'loader';

/**
 * 로그인 진행 표시. **로더와 문구 중 하나만 세운다.**
 *
 * 2026-09-11 대표 지시 — 「로그인 → 온보딩 진입 사이 카카오로 로그인 관련 텍스트가
 * 중첩되어 나온다. 하나만 나오도록 하라. 단순 텍스트만 나오던지 기본 로더만 나오던지」.
 *
 * 예전에는 이 컴포넌트가 로더와 문구를 **항상 함께** 세웠다. 그런데 문구는 즉시
 * 그려지고 로더는 700ms 규칙 때문에 늦게 끼어든다 — 문구가 먼저 자리를 잡았다가
 * 로더가 나타나면서 아래로 밀린다. 한 자리에 두 개가 겹쳐 나오는 것으로 읽힌다.
 *
 * 그래서 `show`로 하나만 고른다. 둘을 함께 넘길 방법을 두지 않는다 — 값이 두 개뿐인
 * 것이 「하나만」을 타입으로 지키는 방법이다.
 *
 * `size`는 자리에 따라 다르다 — 화면 전체는 40, 로그인 화면 버튼 자리는 28.
 */
export function SigningInBody({ size, show }: { size: 28 | 40; show: SigningInShow }) {
  if (show === 'loader') return <DelayedLoader size={size} />;

  return (
    <ThemedText type="small" themeColor="textAssistive">
      {SIGNING_IN_MESSAGE}
    </ThemedText>
  );
}

/**
 * 카카오에서 같은 창으로 돌아온 직후, 코드를 세션으로 바꾸는 동안 보이는 화면.
 *
 * 스플래시가 아니다 — 스플래시는 앱이 켜지는 신호라, 카카오 동의를 마치고 돌아온
 * 사람이 그걸 다시 보면 «처음부터 다시 시작하나» 하고 읽는다(2026-09-08 보고).
 * 로그인 화면의 진행 표시와 같은 모양으로, 이어지는 한 단계라는 것만 보인다.
 * 끝나면 온보딩/홈으로 곧장 간다.
 *
 * **문구 쪽을 남긴다.** 로더만 두면 700ms 동안 아무것도 없는 흰 화면이 되는데,
 * 카카오 동의를 막 마치고 돌아온 사람에게 빈 화면은 «끊겼나»로 읽힌다. 문구는
 * 즉시 그려지고 기다림이 끝날 때까지 자리를 지킨다.
 */
export function SigningInView() {
  return (
    <ThemedView style={styles.container}>
      <SigningInBody size={40} show="message" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
