import type { ColorValue } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { Colors } from './theme';

/**
 * 서비스 아이콘. **브랜드 마크(Pick Mark)는 여기 없다** — `WeddingMark`가 원본이다.
 * 한때 `pickMark`가 여기 사본으로 있었는데 획 두께가 1.8로 확정본(1.9)과 달라
 * 탭 바만 다른 마크를 쓰고 있었다.
 */
export type ProductSymbolName = 'house' | 'magnifier' | 'twoPeople' | 'calendar' | 'person' | 'hall' | 'sdm' | 'snap' | 'planner' | 'warning' | 'bell' | 'gear' | 'more' | 'chevronRight' | 'chevronLeft' | 'close';

/**
 * 획 두께. 헤더·탭 아이콘(24)은 1.8, chevron(18)은 2, 닫기(14)는 2.4 — 05-root ·
 * 08c 핸드오프 값 그대로다. 작은 아이콘일수록 굵어야 같은 무게로 보인다.
 */
const STROKE: Partial<Record<ProductSymbolName, number>> = { chevronRight: 2, chevronLeft: 2, close: 2.4 };

export function ProductSymbol({ name, size = 24, color = Colors.light.text }: { name: ProductSymbolName; size?: number; color?: ColorValue }) {
  const common = { stroke: color, strokeWidth: STROKE[name] ?? 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 홈·검색·MY 탭 아이콘은 05-root 핸드오프 path 그대로(획 1.8). */}
      {name === 'house' && <><Path {...common} d="M3.6 10.4 12 3.8l8.4 6.6V19a1.6 1.6 0 0 1-1.6 1.6H5.2A1.6 1.6 0 0 1 3.6 19z" /><Path {...common} d="M9.6 20.6v-6.2h4.8v6.2" /></>}
      {name === 'magnifier' && <><Path {...common} d="M11 4.2a6.9 6.9 0 1 0 0 13.8 6.9 6.9 0 0 0 0-13.8z" /><Path {...common} d="M16.2 16.2 20.8 20.8" /></>}
      {name === 'twoPeople' && <><Circle {...common} cx="8.5" cy="8" r="3" /><Circle {...common} cx="16.5" cy="8" r="3" /><Path {...common} d="M3.8 19c.5-3.2 2.1-5 4.7-5s4.2 1.8 4.7 5M10.8 19c.5-3.2 2.1-5 4.7-5s4.2 1.8 4.7 5" /></>}
      {/* 웨딩일정 탭(v3.16). 메뉴가 일정 중심이라 두 사람 대신 캘린더 — path는 핸드오프 값 그대로. */}
      {name === 'calendar' && <><Path {...common} d="M5.2 5.6h13.6a1.8 1.8 0 0 1 1.8 1.8v11.2a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V7.4a1.8 1.8 0 0 1 1.8-1.8z" /><Path {...common} d="M3.4 10.4h17.2M8.4 3.4v4M15.6 3.4v4" /></>}
      {name === 'person' && <><Path {...common} d="M12 11.6a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /><Path {...common} d="M4.8 20.6v-.6a6 6 0 0 1 6-6h2.4a6 6 0 0 1 6 6v.6" /></>}
      {name === 'hall' && <><Path {...common} d="M4 20h16M6 20v-8h12v8M4 12l8-6 8 6M9 20v-4h6v4" /></>}
      {name === 'sdm' && <><Path {...common} d="M8 20V9.5a4 4 0 0 1 8 0V20M6 20h12M9.5 6.5h5" /><Path {...common} d="M10 3.5h4" /></>}
      {name === 'snap' && <><Rect {...common} x="3.5" y="7" width="17" height="12" rx="2" /><Path {...common} d="m8 7 1.5-2h5L16 7" /><Circle {...common} cx="12" cy="13" r="3.2" /></>}
      {name === 'planner' && <><Rect {...common} x="4" y="5" width="16" height="15" rx="2" /><Path {...common} d="M8 3v4M16 3v4M4 10h16" /></>}
      {/* 전면 오류 화면(WP-APP-006)이 쓴다. 느낌표는 선으로만 — 채우면 경고색을
          쓰게 되고, 의미색은 상태 배지에만 쓴다. */}
      {/* 헤더 오른쪽 아이콘(05-root · 03-home): 알림 종 · 설정 톱니 · 더보기 ⋮. */}
      {name === 'bell' && <><Path {...common} d="M18 9.4a6 6 0 1 0-12 0c0 4.8-2 5.8-2 5.8h16s-2-1-2-5.8" /><Path {...common} d="M13.7 19.4a2 2 0 0 1-3.4 0" /></>}
      {name === 'gear' && <><Path {...common} d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" /><Path {...common} d="M19.4 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0V20a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H4a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3H9.7a1.5 1.5 0 0 0 .9-1.4V4a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6H20a1.5 1.5 0 0 0-1.4.9z" /></>}
      {name === 'more' && <Path {...common} d="M12 13.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zM12 7a1.4 1.4 0 1 0 0-2.8A1.4 1.4 0 0 0 12 7zM12 19.8a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z" />}
      {/* 행 끝 chevron(18 · #ADB1BA) · 뒤로가기(24) · 칩 삭제 X(14). */}
      {name === 'chevronRight' && <Path {...common} d="m9 6 6 6-6 6" />}
      {name === 'chevronLeft' && <Path {...common} d="M14.5 5 8 12l6.5 7" />}
      {name === 'close' && <Path {...common} d="M6 6l12 12M18 6 6 18" />}
      {name === 'warning' && <><Path {...common} d="M12 3.8 21 19.5H3z" /><Path {...common} d="M12 10v4.2M12 16.8v.1" /></>}
    </Svg>
  );
}
