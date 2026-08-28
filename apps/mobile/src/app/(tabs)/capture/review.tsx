import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { PageThumbnail } from '@/components/page-thumbnail';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import type { CapturedPage } from '@/features/capture/types';
import { useDocumentStore } from '@/features/documents/document-store';

const SOURCE_LABEL: Record<CapturedPage['source'], string> = {
  camera: '촬영',
  library: '사진',
  file: 'PDF',
};

function formatSize(bytes?: number) {
  if (!bytes) return null;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/**
 * A-05 문서 확인. 저장하기 전에 장 단위로 다시 찍거나 뺄 수 있게 한다.
 */
export default function ReviewScreen() {
  const { pages, removePage, clearDraft } = useCaptureDraft();
  const { saveDraft } = useDocumentStore();
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);

    try {
      const saved = await saveDraft(pages);
      clearDraft();
      router.replace(`/wedding/${saved.id}`);
    } catch {
      Alert.alert('저장 실패', '문서를 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (pages.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">확인할 문서가 없습니다</ThemedText>
          <ActionButton variant="primary" label="촬영하러 가기" onPress={() => router.back()} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="code" themeColor="textSecondary">
            A-05 · PHASE 1
          </ThemedText>
          <ThemedText type="subtitle">{pages.length}장 확인</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            글씨가 잘리거나 흐린 장이 있으면 빼고 다시 찍어주세요.
          </ThemedText>
        </ThemedView>

        <ScrollView contentContainerStyle={styles.list}>
          {pages.map((page, index) => (
            <ThemedView key={page.id} type="backgroundElement" style={styles.row}>
              <PageThumbnail page={page} />

              <ThemedView type="backgroundElement" style={styles.rowText}>
                <ThemedText type="smallBold">
                  {index + 1}. {page.name ?? `${SOURCE_LABEL[page.source]} ${index + 1}`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[SOURCE_LABEL[page.source], formatSize(page.sizeBytes)]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </ThemedView>

              <Pressable
                accessibilityLabel={`${index + 1}번째 문서 빼기`}
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => removePage(page.id)}>
                <ThemedText type="small" themeColor="textSecondary">
                  빼기
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))}
        </ScrollView>

        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            label={saving ? '저장 중…' : '내 웨딩에 저장'}
            hint="AI 분석 연결 전까지는 문서만 보관합니다"
            disabled={saving}
            onPress={save}
          />
          <ActionButton label="장 추가하기" onPress={() => router.push('/capture/camera')} />
          <ActionButton
            label="전부 지우기"
            onPress={() => {
              clearDraft();
              router.back();
            }}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  footer: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
});
