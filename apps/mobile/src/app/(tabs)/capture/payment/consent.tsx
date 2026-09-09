import { PAYMENT_PROOF_CONSENT_POINTS, PAYMENT_PROOF_RETENTION_HOURS } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getSettings, grantPaymentConsent } from '@/api/client';
import { Layout, Spacing, ThemedText } from '@weddingpick/ui';
import { CheckBox, Dock, DockButton, Hero, ListRow, NavBar, NoteCard, Screen, Section } from '@/features/wedding/screen-kit';

/**
 * Pick 인증 — 권한 · 동의(최초 1회). 시안 11-report-review #12a 두 번째 화면의 앞단.
 *
 *   nav      «Pick 인증»
 *   hero     «자료를 올리기 전에» · «금액을 확인할 수 있는 자료만 받아요»
 *   동의 행   체크 24 · 항목 18/24 — 전체 동의 한 줄 + 개별
 *   note     원본은 24시간 안에 삭제(SPEC 5.4 — 알리는 3곳 중 첫째)
 *   dock     «동의하고 계속»
 *
 * 포괄 동의(«결제 정보를 수집합니다»)는 동의가 아니다. 무엇을 가져가고 무엇을 버리는지
 * 적지 않으면 동의한 사람도 자기가 무엇에 동의했는지 모른다. 문구는 도메인에서 가져온다 —
 * 동의받은 내용과 실제로 하는 일이 갈라지지 않게 한 곳에만 적는다.
 * 이미 동의한 사람은 이 화면을 지나지 않는다 — 매번 같은 안내를 읽게 하면 관문이 된다.
 */
export default function PaymentProofConsentScreen() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(PAYMENT_PROOF_CONSENT_POINTS.map(() => false));

  const allChecked = checked.every(Boolean);

  useEffect(() => {
    void getSettings()
      .then((settings) => {
        if (settings.paymentConsent) router.replace('/capture/payment/register');
      })
      // 못 물어보면 그냥 보여준다. 동의 화면을 한 번 더 보는 것이 최악은 아니다.
      .catch(() => undefined);
  }, []);

  function toggle(index: number) {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function toggleAll() {
    setChecked(PAYMENT_PROOF_CONSENT_POINTS.map(() => !allChecked));
  }

  async function agree() {
    if (!allChecked) return;
    setSending(true);
    setError(null);

    try {
      /* 동의를 서버에 남긴 뒤에 넘어간다. 화면만 지나가게 두면 «동의했다»는 사실이 어디에도 없다. */
      await grantPaymentConsent();
      router.replace('/capture/payment/register');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '동의를 저장하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <NavBar title="Pick 인증" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title="자료를 올리기 전에" sub="서류 전체가 아니라 금액을 확인할 수 있는 자료만 받아요" />

        <Section label="동의">
          <ListRow
            left={<CheckBox checked={allChecked} />}
            title="전체 동의"
            titleBold
            accessibilityLabel={`전체 동의 ${allChecked ? '켬' : '끔'}`}
            onPress={toggleAll}
          />
          {PAYMENT_PROOF_CONSENT_POINTS.map((point, index) => (
            <ListRow
              key={point}
              left={<CheckBox checked={checked[index] ?? false} />}
              title={point}
              titleLines={4}
              accessibilityLabel={`${point} ${checked[index] ? '켬' : '끔'}`}
              onPress={() => toggle(index)}
            />
          ))}
        </Section>

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.noteWrap}>
          <NoteCard
            title={`원본은 ${PAYMENT_PROOF_RETENTION_HOURS}시간 안에 지워요`}
            body="확인이 끝나면 금액과 업체만 남기고, 지운 기록은 따로 남겨 나중에 확인할 수 있게 해요."
          />
        </View>
      </ScrollView>

      <Dock>
        <DockButton
          variant="primary"
          label={sending ? '저장 중…' : '동의하고 계속'}
          disabled={!allChecked || sending}
          onPress={() => void agree()}
        />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
});
