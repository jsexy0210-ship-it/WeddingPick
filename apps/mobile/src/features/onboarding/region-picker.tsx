import { REGION_DISTRICTS, WEDDING_REGIONS, type WeddingRegion } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { CheckCircle } from './check-circle';
import { UNDECIDED_LABEL, type Answers } from './flow';
import { OptionChip } from './option-chip';

/**
 * 지역(2/5). 시/도 칩 아홉 개 + «아직 정하지 않았어요», 시/도를 고르면 그 아래
 * 구·군 목록이 같은 화면에 열린다 — 시/도 → 구는 내부 선택이지 Step이 아니다.
 *
 * 구·군 행은 52 · 상하 14 · 글자 16 · 체크 22(v3.21 «구 선택 행 높이»). **시/도 칩도 구 행도
 * 단일 선택 라디오다(v3.23)** — 시/도 하나, 시/군/구 하나. 다른 것을 누르면 바뀌고, 고른 것을
 * 다시 눌러도 풀리지 않는다. 지역을 비우는 길은 «아직 정하지 않았어요» 하나다.
 *
 * 목록은 화면 스크롤 안에서 같이 늘어난다. 서울 25개 구가 길어도 여기에 스크롤을
 * 따로 두지 않는다(SPEC §13.5.5).
 */
export function RegionPicker({
  value,
  onChange,
}: {
  value: Answers['region'];
  onChange: (next: NonNullable<Answers['region']>) => void;
}) {
  const theme = useTheme();
  const region = value?.region ?? null;
  const undecided = value !== null && region === null;
  const districts = region ? (REGION_DISTRICTS[region] ?? null) : null;

  function pickRegion(next: WeddingRegion) {
    onChange({ region: next, district: null });
  }

  function pickDistrict(district: string) {
    if (region === null) return;

    onChange({ region, district });
  }

  return (
    <View style={styles.section}>
      <View style={styles.chips}>
        {WEDDING_REGIONS.map((item) => (
          <OptionChip key={item} label={item} selected={region === item} onPress={() => pickRegion(item)} />
        ))}
        <OptionChip
          label={UNDECIDED_LABEL}
          selected={undecided}
          onPress={() => onChange({ region: null, district: null })}
        />
      </View>

      {districts ? (
        <View style={styles.rows}>
          {districts.map((district) => {
            const selected = value?.district === district;

            return (
              <Pressable
                key={district}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={district}
                onPress={() => pickDistrict(district)}>
                <View style={styles.row}>
                  <ThemedText
                    type="t6"
                    themeColor={selected ? 'text' : 'textSecondary'}
                    style={[styles.name, selected && styles.selectedName]}>
                    {district}
                  </ThemedText>
                  <CheckCircle size={CHECK} checked={selected} outline />
                </View>
                <View style={[styles.hr, { backgroundColor: theme.border }]} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/* 시안 고정값 — 행 52 · 상하 14 · 체크 22. */
const ROW_MIN_HEIGHT = 52;
const ROW_PADDING_Y = 14;
const CHECK = 22;

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.rowPaddingY,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  rows: { gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: ROW_PADDING_Y,
  },
  name: { flex: 1, minWidth: 0 },
  selectedName: { fontWeight: 700 },
  hr: { height: 1 },
});
