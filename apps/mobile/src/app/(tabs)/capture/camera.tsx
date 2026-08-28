import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import { createPage } from '@/features/capture/pickers';

/**
 * A-04의 카메라 입력. 한 건의 견적서가 여러 장인 경우가 많아 연속 촬영을 기본으로 둔다.
 */
export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { pages, addPages } = useCaptureDraft();
  const cameraRef = useRef<CameraView>(null);
  const [shooting, setShooting] = useState(false);

  if (!permission) {
    return <ThemedView style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.permissionArea}>
          <ThemedText type="subtitle">카메라 권한이 필요합니다</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            견적서·계약서를 촬영해 분석하려면 카메라 접근을 허용해주세요.
          </ThemedText>
          <ActionButton variant="primary" label="권한 허용하기" onPress={requestPermission} />
          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  async function takePicture() {
    if (shooting) return;
    setShooting(true);

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });

      if (photo) {
        addPages([createPage('camera', { uri: photo.uri, mimeType: 'image/jpeg' })]);
      }
    } catch {
      Alert.alert('촬영 실패', '다시 시도해주세요.');
    } finally {
      setShooting(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="smallBold" style={styles.overlayText}>
              닫기
            </ThemedText>
          </Pressable>
          <ThemedText type="small" style={styles.overlayText}>
            {pages.length > 0 ? `${pages.length}장 촬영됨` : '견적서를 화면에 맞춰주세요'}
          </ThemedText>
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            accessibilityLabel="촬영"
            accessibilityRole="button"
            disabled={shooting}
            onPress={takePicture}
            style={({ pressed }) => [styles.shutter, { opacity: pressed || shooting ? 0.6 : 1 }]}
          />
          {pages.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/capture/review')}
              hitSlop={12}
              style={styles.doneButton}>
              <ThemedText type="smallBold" style={styles.overlayText}>
                {pages.length}장 확인하기
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  bottomBar: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    borderColor: 'rgba(0, 0, 0, 0.25)',
  },
  doneButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  overlayText: {
    color: '#ffffff',
  },
});
