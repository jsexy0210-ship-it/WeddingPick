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
 * 로그인 진행 표시. 로더 + 한 줄.
 *
 * `size`는 자리에 따라 다르다 — 화면 전체는 40, 로그인 화면 버튼 자리는 28.
 * `message`를 끄면 로더만 남는다: 같은 말을 다른 곳이 이미 하고 있을 때 쓴다.
 */
export function SigningInBody({ size, message = true }: { size: 28 | 40; message?: boolean }) {
  return (
    <>
      <DelayedLoader size={size} />
      {message ? (
        <ThemedText type="small" themeColor="textAssistive">
          {SIGNING_IN_MESSAGE}
        </ThemedText>
      ) : null}
    </>
  );
}

/**
 * 카카오에서 같은 창으로 돌아온 직후, 코드를 세션으로 바꾸는 동안 보이는 화면.
 *
 * 스플래시가 아니다 — 스플래시는 앱이 켜지는 신호라, 카카오 동의를 마치고 돌아온
 * 사람이 그걸 다시 보면 «처음부터 다시 시작하나» 하고 읽는다(2026-09-08 보고).
 * 로그인 화면의 진행 표시와 같은 모양으로, 이어지는 한 단계라는 것만 보인다.
 * 끝나면 온보딩/홈으로 곧장 간다.
 */
export function SigningInView() {
  return (
    <ThemedView style={styles.container}>
      <SigningInBody size={40} />
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
