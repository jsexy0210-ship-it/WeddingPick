import {
  MASKED_IDENTIFIER_KINDS,
  MASKED_IDENTIFIER_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_PROOF_RETENTION_HOURS,
  TERMS,
  canRegisterPaymentProof,
  manwon,
  type MaskedIdentifierKind,
  type PaymentMethod,
  type PaymentProofField,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { parsePaymentText, registerPaymentProof } from '@/api/client';
import { PermissionDeniedError, pickFromLibrary } from '@/features/capture/pickers';
import type { CapturedPage } from '@/features/capture/types';
import { uploadPaymentProof } from '@/features/capture/upload';
import { formatDateDot } from '@/features/common/format-date';
import { dayToTimestamp, isDay, paramToDay } from '@/features/wedding/expense-day';
import {
  FilterChip,
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import {
  CheckBox,
  Dock,
  DockButton,
  Field,
  Hero,
  InfoCard,
  ListRow,
  NavBar,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/** `spec/strings.ko.json` `report.*` · 시안 11-report-review #12a · #12b · #12c. */
const S = {
  nav: 'Pick 인증',
  pickTitle: '낸 금액이 보이는 화면을 올려주세요',
  pickSub: '영수증 · 문자 · 앱 화면 캡처 모두 돼요',
  shoot: '촬영하기',
  album: '앨범에서 고르기',
  paste: '문자 붙여넣기',
  hint1: '금액 · 날짜 · 업체명이 보이면 충분해요',
  hint2: '카드번호와 이름은 자동으로 가려요',
  hint3: `확인이 끝난 원본은 ${PAYMENT_PROOF_RETENTION_HOURS}시간 안에 지워요`,
  readTitleAll: '그대로 제보할까요?',
  readSubAll: '올려주신 자료에서 그대로 읽었어요',
  readSubSome: '나머지는 올려주신 자료에서 그대로 읽었어요',
  manualTitle: '직접 적어주세요',
  manualSub: '적어주시면 그대로 접수할게요',
  readTag: '읽었어요',
  checkTag: '확인 필요',
  submit: '이대로 제보하기',
  submitManual: TERMS.reportCta,
  doneTitle: '제보 접수됐어요',
  doneSub: '확인이 끝나면 알려드려요',
  doneNext: '다음',
  doneNextValue: '확인이 끝나면 알림으로 알려드려요',
  doneSpend: '내 지출',
  doneOriginal: '원본',
  doneOriginalValue: `올려주신 자료는 ${PAYMENT_PROOF_RETENTION_HOURS}시간 뒤 삭제돼요`,
  doneCta: '확인',
} as const;

/** 사용자 화면의 필드 라벨 — SPEC 5.2(amount 낸 금액 · paidAt 낸 날짜 · vendor 업체). `결제금액` `결제일`을 쓰지 않는다. */
const FIELD_LABEL: Record<PaymentProofField, string> = {
  merchantName: '업체',
  paidAmount: '낸 금액',
  paidAt: '낸 날짜',
  method: '지불 수단',
};

/** 확인이 필요한 항목에 왜 필요한지 한 줄(SPEC 5.1). */
const HINT: Record<PaymentProofField, string> = {
  merchantName: '여러 상호로 읽혀 하나를 골랐어요. 맞는지 봐주세요',
  paidAmount: '금액이 여러 개 있어 하나를 골랐어요',
  paidAt: '연도가 없어 짐작한 값이에요. 연도가 맞는지 봐주세요',
  method: '어떤 수단으로 냈는지 골라주세요',
};

/** 2열 격자 타일 — (390−48−11)/2 = 165.5 → 시안 166. */
const TILE_GAP = Layout.gap2col;

/**
 * Pick 인증 — 자료 선택(WP-RPT-002) → 자동 입력 결과 확인(WP-RPT-004) → 제출 완료(WP-RPT-007).
 * 핸드오프 11-report-review #12a · #12b · #12c · SPEC 5.
 *
 *   선택   hero · 2열 격자(촬영하기 · 앨범에서 고르기 · 고른 사진) · 안내 3줄 체크 · 문자 붙여넣기
 *   확인   hero «두 가지만 확인해주세요» · 필드 카드 — 읽은 것 recessed «읽었어요» / 확인 필요 coral 1px «확인 필요» + 힌트
 *   완료   체크 원 72 · «제보 접수됐어요» · 카드 3(다음 · 내 지출 · 원본) · dock «확인»
 *
 * **읽어낸 항목은 조용히, 확인 필요만 강조한다.** 카드사가 기계로 찍어 보내는 문자는 규칙으로
 * 읽힌다 — 붙여넣기는 이미지가 서버에 올라가지 않아 새지도 파기할 일도 없다. 사진은 글로
 * 옮길 수 없는 것(종이 영수증)에 쓴다. 카드번호를 적을 칸이 없다 — 있었는지만 고른다.
 * 지출 추가(WP-OUR-014)에서 «지출 넣고 인증하기»로 오면 적은 값이 미리 채워진다.
 */
export default function RegisterPaymentProofScreen() {
  const theme = useTheme();
  const prefill = useLocalSearchParams<{ merchantName?: string; paidAmount?: string; paidAt?: string }>();

  const [merchantName, setMerchantName] = useState(prefill.merchantName ?? '');
  const [amount, setAmount] = useState(() =>
    (prefill.paidAmount ?? '').replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  );
  const [day, setDay] = useState(() => paramToDay(prefill.paidAt) ?? '');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [identifiers, setIdentifiers] = useState<MaskedIdentifierKind[]>([]);

  /** 자료를 골랐거나 붙여넣어 읽기를 시도했으면 확인 단계로 넘어간다. 미리 채워져 왔으면 바로 확인 단계. */
  const [step, setStep] = useState<'pick' | 'review'>(prefill.merchantName || prefill.paidAmount ? 'review' : 'pick');
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [picture, setPicture] = useState<CapturedPage | null>(null);
  const [reading, setReading] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [rawDocumentId, setRawDocumentId] = useState<string | null>(null);
  const [asRead, setAsRead] = useState<Record<string, string> | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  /** 서버가 «확신이 낮다»고 짚은 항목 + 못 읽은 항목. 카드를 coral로 켠다. */
  const [uncertain, setUncertain] = useState<PaymentProofField[]>([]);
  const [readOk, setReadOk] = useState<PaymentProofField[]>([]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ matched: boolean; note: string | null; amount: number } | null>(null);

  const paidAt = isDay(day) ? dayToTimestamp(day) : null;
  const paidAmount = Number(amount.replace(/[^\d]/g, ''));
  const check =
    paidAt === null
      ? { ok: false as const, reason: '낸 날짜를 2027-05-16 형태로 적어주세요' }
      : canRegisterPaymentProof({ merchantName, paidAmount, paidAt });

  async function runParse(input: { text?: string; rawDocumentId?: string }) {
    const parsed = await parsePaymentText(input);

    if (parsed.rejection) {
      // 취소 문자를 결제로 등록하면 낸 적 없는 돈이 낸 돈이 된다.
      setReadNote(parsed.rejection);
      setUncertain([]);
      setReadOk([]);
      setReadingId(null);
      return;
    }

    if (parsed.merchantName) setMerchantName(parsed.merchantName.value);
    if (parsed.paidAmount) setAmount(String(parsed.paidAmount.value).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    if (parsed.paidAt) setDay(parsed.paidAt.value.slice(0, 10));
    if (parsed.method) setMethod(parsed.method.value);
    setIdentifiers(parsed.maskedIdentifiers);

    const unread = parsed.missing;
    const needs = [...new Set([...parsed.needsConfirmation, ...unread])];
    const ok = (['merchantName', 'paidAmount', 'paidAt', 'method'] as PaymentProofField[]).filter(
      (field) => !needs.includes(field)
    );

    setUncertain(needs);
    setReadOk(ok);
    setReadingId(parsed.readingId);
    setAsRead({
      merchantName: parsed.merchantName?.value ?? '',
      amount: parsed.paidAmount ? String(parsed.paidAmount.value) : '',
      day: parsed.paidAt?.value.slice(0, 10) ?? '',
    });
    setReadNote(
      parsed.notice ??
        (unread.length > 0 ? `${unread.map((field) => FIELD_LABEL[field]).join(' · ')}은(는) 읽지 못했어요` : null)
    );
  }

  async function readFromImages(pick: () => Promise<CapturedPage[]>) {
    if (reading) return;
    setReading(true);
    setReadNote(null);
    setError(null);

    try {
      const pages = await pick();

      if (pages.length === 0) return;

      setPicture(pages[0] ?? null);
      const uploaded = await uploadPaymentProof(pages.slice(0, 1));

      setRawDocumentId(uploaded);
      await runParse({ rawDocumentId: uploaded });
      setStep('review');
    } catch (caught) {
      setReadNote(
        caught instanceof PermissionDeniedError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : '읽지 못했어요. 직접 적어주세요.'
      );
      setStep('review');
    } finally {
      setReading(false);
    }
  }

  async function readPasted() {
    if (pasted.trim().length === 0 || reading) return;
    setReading(true);
    setReadNote(null);

    try {
      await runParse({ text: pasted });
    } catch (caught) {
      setReadNote(caught instanceof Error ? caught.message : '읽지 못했어요. 직접 적어주세요.');
    } finally {
      setReading(false);
      setStep('review');
    }
  }

  async function submit() {
    if (!paidAt || !check.ok || sending) return;
    setSending(true);
    setError(null);

    try {
      const created = await registerPaymentProof({
        merchantName: merchantName.trim(),
        paidAmount,
        paidAt,
        method,
        maskedIdentifiers: identifiers,
        ...(rawDocumentId ? { rawDocumentId } : {}),
        ...(readingId && asRead
          ? {
              readingId,
              readingCorrected:
                asRead.merchantName !== merchantName.trim() || asRead.amount !== String(paidAmount) || asRead.day !== day,
            }
          : {}),
      });

      setDone({ matched: created.matchedVendorId !== null, note: created.unmatchedNote, amount: paidAmount });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '등록하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  /* ---------------------------------------------------------- 제출 완료 · WP-RPT-007 */
  if (done) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.doneHero}>
            <View style={[styles.ring, { backgroundColor: theme.tint }]}>
              <ProductSymbol name="check" size={36} color={theme.onTint} />
            </View>
            <View style={styles.doneText}>
              <ThemedText type="t2">{S.doneTitle}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {done.matched ? S.doneSub : (done.note ?? S.doneSub)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.cards}>
            <InfoCard label={S.doneNext} value={S.doneNextValue} />
            <InfoCard label={S.doneSpend} value={`${TERMS.ourWedding} 지출에 ${manwon(done.amount)}이 더해졌어요`} />
            {rawDocumentId ? <InfoCard label={S.doneOriginal} value={S.doneOriginalValue} /> : null}
          </View>
        </ScrollView>
        <Dock>
          <DockButton variant="primary" label={S.doneCta} onPress={() => router.replace('/wedding' as never)} />
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 자료 선택 · WP-RPT-002 */
  if (step === 'pick') {
    return (
      <Screen>
        <NavBar title={S.nav} />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Hero title={S.pickTitle} sub={S.pickSub} />

          {/* 2열 격자 — 촬영 · 앨범 · 문자. 시안의 «선택된 사진» 자리는 고르면 확인 단계로 넘어가므로 붙여넣기가 앉는다. */}
          <View style={styles.grid}>
            <Tile label={S.shoot} disabled={reading} onPress={() => router.push('/capture/camera')} />
            <Tile label={S.album} disabled={reading} onPress={() => void readFromImages(pickFromLibrary)} />
            <Tile label={S.paste} disabled={reading} selected={pasting} onPress={() => setPasting((current) => !current)} />
          </View>

          {pasting ? (
            <View style={styles.pasteWrap}>
              <Field
                label={S.paste}
                value={pasted}
                onChangeText={setPasted}
                multiline
                placeholder={'[Web발신]\n신한카드 승인\n3,000,000원 일시불\n05/20 14:23\n업체명'}
                hint="붙여넣은 글은 서버에 이미지로 남지 않아요"
              />
            </View>
          ) : null}

          <Section>
            {[S.hint1, S.hint2, S.hint3].map((line) => (
              <ListRow key={line} left={<CheckBox checked />} title={line} titleLines={2} divider={false} />
            ))}
          </Section>

          {readNote ? (
            <ThemedText type="t7" themeColor="negative" style={styles.error}>
              {readNote}
            </ThemedText>
          ) : null}
        </ScrollView>

        <Dock>
          {pasting ? (
            <DockButton
              variant="primary"
              label={reading ? '읽는 중…' : '1장으로 계속하기'}
              disabled={reading || pasted.trim().length === 0}
              onPress={() => void readPasted()}
            />
          ) : (
            <DockButton label="사진 없이 직접 적기" onPress={() => setStep('review')} />
          )}
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 자동 입력 결과 확인 · WP-RPT-004 */
  const hasReading = readingId !== null;
  const needsCount = uncertain.length;
  const heroTitle = hasReading
    ? needsCount === 0
      ? S.readTitleAll
      : `${['한', '두', '세', '네'][needsCount - 1] ?? needsCount} 가지만 확인해주세요`
    : S.manualTitle;
  const heroSub = hasReading ? (needsCount === 0 ? S.readSubAll : S.readSubSome) : (readNote ?? S.manualSub);

  const tone = (field: PaymentProofField): 'read' | 'check' | 'plain' =>
    !hasReading ? 'plain' : uncertain.includes(field) ? 'check' : readOk.includes(field) ? 'read' : 'plain';

  return (
    <Screen>
      <NavBar title={S.nav} onBack={() => (hasReading || picture ? setStep('pick') : router.back())} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Hero title={heroTitle} sub={heroSub} />

        <View style={styles.fieldCards}>
          <FieldCard label={FIELD_LABEL.paidAmount} tone={tone('paidAmount')} hint={HINT.paidAmount}>
            <Field
              label=""
              value={amount}
              onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
              keyboardType="number-pad"
              maxLength={15}
              placeholder="예: 1,520,000"
              hint={paidAmount > 0 ? manwon(paidAmount) : null}
              accessibilityLabel={FIELD_LABEL.paidAmount}
            />
          </FieldCard>

          <FieldCard label={FIELD_LABEL.paidAt} tone={tone('paidAt')} hint={HINT.paidAt}>
            <Field
              label=""
              value={day}
              onChangeText={setDay}
              placeholder="2027-05-16"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              hint={isDay(day) && paidAt ? formatDateDot(day) : null}
              accessibilityLabel={FIELD_LABEL.paidAt}
            />
          </FieldCard>

          <FieldCard label={FIELD_LABEL.merchantName} tone={tone('merchantName')} hint={HINT.merchantName}>
            <Field
              label=""
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="자료에 적힌 상호 그대로"
              maxLength={80}
              accessibilityLabel={FIELD_LABEL.merchantName}
            />
          </FieldCard>

          <FieldCard label={FIELD_LABEL.method} tone={tone('method')} hint={HINT.method}>
            <View style={styles.chips}>
              {PAYMENT_METHODS.map((value) => (
                <FilterChip
                  key={value}
                  label={PAYMENT_METHOD_LABEL[value]}
                  selected={method === value}
                  role="radio"
                  onPress={() => setMethod(value)}
                />
              ))}
            </View>
          </FieldCard>

          {/* 값이 아니라 종류만 고른다. 카드번호를 적을 칸이 없는 것이 요점이다. */}
          <FieldCard label="자료에 함께 찍힌 것" tone="plain" hint="">
            <View style={styles.chips}>
              {MASKED_IDENTIFIER_KINDS.map((kind) => (
                <FilterChip
                  key={kind}
                  label={MASKED_IDENTIFIER_LABEL[kind]}
                  selected={identifiers.includes(kind)}
                  onPress={() =>
                    setIdentifiers((current) =>
                      current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind]
                    )
                  }
                />
              ))}
            </View>
            <ThemedText type="t7" themeColor="textAssistive">
              번호 자체는 적지 않아도 되고, 저장하지 않아요
            </ThemedText>
          </FieldCard>
        </View>

        {picture ? (
          <View style={styles.pictureWrap}>
            <Image source={{ uri: picture.uri }} style={styles.picture} accessibilityLabel="올린 자료" />
            <ThemedText type="t7" themeColor="textAssistive">
              {S.hint3}
            </ThemedText>
          </View>
        ) : null}

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <Dock note={!check.ok && (merchantName.length > 0 || amount.length > 0 || day.length > 0) ? check.reason : null}>
        <DockButton
          variant="primary"
          label={sending ? '보내는 중…' : hasReading && needsCount === 0 ? S.submit : S.submitManual}
          disabled={!check.ok || sending}
          onPress={() => void submit()}
        />
      </Dock>
    </Screen>
  );
}

/** 2열 격자 타일 166 — 테두리 1 · radius 10 · 라벨 14/19 700. */
function Tile({
  label,
  onPress,
  disabled,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: selected ? theme.text : theme.track, backgroundColor: theme.background },
        (pressed || disabled) && styles.pressed,
      ]}>
      <ThemedText type="t7" themeColor="textSecondary" style={styles.bold}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * 필드 카드 — SPEC 5.1. 읽은 것: recessed · 태그 «읽었어요» 회색. 확인 필요: 흰 배경 · coral 테두리 ·
 * 태그 «확인 필요» coral 채움 · 힌트 한 줄. 직접 입력: 테두리만.
 */
function FieldCard({
  label,
  tone,
  hint,
  children,
}: {
  label: string;
  tone: 'read' | 'check' | 'plain';
  hint: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const surface =
    tone === 'read'
      ? { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement }
      : tone === 'check'
        ? { backgroundColor: theme.background, borderColor: theme.tint }
        : { backgroundColor: theme.background, borderColor: theme.track };

  return (
    <View style={[styles.fieldCard, surface]}>
      <View style={styles.fieldHead}>
        <ThemedText type="t7" themeColor="textAssistive">
          {label}
        </ThemedText>
        {tone === 'read' ? (
          <View style={[styles.tag, { backgroundColor: theme.border }]}>
            <ThemedText type="micro" themeColor="textAssistive">
              {S.readTag}
            </ThemedText>
          </View>
        ) : tone === 'check' ? (
          <View style={[styles.tag, { backgroundColor: theme.tint }]}>
            <ThemedText type="micro" themeColor="onTint">
              {S.checkTag}
            </ThemedText>
          </View>
        ) : null}
      </View>
      {children}
      {tone === 'check' && hint ? (
        <ThemedText type="t7" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  /* 2열 격자 — padding 0 24 · gap 11 · 타일 166. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP, paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  tile: {
    width: (390 - Layout.gutter * 2 - TILE_GAP) / 2,
    aspectRatio: 1,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  pasteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  fieldCards: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.rowPaddingY },
  /* 필드 카드 — radius 10 · padding 18 20 · gap 6 · 테두리 1. */
  fieldCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingVertical: Layout.cardPadding - Spacing.half,
    paddingHorizontal: Layout.cardPadding,
    gap: Spacing.one + Spacing.half,
  },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  /* 태그 — padding 2 7 · radius 4 · micro 13/18 700(시안 «읽었어요» · «확인 필요»). */
  tag: { paddingHorizontal: 7, paddingVertical: Spacing.half, borderRadius: Radius.badge },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pictureWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Spacing.two },
  picture: { width: 120, height: 156, borderRadius: Radius.medium },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  /* 제출 완료 — component.doneHero «padding:64px 24px 40px · gap 24 · 원 72»(11-report-review). */
  doneHero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.doneHeroPaddingTop,
    paddingBottom: Layout.doneHeroPaddingBottom,
    gap: Spacing.four,
    alignItems: 'center',
  },
  ring: {
    width: Layout.doneHeroRing,
    height: Layout.doneHeroRing,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { gap: Spacing.two, alignItems: 'center' },
  cards: { paddingHorizontal: Layout.gutter, gap: Layout.rowPaddingY },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.7 },
});
