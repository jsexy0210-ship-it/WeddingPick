import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmAlert } from '@/components/confirm-alert';
import {
  hasTaste,
  loadTaste,
  saveTaste,
  toggleTaste,
  type Taste,
} from '@/features/home/taste';
import { TastePicker } from '@/features/home/taste-picker';
import {
  ActionButton,
  Layout,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

/**
 * 취향 다시 고르기. WP-MY-004.
 *
 * MY 탭에서 진입해 기존에 고른 취향을 다시 선택하거나 바꾼다.
 * 저장하면 홈 추천이 갱신된다는 사실을 안내한 뒤 이전 화면으로 돌아간다.
 */
export default function TasteScreen() {
  const [chosen, setChosen] = useState<readonly Taste[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    loadTaste().then(setChosen);
  }, []);

  useEffect(load, [load]);

  function handleToggle(taste: Taste) {
    setChosen((prev) => (prev ? toggleTaste(prev, taste) : [taste]));
  }

  async function handleSave() {
    if (!chosen) return;
    setSaving(true);
    try {
      await saveTaste(chosen);
      confirmAlert(
        '취향 저장 완료',
        hasTaste(chosen)
          ? '선택하신 취향으로 홈 추천이 새로 만들어져요.'
          : '취향을 고르시면 더 맞는 업체를 추천해드려요.',
        [{ text: '확인', onPress: () => router.back() }]
      );
    } catch {
      confirmAlert('저장 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (!chosen) return <LoadingView />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t4">어떤 결혼식을 원하세요?</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              원하는 분위기를 고르면 홈 추천이 맞춰져요. 여러 개 골라도 돼요.
            </ThemedText>
          </ThemedView>

          <TastePicker chosen={chosen} onToggle={handleToggle} />

          <ThemedView style={styles.actions}>
            <ActionButton label="취소" onPress={() => router.back()} />
            <ActionButton
              variant="primary"
              label={saving ? '저장 중…' : '저장하기'}
              onPress={() => void handleSave()}
            />
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
    gap: Spacing.three,
  },
  header: { gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
