import { Pressable } from 'react-native';

import { Layout } from './theme';
import { ProductSymbol } from './product-symbol';
import { TextField } from './text-field';
import { useTheme } from './use-theme';

export type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  /** 키보드의 검색 키를 눌렀을 때. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /**
   * 주면 글자를 받지 않고 **누르면 넘어가기만 하는** 칸이 된다 — 검색 홈의 칸이
   * 그 자리다. 검색 홈과 자동완성 화면이 같은 모양을 쓰되 하나만 글자를 받는다.
   */
  onPress?: () => void;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * 검색 칸. `TextField` 위에 돋보기와 지우기를 얹은 한 겹이다.
 *
 * 검색 홈 · 자동완성 · 결과가 같은 것을 쓴다. 칸의 높이 · 테두리 · 포커스 색은
 * `TextField`(tokens.json `component.field`)가 정하고, 여기는 안에 무엇이 붙는지만
 * 안다 — 입력 칸을 두 벌 만들지 않는다.
 */
export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  onPress,
  autoFocus,
  testID,
}: SearchBarProps) {
  const theme = useTheme();

  const field = (
    <TextField
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={(event) => onSubmit?.(event.nativeEvent.text)}
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      /* 넘어가기만 하는 칸은 글자를 받지 않는다 — 키보드가 잠깐 떴다 지는 것을 막는다. */
      editable={onPress ? false : undefined}
      /* 바깥 Pressable이 누름을 받으므로 칸 자체는 스크린 리더에서 빠진다. */
      accessibilityElementsHidden={onPress ? true : undefined}
      importantForAccessibility={onPress ? 'no-hide-descendants' : undefined}
      autoFocus={autoFocus}
      returnKeyType="search"
      autoCorrect={false}
      testID={onPress ? undefined : testID}
      leading={
        <ProductSymbol name="magnifier" size={Layout.iconInline} color={theme.textAssistive} />
      }
      trailing={
        value.length > 0 && !onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            onPress={() => onChangeText('')}
            hitSlop={HIT_SLOP}>
            <ProductSymbol name="close" size={Layout.iconInline} color={theme.textAssistive} />
          </Pressable>
        ) : null
      }
    />
  );

  if (!onPress) return field;

  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      onPress={onPress}
      testID={testID}>
      {field}
    </Pressable>
  );
}

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
