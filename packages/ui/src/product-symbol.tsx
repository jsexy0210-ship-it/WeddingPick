import type { ColorValue } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { Colors } from './theme';

/**
 * 서비스 아이콘. **브랜드 마크(Pick Mark)는 여기 없다** — `WeddingMark`가 원본이다.
 * 한때 `pickMark`가 여기 사본으로 있었는데 획 두께가 1.8로 확정본(1.9)과 달라
 * 탭 바만 다른 마크를 쓰고 있었다.
 */
export type ProductSymbolName = 'house' | 'magnifier' | 'twoPeople' | 'calendar' | 'person' | 'hall' | 'sdm' | 'snap' | 'planner' | 'warning';

export function ProductSymbol({ name, size = 24, color = Colors.light.text }: { name: ProductSymbolName; size?: number; color?: ColorValue }) {
  const common = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'house' && <><Path {...common} d="M3.5 10.5 12 3.8l8.5 6.7v9.2H3.5z" /><Path {...common} d="M9 19.7v-5.2h6v5.2M2.5 10.8 12 3l9.5 7.8" /></>}
      {name === 'magnifier' && <><Circle {...common} cx="10.5" cy="10.5" r="6.2" /><Path {...common} d="m15.2 15.2 5 5" /></>}
      {name === 'twoPeople' && <><Circle {...common} cx="8.5" cy="8" r="3" /><Circle {...common} cx="16.5" cy="8" r="3" /><Path {...common} d="M3.8 19c.5-3.2 2.1-5 4.7-5s4.2 1.8 4.7 5M10.8 19c.5-3.2 2.1-5 4.7-5s4.2 1.8 4.7 5" /></>}
      {/* 웨딩일정 탭(v3.16). 메뉴가 일정 중심이라 두 사람 대신 캘린더 — path는 핸드오프 값 그대로. */}
      {name === 'calendar' && <><Path {...common} d="M5.2 5.6h13.6a1.8 1.8 0 0 1 1.8 1.8v11.2a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V7.4a1.8 1.8 0 0 1 1.8-1.8z" /><Path {...common} d="M3.4 10.4h17.2M8.4 3.4v4M15.6 3.4v4" /></>}
      {name === 'person' && <><Circle {...common} cx="12" cy="7.5" r="3.5" /><Path {...common} d="M5.5 20c.7-4 2.8-6 6.5-6s5.8 2 6.5 6" /></>}
      {name === 'hall' && <><Path {...common} d="M4 20h16M6 20v-8h12v8M4 12l8-6 8 6M9 20v-4h6v4" /></>}
      {name === 'sdm' && <><Path {...common} d="M8 20V9.5a4 4 0 0 1 8 0V20M6 20h12M9.5 6.5h5" /><Path {...common} d="M10 3.5h4" /></>}
      {name === 'snap' && <><Rect {...common} x="3.5" y="7" width="17" height="12" rx="2" /><Path {...common} d="m8 7 1.5-2h5L16 7" /><Circle {...common} cx="12" cy="13" r="3.2" /></>}
      {name === 'planner' && <><Rect {...common} x="4" y="5" width="16" height="15" rx="2" /><Path {...common} d="M8 3v4M16 3v4M4 10h16" /></>}
      {/* 전면 오류 화면(WP-APP-006)이 쓴다. 느낌표는 선으로만 — 채우면 경고색을
          쓰게 되고, 의미색은 상태 배지에만 쓴다. */}
      {name === 'warning' && <><Path {...common} d="M12 3.8 21 19.5H3z" /><Path {...common} d="M12 10v4.2M12 16.8v.1" /></>}
    </Svg>
  );
}
