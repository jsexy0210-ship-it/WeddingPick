import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { ActionButton, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { AuthBackButton } from '@/features/auth/auth-back-button';

const NOTES = [
  '결혼 준비 서비스라 만 14세부터 쓸 수 있어요',
  '나이는 저장하지 않고 확인만 해요',
  '잘못 골랐다면 뒤로 가서 다시 고를 수 있어요',
];

/**
 * WP-AUTH-010 이용 불가 안내. 통합정책 v3.13 §3.5 — 로그인 화면(WP-AUTH-001)의
 * «만 14세 이상이에요» 체크박스를 체크하지 않고 카카오를 누르면 온다.
 *
 * **거부 화면이 아니라 안내 화면이다.** CTA를 coral로 두지 않는다(§3.5 "화면
 * 규칙"). 카카오 로그인 자체를 시작하지 않으므로 계정도 소셜 프로필도 만들지
 * 않는다 — "입력값을 즉시 지웠다"고 말할 입력값이 애초에 없다.
 *
 * 근거 — 이용약관 제4조 · 개인정보처리방침 8항.
 */
export default function AgeRequiredScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <AuthBackButton onPress={() => router.replace('/login')} />
        </View>

        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <View style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={9} stroke={theme.textAssistive} strokeWidth={1.8} />
                <Path d="M12 8v4.5" stroke={theme.textAssistive} strokeWidth={1.8} strokeLinecap="round" />
                <Path d="M12 16h.01" stroke={theme.textAssistive} strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
            </View>

            <ThemedText type="t3">
              만 14세부터{'\n'}이용할 수 있어요
            </ThemedText>

            <ThemedView style={styles.notes}>
              {NOTES.map((note) => (
                <View key={note} style={styles.noteRow}>
                  <View style={[styles.dot, { backgroundColor: theme.textAssistive }]} />
                  <ThemedText type="t6" themeColor="textSecondary" style={styles.noteText}>
                    {note}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.tip}>
              <ThemedText type="t5">계정을 만들지 않았어요</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                입력한 정보는 저장하지 않고 바로 지웠어요. 만 14세가 되면 다시 시작할 수 있어요.
              </ThemedText>
            </ThemedView>
          </View>

          <View style={styles.authBlock}>
            {/* 안내 화면이라 coral을 쓰지 않는다 — variant="secondary"가 회색 톤이다. */}
            <ActionButton
              variant="secondary"
              size="xlarge"
              label="확인"
              onPress={() => router.replace('/login')}
            />
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  brandBlock: { gap: Spacing.four, paddingTop: Spacing.two },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: { gap: Spacing.two },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  dot: { width: 5, height: 5, marginTop: 9, borderRadius: Radius.pill },
  noteText: { flex: 1 },
  tip: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  authBlock: { flexGrow: 0, flexShrink: 0 },
});
