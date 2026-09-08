import {
  MASKED_IDENTIFIER_KINDS,
  MASKED_IDENTIFIER_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_PROOF_FIELD_LABEL,
  canRegisterPaymentProof,
  type MaskedIdentifierKind,
  type PaymentMethod,
  type PaymentProofField,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parsePaymentText, registerPaymentProof } from '@/api/client';
import { PermissionDeniedError, pickFromLibrary } from '@/features/capture/pickers';
import { uploadPaymentProof } from '@/features/capture/upload';
import type { CapturedPage } from '@/features/capture/types';
import { paramToDay } from '@/features/wedding/expense-day';
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
 * 결제문자를 붙여넣으면 서버가 읽어 채운다. **AI를 부르지 않는다** — 카드사가
 * 기계로 찍어 보내는 글이라 규칙으로 읽힌다(스펙 7.3).
 *
 * 붙여넣기를 앞에 두는 이유가 하나 더 있다: **서버에 이미지가 올라가지 않는다.**
 * 올라가지 않은 것은 새지도, 파기할 일도 없다. 가장 싸고 가장 안전한 길이다.
 *
 * 읽은 값도 그대로 저장하지 않는다. 확신이 낮은 항목은 표시해서 사람이 보게 한다 —
 * 잘못 읽은 값이 확인 없이 분포에 들어가면 읽기 실패보다 나쁘다.
 *
 * 카드번호를 적을 칸이 없다. 있었는지만 고른다 — 그 값은 우리가 가질 이유가 없다.
 */
