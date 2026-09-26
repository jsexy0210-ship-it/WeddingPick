import type { RegisterPaymentProofResponse } from '@weddingpick/api-contract';
import { PAYMENT_PROOF_CONSENT_POINTS } from '@weddingpick/domain';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { getSettings } from '@/api/client';
import { takePhoto } from '@/features/capture/pickers';
import { SheetHeader } from '@/features/common/bottom-sheet';
import {
  ActionButton,
  CircleLoader,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

import { ourWedding as copy, report as R } from '../../../../../spec/strings.ko.json';
import { autoResultFields, budgetRaiseNotice, registerExpensePhoto } from './expense-auto-register';

type Step =
  | { kind: 'choose' }
  | { kind: 'consent' }
  | { kind: 'reading' }
  | { kind: 'result'; result: RegisterPaymentProofResponse };

/**
 * 예산 추가 — 고르는 시트(2026-09-26 대표 지시). 헤더 «예산 추가»를 누르면 먼저 이 시트가 뜬다.
 *
 *   formHead  공용 SheetHeader — 타이틀 «예산 추가» + 우측 36px 회색 원형 X(정본 WP-NOTE-007 `formHead`)
 *   고르기    «자동 등록(Pick 인증)» · «직접 입력» 두 칸. 칸 모양은 정본 note.js `modes`
 *             (`radius 10 · padding 14 · gap 3 · REC` · 제목 15/700 · 보조 12 MUTED)이고 보조 문구도
 *             그 값(«사진 한 장이면 돼요» · «금액을 적어요»)이다. 정본 `modes`는 그려진 프레임이 없는
 *             모델 값이라 두 칸을 위아래로 세웠다 — «자동 등록(Pick 인증)»이 반 폭(167)에 한 줄로 안
 *             들어간다(DESIGN_UNRESOLVED: 고르는 시트 프레임 자체가 정본에 없다).
 *   직접 입력 → 부모가 기존 입력 시트로 바꾼다(`onManual`)
 *   자동 등록 → **카메라를 바로 연다**. Pick 인증 동의가 아직 없으면 먼저 그 안내(외부 서비스가 읽는다는
 *             줄 포함, `PAYMENT_PROOF_CONSENT_POINTS`)를 보이고 «동의하고 계속»이 카메라를 연다.
 *             찍으면 올리고 서버가 읽는다(`registerExpensePhoto`) — 읽는 동안 «읽고 있어요».
 *   결과      읽은 값(업체 · 낸 금액 · 낸 날짜)을 정본 `mergedFields`의 «읽었어요 · 확인 필요» 딱지로
 *             보여준다. 읽었으면 지출내역에 «Pick 인증» 줄로 이미 들어가 있고, 못 읽었으면 «확인 중» —
 *             지출에는 아직 안 들어가고 지출내역 맨 위에 «확인 중» 줄로 선다.
 *
 * 총예산 한도(«예산 추가는 총예산을 넘을 수 없다»)는 직접 입력에만 건다 — Pick 인증은 실제로 낸
 * 영수증이라 막지 않고, 넘으면 **서버가 넘은 만큼 총예산을 늘린다**(2026-09-26 대표 결정 「초과되는
 * 금액만큼 총 예산도 늘려」 · `apps/api/src/budget-raise.ts`). 결과 화면에 «총예산을 N만원 늘렸어요».
 */
export function ExpenseAddChooser({
  weddingId,
  onManual,
  onClose,
  onBusyChange,
}: {
  weddingId: string;
  onManual: () => void;
  /** 결과를 보고 «확인»을 눌렀거나 X를 눌렀다. */
  onClose: () => void;
  /** 올리고 읽는 동안에는 시트를 닫지 못하게 부모에게 알린다. */
  onBusyChange: (busy: boolean) => void;
}) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [error, setError] = useState<string | null>(null);
  /* Pick 인증 동의가 이미 있는가. 모르면(null · 못 읽음) 안내를 한 번 더 보여 준다 — 그게 최악은 아니다. */
  const [consented, setConsented] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) setConsented(settings.paymentConsent);
      })
      .catch(() => {
        if (active) setConsented(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const busy = step.kind === 'reading';

  function startAuto() {
    if (busy) return;
    setError(null);
    if (consented === true) void capture(false);
    else setStep({ kind: 'consent' });
  }

  /**
   * **누른 그 자리에서 카메라를 연다** — 이 함수 안에서 `takePhoto()`보다 앞에 `await`를 두지 않는다.
   * 웹은 사용자가 누른 직후에만 파일 창을 허락한다(`takePhoto` 머리말).
   */
  async function capture(grantConsent: boolean) {
    setError(null);
    let photo;
    try {
      photo = await takePhoto();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '카메라를 열지 못했어요.');
      return;
    }
    /* 찍다 닫았다 — 있던 자리 그대로 둔다. */
    if (!photo) return;

    setStep({ kind: 'reading' });
    onBusyChange(true);
    try {
      const result = await registerExpensePhoto({ weddingId, photo, grantConsent });
      if (grantConsent) setConsented(true);
      setStep({ kind: 'result', result });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '사진을 올리지 못했어요. 다시 찍어주세요.');
      setStep({ kind: grantConsent ? 'consent' : 'choose' });
    } finally {
      onBusyChange(false);
    }
  }

  const header = (
    <SheetHeader title={copy['headerAdd.expense']} onClose={onClose} closeDisabled={busy} />
  );

  if (step.kind === 'reading') {
    return (
      <>
        {header}
        <View style={styles.reading} accessibilityLiveRegion="polite" testID="expense-auto-reading">
          <CircleLoader size={40} />
          <ThemedText type="f15" style={styles.bold}>
            {R['scan.title']}
          </ThemedText>
        </View>
      </>
    );
  }

  if (step.kind === 'result') {
    const { result } = step;
    const accepted = result.status === 'accepted';
    const raised = accepted ? budgetRaiseNotice(result) : null;
    return (
      <>
        {header}
        <View style={styles.body} testID={accepted ? 'expense-auto-accepted' : 'expense-auto-pending'}>
          <View style={styles.resultHead}>
            <ThemedText type="f17" style={styles.bold}>
              {accepted ? copy['expense.autoAdded'] : copy['expense.autoPending']}
            </ThemedText>
            {!accepted ? (
              <ThemedText type="f13" themeColor="textSecondary">
                {result.reviewNote ?? copy['expense.autoPendingNote']}
              </ThemedText>
            ) : null}
            {/* 총예산을 넘어 서버가 넘은 만큼 늘렸다(2026-09-26 대표 결정) — 한 줄로 알린다. */}
            {raised ? (
              <ThemedText
                type="f13"
                themeColor="tint"
                numeric
                style={styles.bold}
                accessibilityLiveRegion="polite"
                testID="expense-auto-budget-raised">
                {raised}
              </ThemedText>
            ) : null}
          </View>
          {autoResultFields(result).map((field) => (
            <View key={field.label} style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <ThemedText type="f13" themeColor="textSecondary">
                  {field.label}
                </ThemedText>
                <View
                  style={[
                    styles.tag,
                    { backgroundColor: field.needsCheck ? theme.tint : theme.border },
                  ]}>
                  <ThemedText
                    type="f12"
                    style={[styles.bold, { color: field.needsCheck ? theme.onTint : theme.textAssistive }]}>
                    {field.tag}
                  </ThemedText>
                </View>
              </View>
              <View
                style={[
                  styles.fieldBox,
                  field.needsCheck
                    ? { backgroundColor: theme.background, borderColor: theme.tint, borderWidth: 1.5 }
                    : { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText type="f16" numeric themeColor={field.needsCheck ? 'textAssistive' : undefined}>
                  {field.value}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
        <ActionButton variant="primary" size="sheet" label={copy['expense.autoDone']} onPress={onClose} />
      </>
    );
  }

  if (step.kind === 'consent') {
    return (
      <>
        {header}
        <ScrollView
          style={{ maxHeight: Math.max(220, height * 0.5) }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          testID="expense-auto-consent">
          <ThemedText type="f17" style={styles.bold}>
            {copy['expense.consentTitle']}
          </ThemedText>
          {PAYMENT_PROOF_CONSENT_POINTS.map((point) => (
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
          size="sheet"
          label={copy['expense.consentCta']}
          onPress={() => void capture(true)}
        />
      </>
    );
  }

  const modes = [
    {
      key: 'auto',
      label: copy['expense.chooseAuto'],
      sub: copy['expense.chooseAutoSub'],
      onPress: startAuto,
    },
    {
      key: 'manual',
      label: copy['expense.chooseManual'],
      sub: copy['expense.chooseManualSub'],
      onPress: onManual,
    },
  ] as const;

  return (
    <>
      {header}
      <View style={styles.modes} testID="expense-add-chooser">
        {modes.map((mode) => (
          <Pressable
            key={mode.key}
            accessibilityRole="button"
            accessibilityLabel={mode.label}
            onPress={mode.onPress}
            testID={`expense-choose-${mode.key}`}
            style={({ pressed }) => [
              styles.mode,
              { backgroundColor: theme.backgroundElement },
              pressed ? styles.pressed : null,
            ]}>
            <ThemedText type="f15" themeColor="textStrong" style={styles.bold}>
              {mode.label}
            </ThemedText>
            <ThemedText type="f12" themeColor="textAssistive">
              {mode.sub}
            </ThemedText>
          </Pressable>
        ))}
        {error ? (
          <ThemedText type="t7" themeColor="negative">
            {error}
          </ThemedText>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  /* note.js `modeRow` — `gap:8px`. 두 칸을 위아래로 세운다(머리말). */
  modes: { gap: Spacing.two, paddingBottom: Spacing.two },
  /* note.js `modes[]` — `border-radius:10px;padding:14px;gap:3px;background:REC`. */
  mode: { borderRadius: Radius.medium, padding: 14, gap: 3 },
  pressed: { opacity: 0.6 },
  reading: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
  /* note.js `sheetForm` — 칸 사이 `gap:12px`. */
  body: { gap: 12, paddingBottom: Spacing.two },
  resultHead: { gap: 3 },
  /* note.js `fieldWrap` — `gap:6px`, `fieldLabelRow` — 양 끝 정렬 `gap:8px`. */
  field: { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  /* note.js `mergedFields[].tagStyle` — `padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700`. */
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: Radius.badge },
  /* note.js `mergedFields[].box` — `min-height:52px;border-radius:6px;padding:14px;font-size:16px`. */
  fieldBox: { minHeight: 52, borderRadius: Radius.input, padding: 14, justifyContent: 'center' },
});
