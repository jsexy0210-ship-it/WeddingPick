import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { ActionButton, Layout, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { AuthBackButton } from '@/features/auth/auth-back-button';

/**
 * WP-AUTH-009 이용 불가 안내. 핸드오프 v3.24(2026-09-09) — 카카오가 넘긴 출생
 * 연도가 만 14세 미달일 때 온다. 예전 번호는 WP-AUTH-010이었는데, 같은 v3.24에서
 * 구 WP-AUTH-009(나이 확인)가 완전히 삭제되면서 번호를 당겼다.
 *
 * 시안 `27-login.dc.html` #9 —
 *
 *   navBack   56 · 좌우 12 · 뒤로 40
 *   formBody  flex 1 · 위 8 · 좌우 24 · 사이 20
 *             회색 아이콘 64 원(gray100) · 제목 26/35 2줄 · 안내 박스
 *   dock      위 1px 선 · 위 12 · 아래 32 · «돌아가기» 회색 56(토큰 52)
 *
 * **본문 3줄을 v3.24에서 없앴다.** 「만 14세」가 제목 · 이유 · 안내 박스에 세 번
 * 나오던 화면이라 한 번으로 줄였다. 남긴 두 줄은 사용자가 궁금해할 사실 —
 * 계정이 생겼는지, 보낸 값이 남았는지 — 만 답한다.
 *
 * **거부 화면이 아니라 안내 화면이다.** CTA를 coral로 두지 않는다. 계정을 만들기
 * 전에 판정이 끝나므로(`apps/api/src/routes/auth.ts`) 계정도 소셜 프로필도 남지
 * 않고, 판정에 쓴 출생 연도는 `signIn`에 넘기기 전에 버린다.
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
              출생 연도는 삭제했어요.
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
