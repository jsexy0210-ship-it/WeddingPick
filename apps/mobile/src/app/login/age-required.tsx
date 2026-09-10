import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { ActionButton, Layout, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { AuthBackButton } from '@/features/auth/auth-back-button';



/**
 * WP-AUTH-009 이용 불가 안내. 핸드오프 v3.25 시안 27-login #27j.
 *
 * **번호가 WP-AUTH-009에서 WP-AUTH-009로 당겨졌다**(CHANGELOG v3.24) — 옛
 * WP-AUTH-009(나이 확인)가 폐기되면서 빈 번호를 이 화면이 이어받았다. 화면이
 * 바뀐 것이 아니라 이름이 바뀐 것이다.
 *
 * 로그인 화면(WP-AUTH-001)의 «만 14세 이상이에요»를 누르지 않고 카카오를 누르면 온다.
 *
 * 시안 `27-login.dc.html` #27j —
 *
 *   navBack   56 · 좌우 12 · 뒤로 40
 *   formBody  회색 아이콘 64 원 · 제목 26 2줄 · 안내 박스 2줄
 *   dock      «돌아가기» ghost
 *
 * **v3.25에서 문구가 줄었다.** 이유 3줄 불릿을 없애고 안내 박스 두 줄만 남긴다 —
 * «만 14세»가 화면에 세 번 나오던 것을 한 번으로 줄인 것이 그 변경의 요지다
 * (CHANGELOG v3.24 «이용 불가 안내 문구 축소»). 지운 문장을 되살리지 않는다.
 *
 * 시안의 둘째 줄은 «출생 연도는 삭제했어요»인데 **«연령대»로 적는다** — 나이 판정을
 * 연령대로 확정했고(2026-09-10 사용자 지시) 출생 연도는 아예 받지 않는다. 받지도
 * 않은 것을 지웠다고 말할 수는 없다.
 *
 * **거부 화면이 아니라 안내 화면이다.** CTA를 coral로 두지 않는다(§3.5 "화면
 * 규칙"). 카카오 로그인 자체를 시작하지 않으므로 계정도 소셜 프로필도 만들지
 * 않는다 — "입력값을 즉시 지웠다"고 말할 입력값이 애초에 없다.
 *
 * 근거 — 이용약관 제4조 · 개인정보처리방침 8항.
 */
export default function AgeRequiredScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.nav}>
          <AuthBackButton onPress={() => router.replace('/login')} />
        </View>

        <View style={styles.body}>
          <View style={[styles.iconBox, { backgroundColor: theme.backgroundSelected }]}>
            <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke={theme.textAssistive} strokeWidth={1.8} />
              <Path d="M12 8v4.5" stroke={theme.textAssistive} strokeWidth={1.8} strokeLinecap="round" />
              <Path d="M12 16h.01" stroke={theme.textAssistive} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </View>

          <ThemedText type="t2">
            만 14세가 되면{'\n'}웨딩픽을 이용할 수 있어요
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.tip}>
            <ThemedText type="t5">계정은 만들지 않았어요</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              연령대는 삭제했어요.
            </ThemedText>
          </ThemedView>
        </View>

        <ThemedView
          style={[styles.dock, { borderTopColor: theme.border, paddingBottom: Spacing.five + Math.max(insets.bottom, 0) }]}>
          {/* 안내 화면이라 coral을 쓰지 않는다 — variant="secondary"가 회색 톤이다. */}
          <ActionButton variant="secondary" size="xlarge" label="돌아가기" onPress={() => router.replace('/login')} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* 시안 고정값 — 아이콘 원 64 · 아이콘 32 · nav 좌우 12 · 안내 박스 상하 18. */
const ICON_BOX = 64;
const ICON = 32;
const NAV_PADDING_X = 12;
const TIP_PADDING_Y = 18;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  /* 시안 navBack — 56 · 좌우 12. */
  nav: { height: Layout.navBar, justifyContent: 'center', paddingHorizontal: NAV_PADDING_X },
  /* 시안 formBody — flex 1 · 위 8 · 좌우 24 · 사이 20. */
  body: {
    flex: 1,
    paddingTop: Spacing.two,
    paddingHorizontal: Layout.gutter,
    gap: Layout.listGap,
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  /* 시안 blockWrap — 위 4 · 줄 사이 10 · 점과 글자 사이 10. */
  /* 시안 noteBox — radius 10 · 안쪽 18/20 · 사이 6. */
  tip: {
    borderRadius: Radius.medium,
    paddingVertical: TIP_PADDING_Y,
    paddingHorizontal: Layout.cardPadding,
    gap: Spacing.two - Spacing.half,
  },
  /* 시안 dock — 위 1px 선 · 위 12 · 좌우 24 · 아래 32 + 안전 영역. */
  dock: {
    borderTopWidth: 1,
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
  },
});
