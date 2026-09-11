import { BUDGET_BANDS, type BudgetBandKey } from '@weddingpick/domain';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import {
  ActionButton,
  FilterChip,
  Layout,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

/**
 * 필터 — WP-SRCH-005. 시안 06-search #16d.
 *
 * **바텀시트다.** 그래버 → 제목 24/32 ↔ «초기화» 16/700 #4D5159 → 조건 묶음(제목 16/22 700 ·
 * 칩 38/16) → «실 제보가 있는 곳만» 토글 → 아래 붙은 dock의 CTA «{n}곳 보기». 전체 화면이
 * 아니다 — 뒤의 결과가 비쳐 보여야 무엇을 좁히는 중인지 알 수 있다.
 *
 * CTA의 수는 **고르는 대로 바뀐다**(시안 «조건을 바꿀 때마다 하단 버튼의 결과 수가 함께
 * 바뀝니다»). 그 수는 시트가 스스로 세지 않고 부모가 넘긴다 — 결과 화면이 이미 같은
 * 조건으로 서버를 부르고 있어서, 여기서 또 부르면 같은 질의를 두 번 한다.
 *
 * 시안의 「촬영일」 · 「조건(원본 전체 · 야외 포함 …)」 두 묶음은 두지 않는다. 업체의
 * 촬영 가능일도 상품 구성도 아직 어디에도 모아둔 것이 없다 — 눌러도 아무것도 걸리지
 * 않는 칩을 두는 것이 빠뜨리는 것보다 나쁘다.
 */

/** spec/strings.ko.json search.filter.* */
const S = {
  title: '필터',
  reset: '초기화',
  /** «{n}곳 보기». */
  apply: (count: number) => `${count}곳 보기`,
  groupRegion: '지역',
  groupBudget: '예산',
  onlyVerified: '실 제보가 있는 곳만',
  onlyVerifiedDesc: '금액을 볼 수 있는 곳만 보기',
};

export type SearchFilterValue = {
  region: string | null;
  budget: BudgetBandKey | null;
  onlyVerified: boolean;
};

export function FilterSheet({
  visible,
  value,
  regions,
  count,
  onChange,
  onApply,
  onDismiss,
}: {
  visible: boolean;
  value: SearchFilterValue;
  regions: readonly string[];
  /** 지금 조건으로 몇 곳인가. CTA 라벨에 그대로 들어간다. */
  count: number;
  onChange: (next: SearchFilterValue) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  /*
   * 열려 있는 동안에는 부모의 값을 그대로 보여준다. 시트가 자기 사본을 들고 있으면
   * 결과 수와 칩이 어긋나는 순간이 생긴다 — CTA는 부모가 센 수를 적는데 칩은 사본을
   * 그리기 때문이다.
   */
  const set = (patch: Partial<SearchFilterValue>) => onChange({ ...value, ...patch });

  const switchProps = {
    trackColor: { true: theme.tint, false: theme.track },
    thumbColor: theme.onTint,
    ios_backgroundColor: theme.track,
  };

  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetPanel style={styles.panel}>
        <View style={styles.head}>
          <ThemedText type="t3">{S.title}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={S.reset}
            hitSlop={Spacing.three}
            onPress={() => onChange({ region: null, budget: null, onlyVerified: false })}>
            {/* 시안 «초기화» 16/700 #4D5159 — 코랄이 아니다. 되돌리기는 강조할 행동이 아니다. */}
            <ThemedText type="t6" themeColor="textSecondary" style={styles.bold}>
              {S.reset}
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}>
          {/* 지역 */}
          <View style={styles.group}>
            <ThemedText type="t6" style={styles.bold}>
              {S.groupRegion}
            </ThemedText>
            <View style={styles.chips}>
              {regions.map((region) => (
                <FilterChip
                  key={region}
                  label={region}
                  size="sheet"
                  accent="tint"
                  role="radio"
                  selected={value.region === region}
                  onPress={() => set({ region: value.region === region ? null : region })}
                />
              ))}
            </View>
          </View>

          {/* 예산 — 구간 칩 넷(BUDGET_BANDS). 만원 숫자 입력이 아니다. */}
          <View style={styles.group}>
            <ThemedText type="t6" style={styles.bold}>
              {S.groupBudget}
            </ThemedText>
            <View style={styles.chips}>
              {BUDGET_BANDS.map((band) => (
                <FilterChip
                  key={band.key}
                  label={band.label}
                  size="sheet"
                  accent="tint"
                  role="radio"
                  selected={value.budget === band.key}
                  onPress={() => set({ budget: value.budget === band.key ? null : band.key })}
                />
              ))}
            </View>
          </View>

          {/* 실 제보가 있는 곳만 — 금액을 볼 수 있는 곳만 남긴다. */}
          <View style={styles.group}>
            <ThemedText type="t6" style={styles.bold}>
              {S.onlyVerified}
            </ThemedText>
            <View style={styles.toggleRow}>
              <ThemedText type="t6" themeColor="textSecondary">
                {S.onlyVerifiedDesc}
              </ThemedText>
              <Switch
                value={value.onlyVerified}
                onValueChange={(next) => set({ onlyVerified: next })}
                accessibilityLabel={S.onlyVerified}
                {...switchProps}
              />
            </View>
          </View>
        </ScrollView>

        {/* dock — 화면당 Primary CTA 하나. 고른 조건으로 몇 곳인지 그대로 적는다. */}
        <ThemedView style={[styles.dock, { borderTopColor: theme.line }]}>
          <ActionButton variant="primary" size="xlarge" label={S.apply(count)} onPress={onApply} />
        </ThemedView>
      </SheetPanel>
    </BottomSheet>
  );
}

/** 시안 06-search #16d — 시트 본문 «max-height:440px». 8단 사다리 밖의 시트 전용 값이다. */
const BODY_MAX_HEIGHT = 440;

const styles = StyleSheet.create({
  /* SheetPanel이 padding 12 24 (28+safe) · gap 20을 준다. 여기서는 dock만 좌우로 늘린다. */
  panel: { gap: Spacing.three },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /* 시안: 조건 묶음은 440까지만 늘고 그 안에서 스크롤한다 — dock이 밀려 내려가지 않게. */
  body: { maxHeight: BODY_MAX_HEIGHT },
  bodyContent: { gap: Layout.sectionGap, paddingBottom: Spacing.one },
  group: { gap: Layout.cardGap },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.chipGap },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    gap: Spacing.three,
  },
  dock: {
    borderTopWidth: 1,
    paddingTop: Layout.sheetPaddingTop,
  },
  bold: { fontWeight: 700 },
});
