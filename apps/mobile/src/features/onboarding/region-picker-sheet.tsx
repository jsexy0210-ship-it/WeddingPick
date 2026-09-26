import {
  REGION_DISTRICTS,
  WEDDING_REGIONS,
  type WeddingRegion,
} from '@weddingpick/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton, Layout } from '@weddingpick/ui';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';

import { Wheel, WheelGroup } from './wheel';

/** 고른 지역. 시/군/구가 없는 지역만 `district: null`이다. */
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
 * 고른 뒤 구를 다시 줄로 골랐다(옛 `region-picker.tsx` — MY 내 웨딩설정도 2026-09-26 이 휠로 옮기며 지웠다).
 *
 * **휠은 예식일 시트와 같은 것이다**(`wheel.tsx`) — 새 라이브러리를 들이지 않았다.
 *
 * **시/도는 짧은 꼴 아홉 그대로다**(`WEDDING_REGIONS` · 대표님이 따로 정해 두신 것).
 * **시/군/구는 `REGION_DISTRICTS`에서 온다** — 저장소에 이미 있던 목록이라 지어낸
 * 값이 없다. 「그 외」는 구 목록이 없다(전국이라는 뜻이라 더 좁힐 것이 없다).
 *
 * 휠과 선택 필드는 정본처럼 시/군/구의 전체 이름(예: 「강남구」)을 보여준다.
 * 저장 값과 표시 값이 같으므로 별도 축약을 하지 않는다.
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

  /* 고른 것이 없으면 첫 시/도에서 시작한다 — 짐작으로 지역을 정하지 않는다. */
  const [region, setRegion] = useState<WeddingRegion>(value?.region ?? WEDDING_REGIONS[0]);
  const [district, setDistrict] = useState<string | null>(value?.district ?? null);

  /*
   * «전체»는 선택지로 두지 않는다. 시/군/구가 있는 시/도는 반드시 구체 값을 고르고,
   * 구 목록이 없는 «그 외»만 district=null을 유지한다.
   */
  const districts = REGION_DISTRICTS[region] ?? [];
  const current =
    district !== null && districts.includes(district)
      ? district
      : (districts[0] ?? null);
  const picked: PickedRegion = { region, district: current };

  return (
    <SheetPanel style={styles.sheet}>
      <SheetHeader title={S.title} closeLabel={S.close} onClose={onDismiss} />

      <WheelGroup>
        <Wheel
          accessibilityLabel={S.region}
          flex={FLEX_REGION}
          items={WEDDING_REGIONS}
          format={(item) => item}
          value={region}
          onChange={setRegion}
        />
        {current !== null ? (
          <Wheel
            accessibilityLabel={S.district}
            flex={FLEX_DISTRICT}
            items={districts}
            format={(item) => item}
            value={current}
            onChange={setDistrict}
          />
        ) : null}
      </WheelGroup>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="sheet" label={S.confirm} onPress={() => onConfirm(picked)} />
      </View>
    </SheetPanel>
  );
}


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
  /* RN 정본 home.jsx WP-AUTH-003 wheelSheet — 요소 간격 14. 패딩/그래버는 SheetPanel이 맡는다. */
  sheet: { gap: Layout.sectionHeadGap },
  /* width 100% · flex 0 0 — 세로 컨테이너에서 늘어나지 않는다(SPEC §13.7). */
  cta: { width: '100%', flexGrow: 0, flexShrink: 0 },
});
