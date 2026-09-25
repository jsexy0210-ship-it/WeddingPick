import {
  VISIT_NOTE_AUDIO_CONSENT_POINTS,
  VISIT_NOTE_AUDIO_CONSENT_VERSION,
} from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  completeConsultationUpload,
  createConsultationUpload,
} from '@/api/client';
import { pickConsultationAudio } from '@/features/capture/pickers';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { ActionButton, Spacing, ThemedText } from '@weddingpick/ui';

import WeddingScreen from '../../index';

const MAX_BYTES = 100 * 1024 * 1024;

export default function ConsultationUploadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { height } = useWindowDimensions();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (uploading) return;
    dismissToOrReplace('/wedding?tab=consult');
  }

  async function uploadAudio() {
    if (uploading) return;

    const picked = await pickConsultationAudio();
    if (!picked) return;

    if (picked.sizeBytes !== undefined && picked.sizeBytes > MAX_BYTES) {
      setError(`파일이 너무 커요. ${Math.floor(MAX_BYTES / 1024 / 1024)}MB까지 올릴 수 있어요.`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const file = await fetch(picked.uri).then((response) => response.blob());
      const target = await createConsultationUpload({
        weddingId: id,
        mimeType: picked.mimeType as never,
        byteSize: file.size,
        consentVersion: VISIT_NOTE_AUDIO_CONSENT_VERSION,
      });
      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': picked.mimeType },
        body: file,
      });

      if (!put.ok) throw new Error(`올리지 못했어요 (${put.status})`);

      await completeConsultationUpload(target.consultationId);
      showResultToast('녹음을 올렸어요');
      dismissToOrReplace('/wedding?tab=consult');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '녹음을 올리지 못했어요.');
    } finally {
      setUploading(false);
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
            label={uploading ? '올리는 중…' : '녹음 올리기'}
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
