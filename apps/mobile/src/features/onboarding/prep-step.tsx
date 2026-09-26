import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Layout } from '@weddingpick/ui';

import {
  PREP_CARDS,
  choosePrepManual,
  choosePrepVendor,
  clearPrepCard,
  isPrepCardSelected,
  prepVendorOf,
  type Answers,
  type PrepCard,
} from './flow';
import { OptionRow } from './option-row';
import { PrepVendorSheet } from './prep-vendor-sheet';

/**
 * 진행 상황(3/5) — 정본 `home.jsx` WP-AUTH-004 `PREP_CATS` 카드 넷(이름 17/700 · 부제 13 ·
 * 체크 22) + 카드마다 업체 검색 시트(2026-09-26 대표 지시).
 *
 *   웨딩홀   예식장 · 식대 · 대관          ○     고르기 전 — 정본 부제
 *   웨딩홀   강남 A 웨딩홀                  ✓     업체를 고른 뒤 — 부제 자리에 업체 이름
 *   웨딩홀   우리동네 웨딩컨벤션            ✓     직접 입력한 뒤 — 부제 자리에 적은 이름
 *
 * **카드를 누르면 켜고 끄지 않고 시트를 연다.** 시트에서 업체를 고르면 카드가 켜지고
 * (업종 전부 «결정 완료») 부제 자리에 업체 이름이 선다. «아직 정한 곳이 없어요»는
 * 카드를 지금의 미정 상태(꺼짐)로 돌리고 업체도 지운다. X · 딤은 아무것도 바꾸지 않는다.
 *
 * 고른 업체는 온보딩 «완료»에서 설정과 **같은 요청**으로 서버에 가고, 서버가 같은
 * 트랜잭션에서 Pick(`vendor_candidates`)에 담고 그 업종의 결정으로 남긴다
 * (`POST /v1/me/setup` `preparedVendorIds`). 직접 입력한 이름은 결정만 남는다
 * (`preparedManualVendors` — 업체가 없어 담기 · 상담 예약은 없다).
 */
export function PrepStep({
  value,
  onChange,
}: {
  value: Answers['prep'];
  onChange: (next: NonNullable<Answers['prep']>) => void;
}) {
  /* 닫히는 동안에도 시트 머리 글자가 남도록 마지막으로 연 카드를 들고 있는다. */
  const [card, setCard] = useState<PrepCard | null>(null);
  const [open, setOpen] = useState(false);
  const categories = value?.categories ?? [];

  return (
    <>
      <View style={styles.options}>
        {PREP_CARDS.map((one) => {
          const vendor = prepVendorOf(value, one);

          return (
            <OptionRow
              key={one.key}
              role="checkbox"
              variant="prep"
              label={one.name}
              description={vendor?.name ?? one.description}
              selected={isPrepCardSelected(one, categories)}
              onPress={() => {
                setCard(one);
                setOpen(true);
              }}
            />
          );
        })}
      </View>

      <PrepVendorSheet
        visible={open}
        card={card}
        onChoose={(vendor) => {
          if (card) onChange(choosePrepVendor(value, card, vendor));
          setOpen(false);
        }}
        onManual={(name) => {
          if (card) onChange(choosePrepManual(value, card, name));
          setOpen(false);
        }}
        onNone={() => {
          if (card) onChange(clearPrepCard(value, card));
          setOpen(false);
        }}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  /* 시안 prepSec — 좌우 24 · 아래 20 · 카드 사이 10. */
  options: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    gap: Layout.iconTextGap,
  },
});
