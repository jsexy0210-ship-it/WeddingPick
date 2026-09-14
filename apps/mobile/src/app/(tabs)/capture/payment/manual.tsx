import {
  PAYMENT_PROOF_FIELD_LABEL,
  claimablePaymentProofFields,
  type PaymentProofField,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { claimPaymentProofFields } from '@/api/client';
import { Layout, Spacing, ThemedText } from '@weddingpick/ui';
import strings from '../../../../../../../spec/strings.ko.json';
import { Dock, DockButton, Field, Hero, NavBar, Screen } from '@/features/wedding/screen-kit';

/** 문구는 `spec/strings.ko.json` `report.manual.*`에서 온다 — 루트 시안 `WP-RPT-제보·후기` 12c. */
const R = strings.report;

const S = {
  nav: R['manual.title'],
  hero: R['manual.hero'],
  sub: R['manual.sub'],
  retake: R['manual.retake'],
  cta: R['manual.cta'],
  sending: R['manual.sending'],
  doneTitle: R['manual.done'],
  doneSub: R['manual.kept'],
  doneCta: '확인',
} as const;

/** 「2026-05-20」 → ISO. 시각을 모르면 그날 정오로 둔다 — 자정은 날짜 경계에 걸린다. */
function toTimestamp(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const parsed = new Date(`${day}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** 세 자리마다 쉼표. 숫자가 아닌 것은 들어오지 못한다. */
function comma(raw: string): string {
  return raw
    .replace(/[^0-9]/g, '')
    .slice(0, 12)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Pick 인증 — 직접 입력(WP-RPT-004 「인식 실패」). 루트 시안 `WP-RPT-제보·후기` 12c.
 *
 *   nav «직접 입력» · hero «사진이 흐려서 읽지 못했어요» · 못 읽은 칸만 입력
 *   · 「사진 다시 찍기」 · dock «제보하기»
 *
 * **v3.24가 이 화면을 폐기했고, 2026-09-14 대표 지시로 되살렸다** — 「실패하면 사람이
 * 직접 등록한다」. 폐기 당시의 형태가 아니라 세 가지가 다르다(0240).
 *
 *   1. **사진을 낸 뒤에만 열린다.** 대상이 이미 접수된 내 제보이므로, 이 화면에
 *      들어왔다는 것 자체가 자료를 올렸다는 뜻이다. 증빙 없이 금액만 받던 화면
 *      (폐기된 WP-RPT-010)은 되살리지 않는다 — 여기에는 그 길이 없다.
 *   2. **못 읽은 칸만 묻는다.** 무엇을 물을지는 서버가 정한 `pendingFields`이고,
 *      기계가 읽어낸 칸은 화면에 서지 않는다.
 *   3. **적었다고 반영되지 않는다.** 보내고 나면 「확인 후 반영해요」다. 기준금액은
 *      실 제보의 중앙값이라, 확인 안 된 값이 그 계산에 들어가면 「실 제보」라는 말
 *      자체가 거짓이 된다.
 *
 * **걸리는 시간을 적지 않는다.** 「하루 안에」라고 적어두면 하루가 지난 뒤부터 그
 * 줄은 거짓말이 되고, 우리는 그것을 모른다.
 */
export default function ManualPaymentProofScreen() {
  /*
   * 어느 제보의 어느 칸인지는 앞 화면이 넘겨준다. `fields`는 서버가 준
   * `pendingFields`를 그대로 실어온 것이고, 화면이 스스로 고르지 않는다.
   */
  const params = useLocalSearchParams<{ paymentProofId?: string; fields?: string }>();

  const asked = claimablePaymentProofFields({
    pendingFields: (params.fields ?? '').split(',').filter((field): field is PaymentProofField =>
      (PAYMENT_PROOF_FIELD_LABEL as Record<string, string>)[field] !== undefined
    ),
  });

  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const paidAt = toTimestamp(day);
  const paidAmount = Number(amount.replace(/[^\d]/g, ''));

  /* 물어본 칸이 다 찼는가. 묻지 않은 칸은 보지 않는다 — 읽은 값이 이미 들어 있다. */
  const filled = asked.every((field) =>
    field === 'merchantName'
      ? merchantName.trim().length > 0
      : field === 'paidAmount'
        ? paidAmount > 0
        : field === 'paidAt'
          ? paidAt !== null
          : true
  );

  async function submit() {
    if (!params.paymentProofId || !filled || sending) return;

    setSending(true);
    setError(null);

    try {
      await claimPaymentProofFields(params.paymentProofId, {
        /* 물어본 칸만 보낸다. 읽어낸 칸까지 실어 보내면 서버가 거절한다. */
        ...(asked.includes('merchantName') ? { merchantName: merchantName.trim() } : {}),
        ...(asked.includes('paidAmount') ? { paidAmount } : {}),
        ...(asked.includes('paidAt') && paidAt ? { paidAt } : {}),
      });

      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '보내지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <NavBar title={S.nav} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero title={S.doneTitle} sub={S.doneSub} />
        </ScrollView>
        <Dock>
          <DockButton
            variant="primary"
            label={S.doneCta}
            onPress={() => router.replace('/my/reports' as never)}
          />
        </Dock>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar title={S.nav} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={S.hero} sub={S.sub} />

        {/* 못 읽은 칸만 선다. 순서는 도메인이 정한다 — 화면마다 달라지지 않게. */}
        <View style={styles.fields}>
          {asked.map((field) => {
            const label = PAYMENT_PROOF_FIELD_LABEL[field];

            if (field === 'merchantName') {
              return (
                <Field
                  key={field}
                  label={label}
                  value={merchantName}
                  onChangeText={setMerchantName}
                  placeholder="가온예식홀"
                  maxLength={120}
                />
              );
            }

            if (field === 'paidAmount') {
              return (
                <Field
                  key={field}
                  label={label}
                  value={amount}
                  onChangeText={(next) => setAmount(comma(next))}
                  placeholder="3,000,000"
                  keyboardType="number-pad"
                />
              );
            }

            if (field === 'paidAt') {
              return (
                <Field
                  key={field}
                  label={label}
                  value={day}
                  onChangeText={setDay}
                  placeholder="2026-05-20"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  hint={day.length > 0 && paidAt === null ? '2026-05-20 형태로 적어주세요' : null}
                  hintColor="negative"
                />
              );
            }

            return null;
          })}
        </View>

        {/* 시안의 보조 행동 — 적는 대신 다시 찍는 길도 남겨둔다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={S.retake}
          disabled={sending}
          onPress={() => router.replace('/capture/payment/register' as never)}
          style={({ pressed }) => [styles.retake, pressed && styles.pressed]}>
          <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
            {S.retake}
          </ThemedText>
        </Pressable>

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <Dock>
        <DockButton
          variant="primary"
          label={sending ? S.sending : S.cta}
          disabled={!filled || sending}
          onPress={() => void submit()}
        />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  /* 입력 칸 사이 16 — 루트 시안 12c «gap:16». */
  fields: { paddingHorizontal: Layout.gutter, gap: Spacing.four },
  /* 「사진 다시 찍기」 — 시안 «padding:20px 24px 0». */
  retake: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.five },
  error: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.three },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.7 },
});
