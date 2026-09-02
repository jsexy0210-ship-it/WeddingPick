import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
} from '@weddingpick/ui';
import { hasTaste, loadTaste, saveTaste, toggleTaste, type Taste } from '@/features/home/taste';
import { TastePicker } from '@/features/home/taste-picker';

/**
 * 취향 다시 고르기. WP-MY-004, 부모 WP-MY-003(내 웨딩 설정).
 *
 * 홈의 취향 고르기(WP-SHT-009)와 같은 격자를 그대로 쓴다 — 고르는 방식을 두 번
 * 만들지 않는다. 다른 점은 하나, 이미 고른 것이 채워져 있고 «저장»이 있다는 것.
 */
export default function PreferencesScreen() {
  const [taste, setTaste] = useState<readonly Taste[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void loadTaste().then(setTaste);
  }, []);

  function onToggle(picked: Taste) {
    setTaste((current) => toggleTaste(current, picked));
  }

  async function save() {
    setSaving(true);

    try {
      await saveTaste(taste);
      setToast('취향을 저장했어요. 홈 추천이 곧 바뀌어요');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">취향 다시 고르기</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              어떤 결혼식을 원하세요? 고른 사진으로 추천을 다시 맞춰드려요
            </ThemedText>
          </ThemedView>

          <TastePicker chosen={taste} onToggle={onToggle} />

          <ThemedView style={styles.footer}>
            <ActionButton
              variant="primary"
              label={saving ? '저장하는 중…' : '저장'}
              disabled={!hasTaste(taste) || saving}
              onPress={() => void save()}
            />
            <ActionButton label="취소" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <Toast
        message={toast}
        onHidden={() => {
          setToast(null);
          router.back();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: { gap: Spacing.one },
  footer: { gap: Spacing.two, marginTop: Spacing.two },
});