export default function RegisterPaymentProofScreen() {
  const theme = useTheme();
  /*
   * 지출 추가(WP-OUR-014)에서 «지출 넣고 인증하기»로 오면 적은 값을 그대로 받는다 —
   * 같은 것을 두 번 적지 않게 미리 채울 뿐, 나머지는 그대로다.
   */
  const prefill = useLocalSearchParams<{
    merchantName?: string;
    paidAmount?: string;
    paidAt?: string;
  }>();

  const [merchantName, setMerchantName] = useState(prefill.merchantName ?? '');
  const [amount, setAmount] = useState(() =>
    (prefill.paidAmount ?? '').replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  );
  const [day, setDay] = useState(() => paramToDay(prefill.paidAt) ?? '');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [identifiers, setIdentifiers] = useState<MaskedIdentifierKind[]>([]);

  const [pasted, setPasted] = useState('');
  const [reading, setReading] = useState(false);
  /** 읽어준 값의 열쇠와, 읽어준 그대로인지. 등록할 때 함께 보낸다. */
  const [readingId, setReadingId] = useState<string | null>(null);
  /** 올려둔 원본. 규칙이 못 읽었을 때만 서버가 본다. */
  const [rawDocumentId, setRawDocumentId] = useState<string | null>(null);
  const [asRead, setAsRead] = useState<Record<string, string> | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  /** 서버가 "확신이 낮다"고 짚은 항목. 화면이 그 칸을 강조한다. */
  const [uncertain, setUncertain] = useState<PaymentProofField[]>([]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    matched: boolean;
    note: string | null;
    deepData: boolean;
    deletedBy: string | null;
  } | null>(null);

  const paidAt = toTimestamp(day);
  const paidAmount = Number(amount.replace(/[^\d]/g, ''));

  const check =
    paidAt === null
      ? { ok: false as const, reason: '낸 날짜를 2026-05-20 형태로 적어주세요.' }
      : canRegisterPaymentProof({ merchantName, paidAmount, paidAt });

  if (done) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            <ThemedText type="subtitle">등록했어요</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              {done.matched
                ? '업체를 찾아 이어붙였어요.'
                : (done.note ?? '업체를 찾지 못했어요.')}
            </ThemedText>

            {/*
              제보 금액 구간이 "열렸다"고 말하지 않는다 — 그건 등록 전에도 보였다
              (v2.0 K-6). 여기서 늘어난 것은 조건이 비슷한 사례다.
            */}
            {done.deepData ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">조건이 비슷한 사례를 볼 수 있어요</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  업체 화면에서 내 금액과 조건이 비슷한 사례를 함께 보실 수 있어요.
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

  /**
   * 사진에서 읽기.
   *
   * 붙여넣기를 먼저 두는 이유는 **서버에 이미지가 올라가지 않기 때문이다** —
   * 올라가지 않은 것은 새지도, 파기할 일도 없다. 사진은 글로 옮길 수 없는 것
   * (카드 영수증 실물)에만 쓴다.
   */
  async function readFromImages(pick: () => Promise<CapturedPage[]>) {
    if (reading) return;

    setReading(true);
    setReadNote(null);

    try {
      const pages = await pick();

      if (pages.length === 0) {
        return;
      }

      const uploaded = await uploadPaymentProof(pages.slice(0, 1));

      setRawDocumentId(uploaded);
      await runParse({ rawDocumentId: uploaded });
    } catch (caught) {
      setReadNote(
        caught instanceof PermissionDeniedError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : '읽지 못했어요. 직접 적어주세요.'
      );
    } finally {
      setReading(false);
    }
  }

  async function read() {
    if (pasted.trim().length === 0) return;

    setReading(true);
    setReadNote(null);

    try {
      await runParse({ text: pasted });
    } catch (caught) {
      setReadNote(caught instanceof Error ? caught.message : '읽지 못했어요. 직접 적어주세요.');
    } finally {
      setReading(false);
    }
  }

  async function runParse(input: { text?: string; rawDocumentId?: string }) {
    {
      const parsed = await parsePaymentText(input);

      if (parsed.rejection) {
        // 취소 문자를 결제로 등록하면 낸 적 없는 돈이 낸 돈이 된다.
        setReadNote(parsed.rejection);
        setUncertain([]);
        setReadingId(null);

        return;
      }

      if (parsed.merchantName) setMerchantName(parsed.merchantName.value);
      if (parsed.paidAmount)
        setAmount(String(parsed.paidAmount.value).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
      if (parsed.paidAt) setDay(parsed.paidAt.value.slice(0, 10));
      if (parsed.method) setMethod(parsed.method.value);
      // 값이 아니라 종류다. 읽어낸 것을 그대로 쓴다.
      setIdentifiers(parsed.maskedIdentifiers);
      setUncertain(parsed.needsConfirmation);

      setReadingId(parsed.readingId);
      // 등록할 때 이것과 견줘 "사람이 고쳤는지"를 알린다.
      setAsRead({
        merchantName: parsed.merchantName?.value ?? '',
        amount: parsed.paidAmount ? String(parsed.paidAmount.value) : '',
        day: parsed.paidAt?.value.slice(0, 10) ?? '',
      });

      const unread = parsed.missing.map((field) => PAYMENT_PROOF_FIELD_LABEL[field]);

      setReadNote(
        parsed.notice ??
          (unread.length > 0
            ? `${unread.join(' · ')}은(는) 읽지 못했어요. 직접 적어주세요.`
            : '읽었어요. 맞는지 확인해 주세요.')
      );
    }
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
        // 올려둔 원본이 있으면 이어붙인다. 24시간 뒤에 지워진다.
        ...(rawDocumentId ? { rawDocumentId } : {}),
        /*
         * 읽어준 값을 그대로 썼는지 알린다. 이 비율이 높으면 읽기가 나쁜 것이고,
         * 그러면 규칙이나 모델을 손봐야 한다. 재지 않으면 나쁜지도 모른다.
         */
        ...(readingId && asRead
          ? {
              readingId,
              readingCorrected:
                asRead.merchantName !== merchantName.trim() ||
                asRead.amount !== String(paidAmount) ||
                asRead.day !== day,
            }
          : {}),
      });

      setDone({
        matched: created.matchedVendorId !== null,
        note: created.unmatchedNote,
        deepData: created.deepData,
        deletedBy: created.originalDeletedBy,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '등록하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Pick 인증 자료를 알려주세요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              카드 승인 문자를 그대로 붙여넣으시면 읽어서 채워드려요. 사진을 올리지 않으니
              저희 서버에 이미지가 남지 않아요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">안내 문자 붙여넣기</ThemedText>
            <TextInput
              style={[styles.input, styles.paste, { color: theme.text, borderColor: theme.border }]}
              value={pasted}
              onChangeText={setPasted}
              multiline
              placeholder={'[Web발신]\n신한카드 승인\n3,000,000원 일시불\n05/20 14:23\n가온예식홀'}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="안내 문자"
            />
            <ActionButton
              label={reading ? '읽는 중…' : '붙여넣은 문자에서 읽기'}
              disabled={pasted.trim().length === 0 || reading}
              onPress={() => void read()}
            />

            {/*
              사진은 글로 옮길 수 없는 것에만 쓴다 — 카드 영수증 실물처럼.
              올린 사진은 24시간 뒤에 지워지고, 붙여넣기는 애초에 올라가지 않는다.
            */}
            <ThemedText type="small" themeColor="textSecondary">
              승인 문자가 아니라 종이 영수증이라면 사진으로 올려주세요. 올린 사진은
              24시간 안에 지워져요.
            </ThemedText>
            <ActionButton
              label="영수증 촬영하기"
              disabled={reading}
              onPress={() => router.push('/capture/camera')}
            />
            <ActionButton
              label="사진에서 불러오기"
              disabled={reading}
              onPress={() => void readFromImages(pickFromLibrary)}
            />
            {readNote ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {readNote}
                </ThemedText>
              </ThemedView>
            ) : null}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">가맹점 이름</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {uncertain.includes('merchantName')
                ? '여러 개로 읽혀 하나를 골랐어요. 맞는지 봐주세요.'
                : '영수증에 찍힌 그대로. 업체 이름과 달라도 괜찮아요.'}
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
            <ThemedText type="smallBold">금액</ThemedText>
            {uncertain.includes('paidAmount') ? (
              <ThemedText type="small" themeColor="textSecondary">
                금액이 여러 개 있어 하나를 골랐어요. 맞는지 봐주세요.
              </ThemedText>
            ) : null}
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={amount}
              onChangeText={(text) =>
                setAmount(
                  text.replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                )
              }
              keyboardType="number-pad"
              maxLength={15}
              placeholder="예: 3000000"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="금액"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">낸 날</ThemedText>
            {uncertain.includes('paidAt') ? (
              /* 문자에 연도가 없어 추정한 값이다. 한 해가 어긋나면 기간이 달라진다. */
              <ThemedText type="small" themeColor="textSecondary">
                문자에 연도가 없어 짐작한 값이에요. 연도가 맞는지 봐주세요.
              </ThemedText>
            ) : null}
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={day}
              onChangeText={setDay}
              placeholder="2026-05-20"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="낸 날"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">지불 수단</ThemedText>
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
              저장하지 않아요.
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
              label={sending ? '등록하는 중…' : '제보하기'}
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
  paste: { minHeight: 120, textAlignVertical: 'top' },
});
