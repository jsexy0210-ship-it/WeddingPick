import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Border, FontSize, Layout, LineHeight, Radius, ThemedText, useTheme } from '@weddingpick/ui';

import { BUDGET_NOTE, BUDGET_QUICK_CHIPS, BUDGET_UNIT, formatManWonDigits } from './flow';

/**
 * 예산(4/5) — v3.29 정본 `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html`
 * WP-AUTH-005. 구간을 고르지 않고 **금액을 만원 단위로 직접 적는다.** 시안
 * `amtField`(64 · radius 6 · 좌우 18 · 코랄 1.5 테두리 · 32/700 금액 +
 * 17/700 «만원» · 오른쪽 정렬) + `amtQuick` 칩 넷(38 · 좌우 14 · pill · 14/700) +
 * `amtNote` 한 줄.
 *
 * 숫자만 받고 천단위 쉼표는 보여줄 때만 붙인다(`formatManWonDigits`). 값은 만원
 * 정수 하나다 — 0은 «적지 않음»이라 null로 올린다.
 */
export function BudgetAmount({
  value,
  onChange,
}: {
  /** 만원. 아직 안 적었으면 null. */
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  function setDigits(text: string) {
    const digits = text.replace(/[^0-9]/g, '').slice(0, MAX_DIGITS);
    const amount = Number(digits);

    onChange(digits.length === 0 || amount <= 0 ? null : amount);
  }

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={[styles.field, { borderColor: theme.tint }]}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={`예산 ${BUDGET_UNIT}`}
          value={value === null ? '' : formatManWonDigits(value)}
          onChangeText={setDigits}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={theme.textDisabled}
          selectionColor={theme.tint}
          maxLength={MAX_DIGITS + Math.floor((MAX_DIGITS - 1) / 3)}
          style={[styles.amount, { color: theme.text }]}
        />
        <ThemedText type="f17" themeColor="textSecondary" style={styles.unit}>
          {BUDGET_UNIT}
        </ThemedText>
      </Pressable>

      <View style={styles.chips}>
        {BUDGET_QUICK_CHIPS.map((chip) => (
          <Pressable
            key={chip.label}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            onPress={() => onChange(chip.add === null ? null : Math.min((value ?? 0) + chip.add, MAX_AMOUNT))}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="f14" themeColor="textSecondary" numeric style={styles.chipLabel}>
              {chip.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="f13" themeColor="textAssistive" style={styles.note}>
        {BUDGET_NOTE}
      </ThemedText>
    </View>
  );
}

/* 만원 단위 최대 7자리(9,999,999만원). 그보다 큰 예산은 이 화면이 다루는 값이 아니다. */
const MAX_DIGITS = 7;
const MAX_AMOUNT = 10 ** MAX_DIGITS - 1;
/* 시안 amtField 고정값 — 높이 64 · 좌우 18 · 금액과 단위 사이 6. */
const FIELD_HEIGHT = 64;
const FIELD_PADDING_X = 18;
const FIELD_GAP = 6;

const styles = StyleSheet.create({
  /* 시안 sec — 좌우 24 · 아래 20 · 사이 12. */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    gap: Layout.inlineGap,
  },
  field: {
    height: FIELD_HEIGHT,
    borderRadius: Radius.control,
    borderWidth: Border.selected,
    paddingHorizontal: FIELD_PADDING_X,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: FIELD_GAP,
  },
  amount: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    /* 시안 amtVal — 32/700 · 표 숫자. 시스템 서체 — fontFamily를 주지 않는다. */
    fontSize: FontSize.amount,
    lineHeight: LineHeight.amount,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  /* 단위는 줄바꿈하지 않는다 — 입력 칸이 남은 폭을 다 쓰더라도 «만원»은 한 덩어리다. */
  unit: { flexShrink: 0, fontWeight: 700 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.chipGap },
  chip: {
    height: Layout.chipSheet,
    paddingHorizontal: Layout.chipPaddingX,
    borderRadius: Radius.pill,
    justifyContent: 'center',
  },
  chipLabel: { fontWeight: 700 },
  note: { lineHeight: LineHeight.lh19 },
  pressed: { opacity: 0.8 },
});
