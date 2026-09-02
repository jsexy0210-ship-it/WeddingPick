import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { useCaptureDraft } from '@/features/capture/capture-draft';
import { PermissionDeniedError, pickFromLibrary, pickPdf } from '@/features/capture/pickers';
import type { CapturedPage } from '@/features/capture/types';

/**
 * 제보.
 *
 * 사업계획서 v3 8번이 이 자리를 하단 내비게이션 가운데(Primary Action)에 뒀다.
 * 웨딩홀·스드메는 공공데이터가 없어 제보로만 자료가 쌓이기 때문이다.
 *
 * **결제인증이 앞이고 견적서가 뒤다.** v3 6번이 계약서 원본 업로드를 P1에서 뺐다 —
 * 웨딩홀 약관의 비밀유지 조항(위약벌 계약금 2배)이 확인됐고, 그 위험을 지는 쪽이
 * 이 앱을 쓴 사용자다. 결제내역에는 계약 조건이 없어 그 조항이 걸리지 않는다.
 */
/**
 * 어떤 서류를 받고 어떤 서류를 왜 안 받는지.
 *
 * v3.13 §O-10이 사용자 UI에서 `견적서`·`계약서`를 막았지만 **여기는 그 이름이 있어야
 * 뜻이 통하는 자리**다. 둘 다 `자료`라고 적으면 "자료는 받고 자료는 안 받습니다"가
 * 되어, 사용자는 무엇을 가져와야 하는지도 무엇이 거절되는지도 알 수 없다.
 * 받지 않는 이유가 법률 확인이라는 것도 사실 그대로 적어야 한다.
 */
const WHAT_WE_READ =
  '견적서를 읽어 항목과 추가비용 후보를 정리해 드려요. ' + // pick-language: 받는 서류 이름
  '계약서는 지금 받지 않아요 — 계약서에 비밀유지 조항이 있는 경우가 있어, ' + // pick-language: 안 받는 서류 이름과 그 이유
  '법률 확인이 끝날 때까지 미뤄두었어요.';

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
      if (error instanceof PermissionDeniedError) {
        // WP-ST-011 — 이미 거부된 권한은 여기서 다시 물어도 소용없다. 설정으로 보낸다.
        Alert.alert('불러오기 실패', error.message, [
          { text: '설정으로 이동', onPress: () => void Linking.openSettings() },
          { text: '닫기', style: 'cancel' },
        ]);
      } else {
        Alert.alert('불러오기 실패', '문서를 불러오지 못했어요. 다시 시도해주세요.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">실제로 내신 금액을 알려주세요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            카드 승인 문자나 영수증이면 돼요. 한 건만 올려주셔도 다른 분들이 실제로
            얼마를 냈는지 보실 수 있어요.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.actions}>
          <ActionButton
            variant="primary"
            label="제보하기"
            hint="안내 문자 캡처도 괜찮아요"
            onPress={() => router.push('/capture/payment/consent')}
          />
        </ThemedView>

        <ThemedView style={styles.actions}>
          <ThemedText type="smallBold">자료 분석</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {WHAT_WE_READ}
          </ThemedText>
          <ActionButton
            label="카메라로 촬영"
            hint="여러 장을 이어서 찍을 수 있어요"
            disabled={busy}
            onPress={() => router.push('/capture/camera')}
          />
          <ActionButton
            label="사진에서 불러오기"
            hint="앨범에 저장해둔 자료 사진"
            disabled={busy}
            onPress={() => runPicker(pickFromLibrary)}
          />
          <ActionButton
            label="PDF 불러오기"
            hint="메일이나 메신저로 받은 자료 파일"
            disabled={busy}
            onPress={() => runPicker(pickPdf)}
          />
        </ThemedView>

        <ThemedView style={styles.actions}>
          <ActionButton
            label="이렇게 찍어주세요"
            hint="잘 읽히는 촬영 방법과 분석 안내"
            onPress={() => router.push('/my/guide')}
          />
          <ActionButton label="샘플 결과 보기" onPress={() => router.push('/capture/sample')} />
        </ThemedView>

        {pages.length > 0 ? (
          <ActionButton
            label={`작성 중인 문서 ${pages.length}장 이어서 보기`}
            onPress={() => router.push('/capture/review')}
          />
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
          지금은 문서가 기기 안에만 저장돼요. 서버로 보내는 분석은 원본 문서 처리에 대한
          법률 검토가 끝난 뒤에 연결해요.
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
