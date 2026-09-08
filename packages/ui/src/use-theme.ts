/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from './theme';
import { useColorScheme } from './use-color-scheme';

export function useTheme() {
  return Colors[useColorScheme()];
}
