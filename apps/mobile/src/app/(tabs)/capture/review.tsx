import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import type { CapturedPage } from '@/features/capture/types';

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
 * A-05 문서 확인. 분석에 넘기기 전에 장 단위로 다시 찍거나 뺄 수 있게 한다.
 */
export default function ReviewScreen() {
  const { pages, removePage, clearDraft } = useCaptureDraft();

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
              {page.mimeType.startsWith('image/') ? (
                <Image source={{ uri: page.uri }} style={styles.thumbnail} contentFit="cover" />
              ) : (
                <ThemedView type="backgroundSelected" style={[styles.thumbnail, styles.fileIcon]}>
                  <ThemedText type="code">PDF</ThemedText>
                </ThemedView>
              )}

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
            label="분석 시작"
            hint="AI 분석 연결은 다음 단계입니다"
            disabled
            onPress={() => {}}
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
  thumbnail: {
    width: 56,
    height: 72,
    borderRadius: Spacing.two,
  },
  fileIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
});
