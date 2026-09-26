import { VISIT_NOTE_AUDIO_CONSENT_POINTS } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { uploadingLabel } from '@/features/wedding/consult-upload-prompt';
import { uploadConsultationAudio } from '@/features/wedding/consultation-upload';
import { ActionButton, Spacing, ThemedText } from '@weddingpick/ui';

import WeddingScreen from '../../index';

export default function ConsultationUploadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { height } = useWindowDimensions();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (uploading) return;
    dismissToOrReplace('/wedding?tab=consult');
  }

  async function uploadAudio() {
    if (uploading) return;

    setUploading(true);
    setProgress(null);
    setError(null);

    try {
      const result = await uploadConsultationAudio(id, { onProgress: setProgress });
      if (result === 'canceled') return;
      showResultToast('녹음을 올렸어요');
      dismissToOrReplace('/wedding?tab=consult');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '녹음을 올리지 못했어요.');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <View style={styles.host}>
      <WeddingScreen initialTab="consult" />

      <BottomSheet
        visible
        dismissible={!uploading}
        onRequestClose={close}
        style={styles.sheetHost}
        testID="consultation-upload-sheet">
        <SheetPanel style={styles.sheet}>
          <View style={styles.head}>
            <SheetHeader title="상담기록 추가" onClose={close} closeDisabled={uploading} />
            <ThemedText type="t7" themeColor="textSecondary">
              녹음 파일을 올리면 금액과 조건을 정리해드려요.
            </ThemedText>
          </View>

          <ScrollView
            style={{ maxHeight: Math.max(220, height * 0.5) }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            {VISIT_NOTE_AUDIO_CONSENT_POINTS.map((point) => (
              <ThemedText key={point} type="body">
                · {point}
              </ThemedText>
            ))}
            {error ? (
              <ThemedText type="t7" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}
          </ScrollView>

          <ActionButton
            variant="primary"
            size="xlarge"
            label={uploading ? uploadingLabel(progress) : '녹음 올리기'}
            disabled={uploading}
            onPress={() => void uploadAudio()}
          />
          <ActionButton label="취소" disabled={uploading} onPress={close} />
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHost: { flexShrink: 1 },
  sheet: { flexShrink: 1 },
  head: { gap: Spacing.one },
  content: { gap: Spacing.two, paddingBottom: Spacing.two },
});
