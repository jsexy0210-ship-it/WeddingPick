import { useRef, type CSSProperties } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDateDot } from '@/features/common/format-date';
import { FieldButton } from '@/features/wedding/screen-kit';
import { FontSize, ProductSymbol, useTheme } from '@weddingpick/ui';

import { acceptDay, TIME_PATTERN, type OsDateFieldProps, type OsTimeFieldProps } from './os-picker-field.shared';

export type { OsDateFieldProps, OsTimeFieldProps } from './os-picker-field.shared';

/**
 * 웹 빌드의 날짜 · 시간 필드 — 브라우저 기본 `<input type="date|time">`를 필드 위에 투명하게
 * 덮는다. 모바일 브라우저는 그 칸을 누르면 **OS 선택기**(iOS 휠 · 안드로이드 달력)를 띄운다.
 * 데스크톱 브라우저는 칸을 눌러도 선택기가 안 뜨는 것이 있어 `showPicker()`를 한 번 부른다.
 *
 * 보이는 것은 네이티브와 같은 `FieldButton`이다 — 브라우저마다 다른 날짜 표기 대신 전역
 * 표기(`2027.05.16(토)` · `14:00`)를 그대로 보여 준다.
 */
export function OsDateField({ label, value, placeholder, onChange, min, max, accent, testID }: OsDateFieldProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={styles.wrap}>
      <FieldButton
        label={label}
        value={value ? formatDateDot(value) : null}
        placeholder={placeholder}
        accent={accent}
        icon={<ProductSymbol name="calendar" size={20} color={accent ? theme.tint : theme.textAssistive} />}
        onPress={noop}
      />
      <NativeInput
        type="date"
        label={label}
        value={value ?? ''}
        min={min}
        max={max}
        onValue={(next) => {
          if (acceptDay(next, min, max)) onChange(next);
        }}
      />
    </View>
  );
}

export function OsTimeField({ label, value, placeholder, onChange, testID }: OsTimeFieldProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={styles.wrap}>
      <FieldButton
        label={label}
        value={value}
        placeholder={placeholder}
        icon={<ProductSymbol name="clock" size={20} color={theme.textAssistive} />}
        onPress={noop}
      />
      <NativeInput
        type="time"
        label={label}
        value={value ?? ''}
        onValue={(next) => {
          if (TIME_PATTERN.test(next)) onChange(next);
        }}
      />
    </View>
  );
}

function NativeInput({
  type,
  label,
  value,
  min,
  max,
  onValue,
}: {
  type: 'date' | 'time';
  label: string;
  value: string;
  min?: string;
  max?: string;
  onValue: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      type={type}
      aria-label={label}
      value={value}
      min={min}
      max={max}
      onChange={(event) => onValue(event.currentTarget.value)}
      onClick={() => {
        try {
          ref.current?.showPicker?.();
        } catch {
          /* 사용자 제스처 밖이거나 지원하지 않는 브라우저 — 기본 동작에 맡긴다. */
        }
      }}
      style={INPUT_STYLE}
    />
  );
}

function noop() {}

/* 필드 전체를 덮는 투명 칸. opacity 0이어도 눌리고, 16px(t6) 미만이면 iOS Safari가 확대한다. */
const INPUT_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  margin: 0,
  padding: 0,
  border: 0,
  fontSize: FontSize.t6,
  cursor: 'pointer',
  boxSizing: 'border-box',
};

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
});
