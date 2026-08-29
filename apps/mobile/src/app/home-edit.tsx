import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_LAYOUT,
  HOME_SECTION_LABEL,
  isVisible,
  loadHomeLayout,
  move,
  saveHomeLayout,
  toggle,
  type HomeLayout,
} from '@/features/home/sections';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 홈 편집. 디자인 핸드오프 6번.
 *
 * D-Day와 다음 일정은 여기 없다 — 고정이다. 오늘 무엇을 해야 하는지가 홈의
 * 이유라, 그 둘까지 숨길 수 있게 두면 홈이 빈 화면이 될 수 있다.
 *
 * 핸드오프는 **끌어서** 옮기라고 적었다. 끌기를 제대로 하려면 라이브러리가
 * 필요한데 지금 넣을 수 없어 단추로 옮긴다. 하는 일은 같고, 스크린 리더로도
 * 쓸 수 있다는 점은 오히려 낫다.
 */
export default function HomeEditScreen() {
  const theme = useTheme();
  const [layout, setLayout] = useState<HomeLayout | null>(null);

  useEffect(() => {
    void loadHomeLayout().then(setLayout);
  }, []);

  if (!layout) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} />
      </ThemedView>
    );
  }

  async function done(next: HomeLayout) {
    setLayout(next);
    await saveHomeLayout(next);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t4">홈 편집</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              순서를 바꾸고, 필요 없는 항목은 숨길 수 있어요
            </ThemedText>
          </ThemedView>

          {layout.order.map((section, index) => (
            <ThemedView key={section} type="backgroundElement" style={styles.row}>
              <ThemedText type="t5" style={styles.grow}>
                {HOME_SECTION_LABEL[section]}
              </ThemedText>

              <ActionButton
                label="위로"
                disabled={index === 0}
                onPress={() => void done(move(layout, section, -1))}
              />
              <ActionButton
                label="아래로"
                disabled={index === layout.order.length - 1}
                onPress={() => void done(move(layout, section, 1))}
              />

              <Switch
                accessibilityLabel={`${HOME_SECTION_LABEL[section]} 표시`}
                value={isVisible(layout, section)}
                trackColor={{ true: theme.tint, false: theme.track }}
                onValueChange={() => void done(toggle(layout, section))}
              />
            </ThemedView>
          ))}

          <ThemedView style={styles.actions}>
            <ActionButton label="초기화" onPress={() => void done(DEFAULT_LAYOUT)} />
            <ActionButton variant="primary" label="완료" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  section: { gap: Spacing.one, marginBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    minHeight: Layout.rowMinHeight,
  },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
});
