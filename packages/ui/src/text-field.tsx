import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from './themed-text';
import { Border, Layout, Radius, Spacing } from './theme';
import { FontSize, LineHeight } from './typography';
import { useTheme } from './use-theme';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  /** 필드 위 라벨. 없으면 입력 상자만 그린다. */
  label?: string;
  /** 오류 문구. 있으면 테두리가 #E81607로 바뀌고 아래 한 줄로 적힌다. */
  error?: string;
  /** 아래 안내 한 줄. `error`가 있으면 그 자리를 오류가 대신 쓴다. */
  hint?: string;
  /** 오른쪽 끝 요소 — 지우기 X · 단위 «만원» 등. */
  trailing?: React.ReactNode;
};

/**
 * 입력 필드 — tokens.json component.field · 02-design-system.
 *
 *   height 52 · radius 6 · padding 0 14 · 1px #D1D3D8 · 포커스 #212124 · 오류 #E81607
 *   글자 16(sub) #212124 · placeholder #ADB1BA
 *   여러 줄(`multiline`)은 min-height 88 · padding 14 · 위 정렬
 *
 * 상자가 테두리·모서리·배경을 갖고 `TextInput`은 그 안에서 폭만 채운다 — 브라우저 자동완성이
 * `<input>`에 얹는 색이 상자 밖으로 번지지 않게(apps/mobile global.css 참고).
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, trailing, multiline, onFocus, onBlur, editable = true, ...rest },
  ref
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.negative : focused ? theme.fieldBorderFocus : theme.fieldBorder;

  return (
    <View style={styles.root}>
      {label ? (
        <ThemedText type="t7" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.box,
          multiline ? styles.boxMultiline : styles.boxSingle,
          { borderColor, backgroundColor: theme.background, opacity: editable ? 1 : 0.4 },
        ]}>
        <TextInput
          ref={ref}
          multiline={multiline}
          editable={editable}
          placeholderTextColor={theme.textDisabled}
          selectionColor={theme.tint}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline ? styles.inputMultiline : null, { color: theme.text }]}
          {...rest}
        />
        {trailing}
      </View>
      {error || hint ? (
        <ThemedText type="t7" themeColor={error ? 'negative' : 'textAssistive'} style={styles.label}>
          {error ?? hint}
        </ThemedText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  label: { paddingHorizontal: Spacing.half },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: Border.hairline,
    borderRadius: Radius.control,
    gap: Spacing.two,
  },
  boxSingle: { height: Layout.field, paddingHorizontal: Layout.fieldPaddingX },
  boxMultiline: { minHeight: Layout.textarea, padding: Layout.fieldPaddingX, alignItems: 'flex-start' },
  input: {
    flex: 1,
    /* 입력 칸의 글자도 본문(sub 16)이다. 시스템 서체 — fontFamily를 주지 않는다. */
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  inputMultiline: { minHeight: Layout.textarea - Layout.fieldPaddingX * 2, textAlignVertical: 'top' },
});
