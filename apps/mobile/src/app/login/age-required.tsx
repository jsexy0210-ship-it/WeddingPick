import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Layout, MaxContentWidth, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * WP-AUTH-009 만 14세 이용 불가. v3.29 정본
 * `docs/design/React_Native/home.jsx` 3번 화면(`agesStage` ·
 * `agesTitle` · `agesNote` · `dockSingleH`).
 *
 * 로그인 화면(WP-AUTH-001)의 «만 14세 이상이에요»를 누르지 않고 카카오를 누르면 온다.
 *
 * **RN 정본 home.jsx 3번 화면에는 상단 뒤로가기도, 아이콘도, 안내 박스도 없다** —
 * `hbar`(상태바) 바로 아래 `agesStage`(flex:1 · 중앙 정렬 · gap 14 · 좌우 32 ·
 * text-align center) 하나뿐이고 그 안에 제목 한 줄과 안내 한 줄만 있다. 옛
 * `27-login.dc.html`(v3.25) 시안의 상단 뒤로가기 · 회색 아이콘 원 · 안내 박스는
 * v3.29 정본에 없다 — 「정본에 없는 요소는 제거한다」(CLAUDE.md 2026-09-23 대표
 * 지시, 범위는 화면 안 요소까지)를 따라 걷어냈다. 하단 «돌아가기» CTA가 이미
 * 나가는 길을 주므로 상단 뒤로가기는 중복이었다.
 *
 * 시안의 둘째 줄은 «출생 연도는 삭제했어요»인데 **«연령대»로 적는다** — 나이 판정을
 * 연령대로 확정했고(2026-09-10 사용자 지시) 출생 연도는 아예 받지 않는다. 받지도
 * 않은 것을 지웠다고 말할 수는 없다. (home.js 문구 그대로 두 문장을 한 줄로 잇는다 —
 * `agesNote`가 한 span이다.)
 *
 * **거부 화면이 아니라 안내 화면이다.** CTA를 coral로 두지 않는다 — `dockSingleH`
 * 의 `ctaGhostH`가 회색 톤이다. 카카오 로그인 자체를 시작하지 않으므로 계정도
 * 소셜 프로필도 만들지 않는다 — "입력값을 즉시 지웠다"고 말할 입력값이 애초에 없다.
 *
 * 근거 — 이용약관 제4조 · 개인정보처리방침 8항.
 */
export default function AgeRequiredScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.stage}>
          <ThemedText type="t3" style={styles.center}>
            만 14세가 되면{'\n'}웨딩픽을 이용할 수 있어요
          </ThemedText>

          <ThemedText type="f14" themeColor="textSecondary" style={styles.center}>
            계정은 만들지 않았어요. 연령대는 삭제했어요.
          </ThemedText>
        </View>

        <ThemedView style={[styles.dock, { borderTopColor: theme.border }]}>
          {/* 안내 화면이라 coral을 쓰지 않는다 — variant="secondary"가 회색 톤(ctaGhostH)이다. */}
          <ActionButton variant="secondary" size="xlarge" label="돌아가기" onPress={() => router.replace('/login')} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* home.js 고정값 — agesStage gap14·좌우32, dockSingleH flex 0 0 92·좌우24·위12. */
const STAGE_PADDING_X = 32;
const DOCK_HEIGHT = 92;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  /* home.js agesStage — flex:1 · 중앙 정렬 · gap 14 · 좌우 32 · text-align center. */
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.sectionHeadGap,
    paddingHorizontal: STAGE_PADDING_X,
  },
  center: { textAlign: 'center' },
  /* home.js dockSingleH — flex 0 0 92 · 위 1px 선 · 위아래 12 · 좌우 24. */
  dock: {
    minHeight: DOCK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Layout.gutter,
    borderTopWidth: 1,
  },
});
