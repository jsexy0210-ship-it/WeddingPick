import {
  PAYMENT_PROOF_CONSENT_POINTS,
  PAYMENT_PROOF_RETENTION_HOURS,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSettings, grantPaymentConsent } from '@/api/client';
import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

/**
 * 결제인증 제보 — 동의.
 *
 * 화면데이터구조 스펙 8.1: 포괄 동의("결제 정보를 수집합니다")는 동의가 아니다.
 * 무엇을 가져가고 무엇을 버리는지 적지 않으면, 동의한 사람도 자기가 무엇에
 * 동의했는지 모른다.
 *
 * 문구를 화면에 박지 않고 도메인에서 가져온다. 동의받은 내용과 실제로 하는 일이
 * 갈라지면 안 되고, 갈라지지 않게 하는 방법은 한 곳에만 적는 것이다.
 */
export default function PaymentProofConsentScreen() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * 이미 동의한 사람은 이 화면을 지나지 않는다. 핸드오프 10번 — **최초 1회만.**
   * 매번 같은 안내를 읽게 하면 그건 안내가 아니라 관문이 된다.
   */
  useEffect(() => {
    void getSettings()
      .then((settings) => {
        if (settings.paymentConsent) router.replace('/capture/payment/register');
      })
      // 못 물어보면 그냥 보여준다. 동의 화면을 한 번 더 보는 것이 최악은 아니다.
      .catch(() => undefined);
  }, []);

  async function agree() {
    setSending(true);
    setError(null);

    try {
      /*
       * 동의를 서버에 남긴 뒤에 넘어간다. 화면만 지나가게 두면 "동의했다"는 사실이
       * 어디에도 없고, 설정의 철회는 지울 것이 없는 단추가 된다.
       */
      await grantPaymentConsent();
      router.replace('/capture/payment/register');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '동의를 저장하지 못했습니다.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Pick 인증 자료를 올리기 전에</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              서류 전체가 아니라 금액을 확인할 수 있는 자료만 받습니다. 카드 승인 문자나 영수증이면 됩니다.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            {PAYMENT_PROOF_CONSENT_POINTS.map((point) => (
              <ThemedView key={point} type="backgroundElement" style={styles.card}>
                <ThemedText type="small">{point}</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary">
              올려주신 이미지는 {PAYMENT_PROOF_RETENTION_HOURS}시간 안에 지워집니다. 지운
              기록은 따로 남겨 나중에 확인할 수 있게 합니다.
            </ThemedText>
            {error ? (
              <ThemedText type="small" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}

            <ActionButton
              variant="primary"
              label="동의하고 계속"
              disabled={sending}
              onPress={agree}
            />
            <ActionButton label="그만두기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
});
