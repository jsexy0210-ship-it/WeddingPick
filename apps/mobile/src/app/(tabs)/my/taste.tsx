import { TASTE_MIN_PICKS, TASTE_STEP_TITLE } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUser } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import {
  chosenKeysFor,
  loadTaste,
  saveTaste,
  tasteCategoryFor,
  tasteStepDescription,
  toggleTaste,
  type TasteCategory,
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
 * MY 탭에서 진입해 기존에 고른 취향을 다시 선택하거나 바꾼다. 온보딩 5/5와 같은
 * 규칙이다(SPEC §13.6) — **준비 현황에서 아직 안 끝낸 첫 업종** 한 세트만 묻고,
 * 그 업종의 여섯 장 중 최소 한 장을 받는다. 저장돼 있던 업종이 지금 물을 업종과
 * 다르면(그사이 그 업종을 «이미 정했다»로 바꿨다면) 빈 격자에서 다시 고른다 —
 * 다른 업종의 선택을 체크된 것처럼 그리지 않는다.
 *
 * 저장하면 홈 추천이 갱신된다는 사실을 안내한 뒤 이전 화면으로 돌아간다.
 */
type Loaded = {
  category: TasteCategory;
  chosen: readonly string[];
};

export default function TasteScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    void Promise.all([
      /* 프로필을 못 읽으면 준비 현황을 모르는 것 — 빈 현황(웨딩홀부터)으로 본다. */
      getCurrentUser().catch(() => null),
      loadTaste(),
    ]).then(([me, stored]) => {
      const category = tasteCategoryFor(me?.preparedCategories ?? []);

      setLoaded({ category, chosen: chosenKeysFor(stored, category) });
    });
  }, []);

  useEffect(load, [load]);

  function handleToggle(key: string) {
    setLoaded((prev) => (prev ? { ...prev, chosen: toggleTaste(prev.chosen, key) } : prev));
  }

  async function handleSave() {
    if (!loaded || loaded.chosen.length < TASTE_MIN_PICKS) return;
    setSaving(true);
    try {
      await saveTaste(loaded.category, loaded.chosen);
      confirmAlert('취향 저장 완료', '선택하신 취향으로 홈 추천이 새로 만들어져요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <LoadingView />;

  const count = loaded.chosen.length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            {/* 제목은 업종과 무관하게 하나(v3.21) — 업종명은 설명 줄에 domain이 넣는다. */}
            <ThemedText type="t4">{TASTE_STEP_TITLE}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {tasteStepDescription(loaded.category)}
            </ThemedText>
          </ThemedView>

          <TastePicker category={loaded.category} chosen={loaded.chosen} onToggle={handleToggle} />

          <ThemedView style={styles.actions}>
            <ActionButton label="취소" onPress={() => router.back()} />
            {/* 최소 1장 — 온보딩과 같은 유일한 필수. CTA에 고른 장수를 적는다(SPEC §13.6). */}
            <ActionButton
              variant="primary"
              label={saving ? '저장 중…' : count > 0 ? `${count}장 저장하기` : '1장 이상 골라주세요'}
              disabled={saving || count < TASTE_MIN_PICKS}
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
