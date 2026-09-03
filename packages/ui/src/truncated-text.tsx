import { Text, type TextProps } from 'react-native';

import { FontSize, LineHeight } from './typography';
import { useTheme } from './use-theme';

export type TruncatedTextProps = Omit<TextProps, 'numberOfLines' | 'ellipsizeMode'> & {
  /** 최대 줄 수. 기본 2줄. */
  maxLines?: 1 | 2;
  bold?: boolean;
};

/**
 * WP-ST-013 — 긴 콘텐츠 2줄 cap.
 *
 * 업체명 1줄 · 금액 1줄 · 건수 1줄. 넘치면 말줄임하고 줄바꿈하지 않는다.
 */
export function TruncatedText({
  maxLines = 2,
  bold = false,
  style,
  children,
  ...rest
}: TruncatedTextProps) {
  const theme = useTheme();

  return (
    <Text
      numberOfLines={maxLines}
      ellipsizeMode="tail"
      style={[
        {
          fontSize: FontSize.t6,
          lineHeight: LineHeight.t6,
          fontWeight: bold ? 700 : 400,
          color: theme.text,
          overflow: 'hidden',
        },
        style,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}
