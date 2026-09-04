import type { ColorValue } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { Colors } from './theme';

export type ProductSymbolName = 'house' | 'magnifier' | 'pickMark' | 'twoPeople' | 'person' | 'hall' | 'sdm' | 'snap' | 'planner';

export function ProductSymbol({ name, size = 24, color = Colors.light.text }: { name: ProductSymbolName; size?: number; color?: ColorValue }) {
  const common = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'house' && <><Path {...common} d="M3.5 10.5 12 3.8l8.5 6.7v9.2H3.5z" /><Path {...common} d="M9 19.7v-5.2h6v5.2M2.5 10.8 12 3l9.5 7.8" /></>}
      {name === 'magnifier' && <><Circle {...common} cx="10.5" cy="10.5" r="6.2" /><Path {...common} d="m15.2 15.2 5 5" /></>}
      {/* Pick Mark(CLAUDE.md §2 확정본)만 stroke 1.9 — 다른 아이콘의 공통 stroke(1.8)와 별개. */}
      {name === 'pickMark' && <><Path {...common} strokeWidth={1.9} d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z" /><Path {...common} strokeWidth={1.9} d="m8.7 11.9 2.2 2.2 4.4-4.4" /></>}
      {name === 'twoPeople' && <><Circle {...common} cx="8.5" cy="8" r="3" /><Circle {...common} cx="16.5" cy="8" r="3" /><Path {...common} d="M3.8 19c.5-3.2 2.1-5 4.7-5s4.2 1.8 4.7 5M10.8 19c.5-3.2 2.1-5 4.7-5s4.2 1.8 4.7 5" /></>}
      {name === 'person' && <><Circle {...common} cx="12" cy="7.5" r="3.5" /><Path {...common} d="M5.5 20c.7-4 2.8-6 6.5-6s5.8 2 6.5 6" /></>}
      {name === 'hall' && <><Path {...common} d="M4 20h16M6 20v-8h12v8M4 12l8-6 8 6M9 20v-4h6v4" /></>}
      {name === 'sdm' && <><Path {...common} d="M8 20V9.5a4 4 0 0 1 8 0V20M6 20h12M9.5 6.5h5" /><Path {...common} d="M10 3.5h4" /></>}
      {name === 'snap' && <><Rect {...common} x="3.5" y="7" width="17" height="12" rx="2" /><Path {...common} d="m8 7 1.5-2h5L16 7" /><Circle {...common} cx="12" cy="13" r="3.2" /></>}
      {name === 'planner' && <><Rect {...common} x="4" y="5" width="16" height="15" rx="2" /><Path {...common} d="M8 3v4M16 3v4M4 10h16" /></>}
    </Svg>
  );
}
