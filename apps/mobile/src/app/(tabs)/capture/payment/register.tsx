import {
  MASKED_IDENTIFIER_KINDS,
  MASKED_IDENTIFIER_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  canRegisterPaymentProof,
  type MaskedIdentifierKind,
  type PaymentMethod,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerPaymentProof } from '@/api/client';
import {
  ActionButton,
  FilterChip,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/** "2026-05-20" → ISO. 시각을 모르면 그날 정오로 둔다 — 자정은 날짜 경계에 걸린다. */
function toTimestamp(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const parsed = new Date(`${day}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * 결제인증 제보 — 등록.
 *
 * **자동 추출은 아직 없다.** 결제 화면 전용 파서가 만들어지기 전까지는 영수증을
 * 보고 직접 적는다. 읽어주는 척하고 빈칸을 내미느니, 아직 못 읽는다고 말하는
 * 편이 낫다.
 *
 * 카드번호를 적을 칸이 없다. 있었는지만 고른다 — 그 값은 우리가 가질 이유가 없다.
 */
export default function RegisterPaymentProofScreen() {
  const theme = useTheme();

  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [identifiers, setIdentifiers] = useState<MaskedIdentifierKind[]>([]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    matched: boolean;
    note: string | null;
    unlocked: boolean;
    deletedBy: string | null;
  } | null>(null);

  const paidAt = toTimestamp(day);
  const paidAmount = Number(amount.replace(/[^\d]/g, ''));

  const check =
    paidAt === null
      ? { ok: false as const, reason: '결제한 날짜를 2026-05-20 형태로 적어주세요.' }
      : canRegisterPaymentProof({ merchantName, paidAmount, paidAt });

  if (done) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            <ThemedText type="subtitle">등록했습니다</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              {done.matched
                ? '업체를 찾아 이어붙였습니다.'
                : (done.note ?? '업체를 찾지 못했습니다.')}
            </ThemedText>

            {done.unlocked ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">실제 가격이 열렸습니다</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  이제 업체 상세에서 실제 계약 가격과 결제인증 금액을 보실 수 있습니다.
                </ThemedText>
              </ThemedView>
            ) : null}

            <ActionButton
              variant="primary"
              label="업체 찾아보기"
              onPress={() => router.replace('/search')}
            />
            <ActionButton label="제보로 돌아가기" onPress={() => router.replace('/capture')} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  async function submit() {
    if (!paidAt || !check.ok) return;

    setSending(true);
    setError(null);

    try {
      const created = await registerPaymentProof({
        merchantName: merchantName.trim(),
        paidAmount,
        paidAt,
        method,
        maskedIdentifiers: identifiers,
      });

      setDone({
        matched: created.matchedVendorId !== null,
        note: created.unmatchedNote,
        unlocked: created.unlocked,
        deletedBy: created.originalDeletedBy,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '등록하지 못했습니다.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">결제내역을 적어주세요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              결제문자나 영수증을 보고 그대로 적어주시면 됩니다. 아직 사진에서 자동으로
              읽어오지는 못합니다.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">가맹점 이름</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              영수증에 찍힌 그대로. 업체 이름과 달라도 괜찮습니다.
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="예: 가온예식홀"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="가맹점 이름"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">결제 금액</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="예: 3000000"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="결제 금액"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">결제한 날</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={day}
              onChangeText={setDay}
              placeholder="2026-05-20"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="결제한 날"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">결제 수단</ThemedText>
            <ThemedView style={styles.chips}>
              {PAYMENT_METHODS.map((value) => (
                <FilterChip
                  key={value}
                  label={PAYMENT_METHOD_LABEL[value]}
                  selected={method === value}
                  role="radio"
                  onPress={() => setMethod(value)}
                />
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">영수증에 함께 찍힌 것 (선택)</ThemedText>
            {/*
              값이 아니라 종류만 고른다. 카드번호를 적을 칸이 없는 것이 요점이다 —
              그 값은 우리가 가질 이유가 없고, 가지지 않으면 샐 일도 없다.
            */}
            <ThemedText type="small" themeColor="textSecondary">
              무엇이 있었는지만 알려주세요. 번호 자체는 적지 않으셔도 되고, 저희도
              저장하지 않습니다.
            </ThemedText>
            <ThemedView style={styles.chips}>
              {MASKED_IDENTIFIER_KINDS.map((kind) => (
                <FilterChip
                  key={kind}
                  label={MASKED_IDENTIFIER_LABEL[kind]}
                  selected={identifiers.includes(kind)}
                  onPress={() =>
                    setIdentifiers((current) =>
                      current.includes(kind)
                        ? current.filter((value) => value !== kind)
                        : [...current, kind]
                    )
                  }
                />
              ))}
            </ThemedView>
          </ThemedView>

          {error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            {!check.ok && (merchantName.length > 0 || amount.length > 0 || day.length > 0) ? (
              <ThemedText type="small" themeColor="textSecondary">
                {check.reason}
              </ThemedText>
            ) : null}
            <ActionButton
              variant="primary"
              label={sending ? '등록하는 중…' : '결제인증 등록'}
              disabled={!check.ok || sending}
              onPress={() => void submit()}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
});
