import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

export type AuthTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  /** 비밀번호 필드 — 눈 아이콘으로 직접 보게 한다. 확인 입력을 두 번 받지 않는다. */
  secure?: boolean;
  error?: string | null;
  editable?: boolean;
};

/**
 * 이메일·비밀번호 화면들이 공유하는 입력 필드. 이 앱 첫 텍스트 입력이라
 * 별도 컴포넌트로 뺐다 — 다음 화면이 생겨도 여기 하나만 고치면 된다.
 *
 * `spec/tokens.json` `size.field`(52, `Layout.controlXLarge`와 같은 값) ·
 * `radius.control`(6, `Radius.input`)을 그대로 쓴다.
 */
export function AuthTextField({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  secure,
  error,
  editable = true,
}: AuthTextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <ThemedText type="t7" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View
        style={[
          styles.box,
          {
            borderColor: error ? theme.negative : focused ? theme.tint : theme.border,
            backgroundColor: editable ? theme.background : theme.backgroundElement,
          },
        ]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textAssistive}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoComplete={autoComplete}
          secureTextEntry={secure && !visible}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
            onPress={() => setVisible((was) => !was)}
            hitSlop={8}>
            <EyeIcon open={visible} color={theme.textAssistive} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText type="t7" themeColor="negative">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={open ? 'M9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z' : 'M4 4l16 16'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  box: {
    height: Layout.controlXLarge,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: { flex: 1, height: '100%', fontSize: 17 },
});
