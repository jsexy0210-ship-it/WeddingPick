import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Layout, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import { createPage } from '@/features/capture/pickers';

/** 화질 경고를 판단하는 최소 픽셀 수 (너비×높이). 이 미만이면 흐릿할 수 있다는 안내를 보인다. */
const QUALITY_MIN_PIXELS = 480 * 640;

/**
 * A-04의 카메라 입력. 한 건의 견적서가 여러 장인 경우가 많아 연속 촬영을 기본으로 둔다.
 */
export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { pages, addPages } = useCaptureDraft();
  const cameraRef = useRef<CameraView>(null);
  const [shooting, setShooting] = useState(false);
  /**
   * 촬영 직후 품질 경고. 해상도가 기준 미만이면 "흐릿할 수 있어요" 안내를 보인다.
   * 사용자가 다음 촬영을 시작하거나 화면을 닫으면 사라진다.
   */
  const [qualityHint, setQualityHint] = useState(false);
  const { width } = useWindowDimensions();
  /* 3:4 비율 — 문서가 세로로 긴 형태라 이 비율이 잘림을 줄인다 */
  const guideWidth = Math.min(width * 0.8, 300);
  const guideHeight = (guideWidth * 4) / 3;
  /** 모서리 마커 한 변의 길이 (dp). 짧을수록 덜 답답하다. */
  const cornerLen = 24;

  if (!permission) {
    return <ThemedView style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.permissionArea}>
          <ThemedText type="subtitle">카메라 권한이 필요해요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            문서를 촬영해 분석하려면 카메라 접근을 허용해주세요.
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
    setQualityHint(false);

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });

      if (photo) {
        addPages([createPage('camera', { uri: photo.uri, mimeType: 'image/jpeg' })]);

        /*
         * 화질 경고: 너비×높이가 기준 미만이면 흐릿할 수 있다는 안내를 보인다.
         * 최신 스마트폰에서는 거의 발생하지 않지만, 구형 기기나 제한된 카메라
         * 권한 환경에서는 낮은 해상도가 나올 수 있다.
         */
        const pixels = (photo.width ?? 0) * (photo.height ?? 0);
        if (pixels > 0 && pixels < QUALITY_MIN_PIXELS) {
          setQualityHint(true);
        }
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
            {pages.length > 0 ? `${pages.length}장 촬영됨` : '자료를 가이드 안에 맞춰주세요'}
          </ThemedText>
        </View>

        {/*
          3:4 문서 가이드 프레임.
          테두리 전체 대신 네 모서리 L형 마커를 강조한다 — 같은 정보를
          더 가볍게 전달하고, 가이드 바깥도 답답하지 않게 보인다.
        */}
        <View style={styles.guideCenter} pointerEvents="none">
          <View style={{ width: guideWidth, height: guideHeight }}>
            {/* 모서리 마커 — 각 꼭짓점에 L형 선 두 개씩 */}
            {/* 왼쪽 위 */}
            <View style={[styles.cornerH, { top: 0, left: 0, width: cornerLen }]} />
            <View style={[styles.cornerV, { top: 0, left: 0, height: cornerLen }]} />
            {/* 오른쪽 위 */}
            <View style={[styles.cornerH, { top: 0, right: 0, width: cornerLen }]} />
            <View style={[styles.cornerV, { top: 0, right: 0, height: cornerLen }]} />
            {/* 왼쪽 아래 */}
            <View style={[styles.cornerH, { bottom: 0, left: 0, width: cornerLen }]} />
            <View style={[styles.cornerV, { bottom: 0, left: 0, height: cornerLen }]} />
            {/* 오른쪽 아래 */}
            <View style={[styles.cornerH, { bottom: 0, right: 0, width: cornerLen }]} />
            <View style={[styles.cornerV, { bottom: 0, right: 0, height: cornerLen }]} />
          </View>
        </View>

        {/* 촬영 후 품질 경고 — 해상도가 기준 미만일 때만 보인다 */}
        {qualityHint ? (
          <View style={styles.qualityHintBar} pointerEvents="none">
            <ThemedText type="t7" style={styles.overlayText}>
              사진이 흐릿할 수 있어요. 다시 찍어도 돼요.
            </ThemedText>
          </View>
        ) : null}

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
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  guideCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * 모서리 L형 마커 — 수평 바.
   * borderColor는 rgba(255,255,255,0.6) — 토큰 spec/tokens.json 카메라 가이드 60% 불투명.
   */
  cornerH: {
    position: 'absolute',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  /** 모서리 L형 마커 — 수직 바. */
  cornerV: {
    position: 'absolute',
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  /** 촬영 후 품질 경고 바. 화면 하단 중앙에 표시된다. */
  qualityHintBar: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
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
    borderRadius: Radius.pill,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    borderColor: 'rgba(0, 0, 0, 0.25)',
  },
  doneButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  overlayText: {
    color: '#ffffff',
  },
});
