import {
  REGION_DISTRICTS,
  WEDDING_REGIONS,
  shortDistrictName,
  type WeddingRegion,
} from '@weddingpick/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, Layout, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

import { Wheel, WheelGroup } from './wheel';

/** 고른 지역. `district`가 null이면 시/도 전체다. */
export type PickedRegion = { region: WeddingRegion; district: string | null };

/**
 * 지역 선택 시트 — **휠 2열(시/도 · 시/군/구)**.
 *
 *   ━━                                  그래버 40×4(공용 SheetPanel)
 *   지역 선택                      ✕
 *   ┌─────────────┬─────────────┐
 *   │    경기     │    성남     │     밴드에 걸린 것이 고른 값
 *   │    서울     │    강남     │
 *   └─────────────┴─────────────┘
 *   서울 강남
 *   [       확인       ]
 *
 * **2026-09-15 대표 지시로 생겼다** — 「온보딩 지역 선택 시 바텀시트가 올라오며
 * 시/도 · 시/군/구 휠 타입으로 변경한다」. 그 전에는 짧은 꼴 아홉을 줄로 늘어놓고
 * 고른 뒤 구를 다시 줄로 골랐다(`region-picker.tsx`).
 *
 * **휠은 예식일 시트와 같은 것이다**(`wheel.tsx`) — 새 라이브러리를 들이지 않았다.
 *
 * **시/도는 짧은 꼴 아홉 그대로다**(`WEDDING_REGIONS` · 대표님이 따로 정해 두신 것).
 * **시/군/구는 `REGION_DISTRICTS`에서 온다** — 저장소에 이미 있던 목록이라 지어낸
 * 값이 없다. 「그 외」는 구 목록이 없다(전국이라는 뜻이라 더 좁힐 것이 없다).
 *
 * **보이는 것만 짧게 줄인다** — 「강남구」 → 「강남」(`shortDistrictName`). 저장하는
 * 값은 「강남구」 그대로다. 그 함수가 「중구」처럼 두 글자인 이름은 손대지 않는다.
 */
export function RegionPickerSheet({
  visible,
  value,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  /** 이미 고른 지역. 휠은 그 값에 맞춰 굴려진 채로 열린다. */
  value: PickedRegion | null;
  onConfirm: (picked: PickedRegion) => void;
  onDismiss: () => void;
}) {
  return (
    /* BottomSheet는 닫히면 children을 통째로 내린다 — 열 때마다 새로 마운트되어 지난번 굴려 둔 자리가 남지 않는다. */
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetBody value={value} onConfirm={onConfirm} onDismiss={onDismiss} />
    </BottomSheet>
  );
}

function SheetBody({
  value,
  onConfirm,
  onDismiss,
}: {
  value: PickedRegion | null;
  onConfirm: (picked: PickedRegion) => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  /* 고른 것이 없으면 첫 시/도에서 시작한다 — 짐작으로 지역을 정하지 않는다. */
  const [region, setRegion] = useState<WeddingRegion>(value?.region ?? WEDDING_REGIONS[0]);
  const [district, setDistrict] = useState<string>(value?.district ?? WHOLE);

  /*
   * 시/군/구 목록. 맨 위는 언제나 «전체»다 — 시/도만 고르고 더 좁히지 않는 것이
   * 답이 아닌 것은 아니다. 「그 외」는 구가 없어 «전체» 하나만 선다.
   */
  const districts = [WHOLE, ...(REGION_DISTRICTS[region] ?? [])];
  /* 시/도를 굴리면 지난 구가 새 목록에 없을 수 있다 — 그때는 «전체»로 당긴다. */
  const current = districts.includes(district) ? district : WHOLE;
  const picked: PickedRegion = { region, district: current === WHOLE ? null : current };

  return (
    <SheetPanel style={styles.sheet}>
      <View style={styles.head}>
        <ThemedText type="t4" style={styles.bold}>
          {S.title}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel={S.close} onPress={onDismiss} style={styles.close}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.textAssistive} strokeWidth={2} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6 6 18" />
          </Svg>
        </Pressable>
      </View>

      <WheelGroup>
        <Wheel
          accessibilityLabel={S.region}
          flex={FLEX_REGION}
          items={WEDDING_REGIONS}
          format={(item) => item}
          value={region}
          onChange={setRegion}
        />
        <Wheel
          accessibilityLabel={S.district}
          flex={FLEX_DISTRICT}
          items={districts}
          format={(item) => (item === WHOLE ? WHOLE : shortDistrictName(item))}
          value={current}
          onChange={setDistrict}
        />
      </WheelGroup>

      <View style={styles.picked}>
        <ThemedText type="t5" numberOfLines={1} style={styles.bold}>
          {current === WHOLE ? region : `${region} ${shortDistrictName(current)}`}
        </ThemedText>
      </View>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="sheet" label={S.confirm} onPress={() => onConfirm(picked)} />
      </View>
    </SheetPanel>
  );
}

/** 시/군/구를 더 좁히지 않았을 때 휠에 서는 말. 값으로는 `district: null`이다. */
const WHOLE = '전체';

const S = {
  title: '지역 선택',
  close: '닫기',
  region: '시/도',
  district: '시/군/구',
  confirm: '확인',
} as const;

/** 두 열은 같은 폭이다 — 「경기」와 「남양주」가 서로를 밀지 않는다. */
const FLEX_REGION = 1;
const FLEX_DISTRICT = 1;

const styles = StyleSheet.create({
  /* 예식일 시트와 같은 틀 — 패딩 · 둥글기 · 그래버는 SheetPanel. 요소 사이만 16. */
  sheet: { gap: Spacing.three },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
    minHeight: Layout.sheetClose,
  },
  close: {
    width: Layout.sheetClose,
    height: Layout.sheetClose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 결과 줄 — 예식일 시트의 pickedRow와 같은 자리다. 여기는 D-day가 없어 한 줄이다. */
  picked: { paddingHorizontal: Spacing.half },
  /* width 100% · flex 0 0 — 세로 컨테이너에서 늘어나지 않는다(SPEC §13.7). */
  cta: { width: '100%', flexGrow: 0, flexShrink: 0 },
  bold: { fontWeight: 700 },
});
