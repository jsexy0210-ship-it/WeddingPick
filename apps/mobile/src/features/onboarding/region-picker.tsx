import { REGION_DISTRICTS, WEDDING_REGIONS, type WeddingRegion } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { CheckCircle } from './check-circle';
import { UNDECIDED_LABEL, type Answers } from './flow';
import { OptionRow } from './option-row';

/**
 * 지역 2/3 — 보기는 규격서 docs/figma-spec/onboarding.txt의 65 줄(`OptionRow`)이다. 피그마의 보기 세 개
 * («서울 · 경기·인천 · 다른 지역»)는 시안용 가짜 값이고, **지역은 짧은 꼴 아홉**(`WEDDING_REGIONS` ·
 * 용어 규칙)이라 아홉 + «아직 정하지 않았어요»를 같은 줄 모양으로 세운다.
 *
 * 구 세부(區) 목록은 규격서에 없는 자리다 — 기존 정본(행 52 · 체크 22)을 그대로 둔다(CLAUDE.md 3번).
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
      <View style={styles.rowsGap}>
        {WEDDING_REGIONS.map((item) => (
          <OptionRow key={item} label={item} selected={region === item} onPress={() => pickRegion(item)} />
        ))}
        <OptionRow
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

/* 구 목록 — 기존 정본 고정값: 행 52 · 상하 14 · 체크 22. */
const ROW_MIN_HEIGHT = 52;
const ROW_PADDING_Y = 14;
const CHECK = 22;

const styles = StyleSheet.create({
  /* 보기 «mar 40 0 0 0» — 질문 아래 40. 좌우는 화면 24. */
  section: {
    marginTop: Spacing.five + Spacing.two,
    paddingHorizontal: Layout.gutter,
    gap: Layout.rowPaddingY,
  },
  /* 줄 사이 «mar 0 0 12 0». */
  rowsGap: { gap: Layout.inlineGap },
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
