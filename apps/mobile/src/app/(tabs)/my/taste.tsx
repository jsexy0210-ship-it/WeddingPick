import { STYLE_PICK_LIMIT_TOAST, STYLE_PICK_MIN, type WeddingStyle } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, completeSetup, getCurrentUser } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { STEP_DESCRIPTION, STEP_TITLE_LINES } from '@/features/onboarding/flow';
import { InlineToast, useInlineToast } from '@/features/onboarding/inline-toast';
import { QuestionHead } from '@/features/onboarding/question-head';
import { StyleGrid } from '@/features/onboarding/style-grid';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { ActionButton, Layout, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

/**
 * 스타일 다시 고르기. WP-MY-004.
 *
 * MY 탭에서 들어와 온보딩 5/5에서 고른 스타일을 다시 고른다. 규칙은 온보딩과 같다
 * (SPEC §13.6 «스타일 4종 · 최대 2개») — 같은 `StyleGrid` · 최소 1 · 최대 2 · 3번째는
 * 토스트. **진입 시 지금 고른 값을 서버에서 읽어 복원한다** — 초기화하지 않는다.
 *
 * 저장은 `completeSetup`이다 — 예식일 · 지역은 계약이 요구하는 키라 읽어 둔 값을 그대로
 * 돌려보내고(지우지 않는다), 준비 현황 · 예산은 키를 보내지 않아 서버가 건드리지 않는다.
 * 저장하면 홈 추천이 갱신된다는 사실을 안내한 뒤 이전 화면으로 돌아간다.
 */
type Loaded = {
  weddingDate: string | null;
  region: string | null;
  chosen: readonly WeddingStyle[];
};

export default function StyleScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const limitToast = useInlineToast();

  useEffect(() => {
    void getCurrentUser()
      .then((me) => setLoaded({ weddingDate: me.weddingDate, region: me.region, chosen: me.styleTags }))
      .catch((caught) => setError(caught instanceof Error ? caught.message : LOAD_ERROR));
  }, []);

  async function handleSave() {
    if (!loaded || loaded.chosen.length < STYLE_PICK_MIN || saving) return;

    setSaving(true);
    setError(null);

    try {
      await completeSetup({
        weddingDate: loaded.weddingDate,
        region: loaded.region,
        styleTags: [...loaded.chosen],
      });
      confirmAlert('스타일 저장 완료', '고른 스타일로 홈 추천이 새로 만들어져요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return error ? (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.message}>
            <ThemedText type="t7" themeColor="negative" style={styles.error}>
              {error}
            </ThemedText>
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </View>
        </SafeAreaView>
      </ThemedView>
    ) : (
      <DelayedLoadingView />
    );
  }

  const count = loaded.chosen.length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <QuestionHead lines={STEP_TITLE_LINES.style} description={STEP_DESCRIPTION.style} />

          <StyleGrid
            chosen={loaded.chosen}
            onChange={(next) => setLoaded({ ...loaded, chosen: next })}
            onLimited={() => limitToast.show(STYLE_PICK_LIMIT_TOAST)}
          />

          {error ? (
            <ThemedText type="t7" themeColor="negative" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>
            <View style={styles.cancel}>
              <ActionButton size="xlarge" label="취소" onPress={() => router.back()} />
            </View>
            {/* 최소 1개 — 온보딩과 같은 유일한 필수. CTA에 고른 수를 적는다. */}
            <View style={styles.save}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={saving ? '저장 중…' : `${count}개 저장`}
                disabled={saving || count < STYLE_PICK_MIN}
                onPress={() => void handleSave()}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <InlineToast toast={limitToast.toast} onHidden={limitToast.hide} />
    </ThemedView>
  );
}

const LOAD_ERROR = '지금 고른 스타일을 불러오지 못했어요.';
const SAVE_ERROR = '저장하지 못했어요.';

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
  },
  message: { padding: Layout.gutter, gap: Spacing.three },
  error: { textAlign: 'center', paddingHorizontal: Layout.gutter },
  /* 시안 dock — 좌우 24 · [취소] [저장] 사이 8 · 주 행동이 1.4배 넓다(step-frame과 같은 비율). */
  actions: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Layout.gutter, paddingTop: Spacing.two },
  cancel: { flex: 1 },
  save: { flex: 1.4 },
});
