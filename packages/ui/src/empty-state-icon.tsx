import { View } from 'react-native';

import { ProductSymbol } from './product-symbol';
import { Colors } from './theme';
import { useTheme } from './use-theme';

/** 정보가 없는 상태에서 공통으로 쓰는 장식 아이콘. */
export function EmptyStateIcon({ size = 48, mode = 'auto' }: { size?: number; mode?: 'auto' | 'light' }) {
  const theme = useTheme();
  const colors = mode === 'light' ? Colors.light : theme;

  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundElement,
      }}>
      <ProductSymbol name="file" size={size / 2} color={colors.textAssistive} />
    </View>
  );
}
