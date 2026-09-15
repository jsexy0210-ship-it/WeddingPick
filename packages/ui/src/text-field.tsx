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
  /** 왼쪽 끝 요소 — 검색 칸의 돋보기 등. */
  leading?: React.ReactNode;
  /** 오른쪽 끝 요소 — 지우기 X · 단위 «만원» 등. */
  trailing?: React.ReactNode;
  /**
   * 한 줄 칸의 높이. 기본은 `Layout.field` 52다.
   *
   * 검색 칸만 48이라 `SearchBar`가 `Layout.searchField`를 넘긴다 — 피그마
   * `search.txt`의 «div 334×48»이 그 근거다. 여러 줄(`multiline`)에는 쓰지 않는다.
   */
  height?: number;
};

/**
 * 입력 필드 — tokens.json component.field · 02-design-system.
 *
 *   height 52 · radius 16(control) · padding 0 14 · 1px #D1D3D8 · 포커스 #212124 · 오류 #E81607
 *   글자 16(sub) #212124 · placeholder #ADB1BA
 *   여러 줄(`multiline`)은 min-height 88 · padding 14 · 위 정렬
 *
 * **포커스 · 오류일 때 테두리가 2px이다**(SEED `text-input` variant=outline
 * «focused · invalid → strokeWidth 2px»). 피그마 규격서는 화면을 가만히 찍은 것이라
 * 포커스 상태를 담지 않는다 — 피그마가 말하지 않는 자리라 SEED를 따른다(2026-09-15
 * MASTER 확정: 「피그마에 실측값이 있으면 이긴다. 없는 자리만 SEED에서」).
 * 굵어진 만큼 안쪽 여백을 줄여 **칸의 폭과 높이가 움직이지 않게** 한다.
 *
 * 상자가 테두리·모서리·배경을 갖고 `TextInput`은 그 안에서 폭만 채운다 — 브라우저 자동완성이
 * `<input>`에 얹는 색이 상자 밖으로 번지지 않게(apps/mobile global.css 참고).
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    hint,
    leading,
    trailing,
    multiline,
    height,
    onFocus,
    onBlur,
    editable = true,
    ...rest
  },
  ref
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.negative : focused ? theme.fieldBorderFocus : theme.fieldBorder;
  /* 눈에 띄어야 하는 두 상태만 굵다. 굵어진 1px은 안쪽 여백에서 뺀다. */
  const borderWidth = error || focused ? Border.focus : Border.hairline;
  const padding = Layout.fieldPaddingX - borderWidth;

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
          multiline
            ? [styles.boxMultiline, { padding }]
            : { height: height ?? Layout.field, paddingHorizontal: padding },
          { borderColor, borderWidth, backgroundColor: theme.background, opacity: editable ? 1 : 0.4 },
        ]}>
        {leading}
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
    borderRadius: Radius.control,
    gap: Spacing.two,
  },
  /* 한 줄 칸의 높이 · 안쪽 여백은 테두리 굵기에 따라 달라져 그릴 때 얹는다. */
  boxMultiline: { minHeight: Layout.textarea, alignItems: 'flex-start' },
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
