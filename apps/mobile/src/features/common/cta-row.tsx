import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Layout } from '@weddingpick/ui';

/**
 * CTA 줄 — 버튼 한 개면 좌우 여백 안을 꽉 채우고, 두 개면 정본 비율로 나눈다.
 *
 *   dockSingle   [              ctaFull  flex 1              ]
 *   dockPair     [ ctaGhost flex 1 ] 10 [ ctaWide  flex 1.4   ]
 *
 * 정본: `docs/design/React_Native/home.js:784~788`(`dockSingle` · `dockPair` gap 10 ·
 * `ctaFull` · `ctaWide` flex 1.4 · `ctaGhost` flex 1), `my.js:337~345`(`dockSingle` ·
 * `ctaFull` · `ctaKakao` flex 1 · `dockTwo` gap 10 · `btnGhostHalf` 1 · `ctaHalf` 1.4),
 * `note.js:134~135` · `note.js:386~388`(`sheetDock` gap 8 · `btnGhost` 1 · `btnPrimary` 1.4) ·
 * `pick.js:392~393` · `search.js:356~362` — 전부 같은 꼴이다. 한 개면 `flex:1`(폭 전체)이다.
 *
 * **왜 생겼나(2026-09-26 대표 지시 「단일 Primary CTA가 반 폭으로 그려진다」).**
 * `ActionButton`은 폭을 갖지 않는다 — 세로 컨테이너에서는 `alignItems: stretch`로
 * 늘어나지만, **가로 줄(`flexDirection: 'row'`) 안에 그냥 넣으면 글자 폭만큼만 선다.**
 * 공용 `Dock`(`features/wedding/screen-kit.tsx`)이 자식을 가로 줄에 그대로 넣고 있었고,
 * 호출하는 쪽이 `flex: 1` 칸을 씌우는 것을 잊은 화면(배우자 초대 · 초대 받음 · 지출 넣기 …)
 * 에서 단일 CTA가 반 폭 이하로 그려졌다. 칸 씌우기를 부르는 쪽에 맡기지 않고 이 줄이 한다.
 *
 * 버튼 높이는 건드리지 않는다 — 높이는 `ActionButton size`가 정한다.
 */
export function CtaRow({
  children,
  gap = Layout.cardGap,
  style,
}: {
  children: ReactNode;
  /** 버튼 사이. 기본 10(dockPair · dockTwo). 웨딩노트 시트 `sheetDock`은 8(note.js:386)이다. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  /* `{cond ? <A/> : null}`의 null은 칸이 아니다 — 보이는 버튼 수로 나눈다. */
  const items = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.row, { gap }, style]}>
      {items.map((child, index) => (
        <View key={child.key ?? index} style={{ flex: ctaSlotFlex(items.length, index) }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** 정본 ctaWide — 두 개일 때 오른쪽(Primary)이 1.4. */
export const CTA_PRIMARY_FLEX = 1.4;

/**
 * 칸 하나의 flex. 한 개면 1(꽉 참), 두 개면 왼쪽 보조 1 · 오른쪽 Primary 1.4,
 * 세 개 이상은 정본에 없는 꼴이라(`DESIGN_UNRESOLVED`) 똑같이 나눈다.
 */
export function ctaSlotFlex(count: number, index: number): number {
  if (count === 2) return index === 1 ? CTA_PRIMARY_FLEX : 1;

  return 1;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
