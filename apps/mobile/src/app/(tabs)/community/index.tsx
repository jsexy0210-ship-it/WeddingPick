import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Layout, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

/**
 * 라운지 — Root 4번 탭(2026-09-14 대표 확정 · 라우트 `/community`).
 *
 * **지금은 자리만 있다.** 탭이 다섯으로 확정됐는데 이 라우트가 없으면 네 번째
 * 탭을 누를 때 앱이 멈춘다 — 그래서 네비게이션 쪽에서 빈 자리를 먼저 세웠다.
 * 목록 · 글 · 댓글이 붙는 본 화면은 화면 담당 세션 몫이고, 서버에도 아직 라운지
 * 경로가 없다(`packages/api-contract`에 항목 없음).
 *
 * 이 화면을 채울 때 이 파일을 덮어쓰면 된다. 문구는 `spec/strings.ko.json`
 * `lounge.*`에 있다.
 */
export default function LoungeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="t4">라운지</ThemedText>
        </View>

        <View style={styles.empty}>
          <ThemedText type="t5">이야기를 모으고 있어요</ThemedText>
          <ThemedText type="t6" themeColor="textSecondary" style={styles.emptyBody}>
            열리면 알려드릴게요
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  /* 웨딩노트 홈과 같은 헤더 — 56 · 좌우 24 · 제목 20/27. */
  header: {
    minHeight: Layout.tabBar - Layout.tabBarPaddingTop,
    paddingHorizontal: Layout.gutter,
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  emptyBody: { textAlign: 'center' },
});
