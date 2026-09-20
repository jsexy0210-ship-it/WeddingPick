import { StyleSheet, View } from 'react-native';
import { BackBar } from '@/components/back-bar';

import {
  Layout,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

export default function WeddingMapWebScreen() {
  return (
    <ThemedView style={styles.container}>
      <BackBar />
      <View style={styles.content}>
        <ThemedText type="t5" style={styles.title}>
          지도 보기
        </ThemedText>
        <ThemedText type="t7" themeColor="textSecondary" style={styles.desc}>
          지도는 앱에서 이용할 수 있어요.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
    gap: Spacing.two,
    maxWidth: 400,
  },
  title: { textAlign: 'center' },
  desc: { textAlign: 'center', marginBottom: Spacing.two },
});
