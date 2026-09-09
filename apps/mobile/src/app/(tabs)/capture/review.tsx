import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ensureSignedIn } from '@/api/auth';
import { ApiError } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { ActionButton, Layout, Spacing, ThemedText, showAlert } from '@weddingpick/ui';
import { PageThumbnail } from '@/components/page-thumbnail';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import type { CapturedPage } from '@/features/capture/types';
import { uploadForAnalysis } from '@/features/capture/upload';
import { useDocumentStore } from '@/features/documents/document-store';
import { Dock, DockButton, Hero, ListRow, NavBar, NoteCard, Screen, Section } from '@/features/wedding/screen-kit';

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
 * 문서 확인 — 견적서 정리 흐름. 저장하기 전에 장 단위로 다시 찍거나 뺄 수 있게 한다.
 *
 *   nav     «문서 확인» · 오른쪽 «장 추가»
 *   hero    «N장을 확인해주세요» · «글씨가 잘리거나 흐린 장이 있으면 빼고 다시 찍어주세요»
 *   행      썸네일 52 · «1. 촬영 1» 18/24 · «촬영 · 320KB» · 오른쪽 «빼기»
 *   dock    «기기에만 저장» + «정리 시작»(서버가 있을 때)
 */
export default function ReviewScreen() {
  const { pages, removePage, clearDraft } = useCaptureDraft();
  const { saveDraft } = useDocumentStore();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  async function analyze() {
    if (analyzing) return;
    setAnalyzing(true);

    try {
      await ensureSignedIn();
      const { analysisId } = await uploadForAnalysis(pages);

      clearDraft();
      router.replace(`/capture/analysis/${analysisId}`);
    } catch (error) {
      // 로그인이 없어서 막힌 것이면 실패라고 말하지 말고 로그인으로 보낸다.
      if (error instanceof ApiError && error.code === 'unauthenticated') {
        router.push('/login');
        return;
      }

      showAlert('정리를 시작하지 못했어요', (error as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);

    try {
      const saved = await saveDraft(pages);

      clearDraft();
      router.replace(`/wedding/${saved.id}`);
    } catch {
      showAlert('저장하지 못했어요', '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (pages.length === 0) {
    return (
      <Screen>
        <NavBar title="문서 확인" fallback="/capture" />
        <Hero title="확인할 문서가 없어요" sub="촬영하거나 앨범에서 골라 넣어주세요" />
        <Dock>
          <DockButton variant="primary" label="촬영하러 가기" onPress={() => router.replace('/capture/camera')} />
        </Dock>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar
        title="문서 확인"
        fallback="/capture"
        right={{ label: '장 추가', brand: true, onPress: () => router.push('/capture/camera') }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={`${pages.length}장을 확인해주세요`} sub="글씨가 잘리거나 흐린 장이 있으면 빼고 다시 찍어주세요" />

        <Section>
          {pages.map((page, index) => (
            <ListRow
              key={page.id}
              left={<PageThumbnail page={page} />}
              title={`${index + 1}. ${page.name ?? `${SOURCE_LABEL[page.source]} ${index + 1}`}`}
              sub={[SOURCE_LABEL[page.source], formatSize(page.sizeBytes)].filter(Boolean).join(' · ')}
              subLines={1}
              right={
                <Pressable
                  accessibilityLabel={`${index + 1}번째 문서 빼기`}
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={() => removePage(page.id)}>
                  <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                    빼기
                  </ThemedText>
                </Pressable>
              }
            />
          ))}
        </Section>

        <View style={styles.noteWrap}>
          <NoteCard
            title="계약서는 받지 않아요"
            body="비밀유지 조항이 있는 경우가 있어 법률 확인이 끝날 때까지 미뤄두었어요. 견적서만 올려주세요."
          />
        </View>

        <View style={styles.clear}>
          <ActionButton
            variant="ghost"
            size="large"
            label="전부 지우기"
            onPress={() => {
              clearDraft();
              router.back();
            }}
          />
        </View>
      </ScrollView>

      <Dock>
        <DockButton
          label={saving ? '저장 중…' : '기기에만 저장'}
          disabled={saving || analyzing}
          onPress={() => void save()}
        />
        {isServerConfigured ? (
          <DockButton
            variant="primary"
            label={analyzing ? '올리는 중…' : '정리 시작'}
            disabled={analyzing || saving}
            onPress={() => void analyze()}
          />
        ) : null}
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  clear: { paddingHorizontal: Layout.gutter },
  bold: { fontWeight: 700 },
});
