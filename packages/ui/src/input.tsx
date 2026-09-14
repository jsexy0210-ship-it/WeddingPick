import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { FontSize, LineHeight } from './typography';
import { Fonts, Layout, Radius, Spacing } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

export type InputProps = Omit<TextInputProps, 'style'> & {
  /** 칸 위에 붙는 이름. 없으면 `accessibilityLabel`이나 `placeholder`가 대신 읽힌다. */
  label?: string;
  /**
   * 오류 문구.
   *
   * 오류를 **색만으로 알리지 않는다** — 테두리가 붉어지는 동시에 이 문구가 칸 아래
   * 뜬다. 색을 구분하지 못하는 사람에게 붉은 테두리는 아무 말도 하지 않는다.
   */
  errorText?: string;
  /** 평소 안내. `errorText`가 있으면 그쪽이 자리를 가져간다. */
  helpText?: string;
  /** 칸 안 왼쪽에 놓이는 것. 검색창의 돋보기가 여기 들어간다. */
  leading?: ReactNode;
  /** 칸 안 오른쪽에 놓이는 것. 지우기 단추가 여기 들어간다. */
  trailing?: ReactNode;
  /** 칸 바깥을 감싸는 스타일. 너비를 정하는 자리다. */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * 글자를 받는 칸.
 *
 * 화면 20곳이 `TextInput`을 직접 그리고 있어 높이 · 테두리 · 포커스 색이 자리마다
 * 달랐다. 그 값은 전부 여기 한 벌만 둔다 — 높이 `Layout.field`, 기본 테두리
 * `fieldBorder`, 포커스 테두리는 잉크(`text`)다. 포커스에 코랄을 쓰지 않는다:
 * 코랄은 다음 행동의 색이라 칸마다 켜지면 행동이 어디인지 흐려진다.
 */
export function Input({
  label,
  errorText,
  helpText,
  leading,
  trailing,
  containerStyle,
  editable,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);
  const disabled = editable === false;

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  const borderColor = hasError ? theme.negative : focused ? theme.text : theme.fieldBorder;

  return (
    <View style={containerStyle}>
      {label ? (
        <ThemedText type="t7" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}

      <View
        style={[
          styles.field,
          multiline ? styles.fieldMultiline : null,
          {
            borderColor,
            borderWidth: focused || hasError ? 1.5 : 1,
            backgroundColor: disabled ? theme.backgroundElement : theme.background,
          },
        ]}>
        {leading}
        <TextInput
          accessibilityLabel={label}
          editable={editable}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.textAssistive}
          style={[styles.input, { color: disabled ? theme.textDisabled : theme.text }]}
          {...rest}
        />
        {trailing}
      </View>

      {errorText ? (
        <ThemedText type="t7" style={[styles.note, { color: theme.negative }]}>
          {errorText}
        </ThemedText>
      ) : helpText ? (
        <ThemedText type="t7" themeColor="textAssistive" style={styles.note}>
          {helpText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: Spacing.two,
  },
  field: {
    height: Layout.field,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  /** 여러 줄이면 높이를 풀고 위에서부터 쌓는다. */
  fieldMultiline: {
    height: undefined,
    minHeight: Layout.field,
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    /** 입력 칸의 글자도 본문이다 — FontSize.t6. */
    fontFamily: Fonts.sans,
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    padding: 0,
  },
  note: {
    marginTop: Spacing.one,
  },
});
