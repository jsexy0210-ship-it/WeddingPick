import { StyleSheet } from 'react-native';

import { CircleLoader, Spacing, ThemedText, ThemedView, useDelayedVisible } from '@weddingpick/ui';

/**
 * 로그인 진행 표시의 문구. **이 파일에만 있다.**
 *
 * 예전에는 로그인 화면(`app/login/index.tsx`)이 같은 문장을 따로 적어, 부팅 화면과
 * 로그인 화면이 한 프레임에 겹치는 순간 같은 말이 두 번 보였다(2026-09-09 보고).
 *
 * **제공자 이름이 빠졌다**(2026-09-15 대표 지시). 「카카오로 로그인하는 중이에요」와
 * 「Apple로 로그인하는 중이에요」 둘을 이 하나로 합쳤다 — 남아 있던 영문 `Apple`도
 * 이걸로 같이 없어진다(사용자 화면 영문 금지).
 */
export const SIGNING_IN_MESSAGE = '로그인 중이에요';

/**
 * 로그인 진행 표시. **로더가 위, 문구가 아래다. 둘 다 가운데.**
 *
 * ```
 *        ○            기본 로더(원형) — 위
 *  로그인 중이에요      그 아래 한 줄
 * ```
 *
 * 2026-09-15 대표 지시 — 「로더는 텍스트 위에 가운데에 배치한다. 또 이상한데 배치하지
 * 말고」. 왼쪽 정렬 · 나란히 놓기 · 문구 옆에 로더 붙이기는 전부 아니다.
 *
 * **[폐기] 「한 가지만 보인다」**(2026-09-11). 그때는 `show: 'message' | 'loader'` 타입이
 * 「하나만」을 강제했는데, 위 지시로 뒤집혔다. 대표님이 나중에 내린 지시가 앞선다.
 *
 * **그때 왜 하나로 줄였는지가 지금도 함정이다.** 문구는 즉시 그려지고 로더는 700ms 뒤에
 * 끼어든다 — 문구가 먼저 자리를 잡았다가 로더가 나타나며 아래로 밀려서, 한 자리에 두
 * 개가 겹쳐 나오는 것으로 읽혔다(2026-09-11 보고).
 *
 * **그래서 둘을 «한 덩어리»로 묶었다.** 700ms를 여기서 **한 번** 재고, 그 전에는 둘 다
 * 그리지 않는다 — 순서대로 등장할 자리가 없다. `DelayedLoader`(제 안에서 또 700ms를
 * 재는 것)를 쓰지 않는 이유가 이것이다. 두 번 재면 로더만 더 늦게 나타난다.
 *
 * 이 성질은 `signing-in-view.test.tsx`가 지킨다 — 글로만 적으면 또 깨진다.
 *
 * `size`는 자리에 따라 다르다 — 화면 전체는 40, 로그인 화면 버튼 자리는 28.
 */
export function SigningInBody({ size, active = true }: { size: 28 | 40; active?: boolean }) {
  const visible = useDelayedVisible(active);

  // 둘 다 없거나 둘 다 있다. 하나만 있는 순간을 만들지 않는다.
  if (!visible) return null;

  return (
    <ThemedView style={styles.block}>
      <CircleLoader size={size} />
      <ThemedText type="small" themeColor="textAssistive" style={styles.message}>
        {SIGNING_IN_MESSAGE}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * 카카오에서 같은 창으로 돌아온 직후, 코드를 세션으로 바꾸는 동안 보이는 화면.
 *
 * 스플래시가 아니다 — 스플래시는 앱이 켜지는 신호라, 카카오 동의를 마치고 돌아온
 * 사람이 그걸 다시 보면 «처음부터 다시 시작하나» 하고 읽는다(2026-09-08 보고).
 * 로그인 화면의 진행 표시와 같은 모양으로, 이어지는 한 단계라는 것만 보인다.
 */
export function SigningInView() {
  return (
    <ThemedView style={styles.container}>
      <SigningInBody size={40} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /* 로더와 문구가 한 덩어리 — 가로 가운데, 세로도 두 줄이 함께 가운데. */
  block: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  message: { textAlign: 'center' },
});
