import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyView, MaxContentWidth, ThemedView } from '@weddingpick/ui';
import { error as errorCopy } from '../../../../spec/strings.ko.json';

/**
 * 없는 주소 공용 화면. expo-router가 어떤 라우트에도 맞지 않는 주소에서 이 파일을 그린다.
 *
 * 2026-09-25 대표 지시로 정본(React_Native)에 없는 앱 화면 52개를 지웠다 — 알림 · 옛 링크 ·
 * 즐겨찾기로 그 주소에 들어오면 흰 화면이나 라우터 기본 영문 화면 대신 이 한 장이 뜬다.
 * 모양은 공용 빈 상태(WP-ST-008 `EmptyView`)이고 할 일은 하나 — 홈으로 돌아간다.
 */
export default function NotFoundScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <EmptyView
          title={errorCopy['notFound.title']}
          actionLabel={errorCopy['notFound.cta']}
          onAction={() => router.replace('/')}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
});
