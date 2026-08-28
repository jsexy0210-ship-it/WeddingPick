import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import { PermissionDeniedError, pickFromLibrary, pickPdf } from '@/features/capture/pickers';
import type { CapturedPage } from '@/features/capture/types';

/**
 * A-04 촬영.
 * 사업계획서 7번: 카메라 촬영 / 사진 불러오기 / PDF 불러오기 중 하나로 입력받고,
 * 별도 입력폼을 요구하지 않는다.
 */
export default function CaptureScreen() {
  const { pages, addPages } = useCaptureDraft();
  const [busy, setBusy] = useState(false);

  async function runPicker(pick: () => Promise<CapturedPage[]>) {
    if (busy) return;
    setBusy(true);

    try {
      const picked = await pick();

      if (picked.length > 0) {
        addPages(picked);
        router.push('/capture/review');
      }
    } catch (error) {
      const message =
        error instanceof PermissionDeniedError
          ? error.message
          : '문서를 불러오지 못했습니다. 다시 시도해주세요.';
      Alert.alert('불러오기 실패', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="code" themeColor="textSecondary">
            A-04 · PHASE 1
          </ThemedText>
          <ThemedText type="subtitle">견적서를 올려주세요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            찍기만 하면 됩니다. 업체·상품·금액·계약조건은 분석이 읽어냅니다.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.actions}>
          <ActionButton
            variant="primary"
            label="카메라로 촬영"
            hint="여러 장을 이어서 찍을 수 있습니다"
            disabled={busy}
            onPress={() => router.push('/capture/camera')}
          />
          <ActionButton
            label="사진에서 불러오기"
            hint="앨범에 저장해둔 견적서 사진"
            disabled={busy}
            onPress={() => runPicker(pickFromLibrary)}
          />
          <ActionButton
            label="PDF 불러오기"
            hint="메일이나 메신저로 받은 견적서 파일"
            disabled={busy}
            onPress={() => runPicker(pickPdf)}
          />
        </ThemedView>

        {pages.length > 0 ? (
          <ActionButton
            label={`작성 중인 문서 ${pages.length}장 이어서 보기`}
            onPress={() => router.push('/capture/review')}
          />
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
          지금은 문서가 기기 안에만 저장됩니다. 서버 업로드와 AI 분석은 원본 문서 처리에 대한 법률
          검토가 끝난 뒤에 연결합니다.
        </ThemedText>
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
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
  notice: {
    marginTop: 'auto',
    paddingBottom: Spacing.four,
  },
});
