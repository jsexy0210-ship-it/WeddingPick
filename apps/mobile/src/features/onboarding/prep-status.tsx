import {
  PREPARATION_GROUPS,
  PREPARATION_NOT_STARTED_LABEL,
  PREPARATION_OTHER_GROUP_TITLE,
  VENDOR_CATEGORY_LABEL,
  type PreparationGroup,
  type VendorCategory,
} from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 준비 현황(3/5). SPEC §13.6 «컨트롤 규격 (확정) · 진행 현황 칩».
 *
 *   시작 준비     결정사 · 웨딩홀
 *   스드메        스튜디오 · 드레스 · 메이크업 · 헤어변형
 *   본식 준비     본식스냅 · 부케 · 청첩장
 *   예물 · 신혼   예물 · 혼수 · 허니문
 *   기타 상태     아직 시작 전이에요
 *
 * **2열 카드가 아니라 줄바꿈하는 칩이다** — height 36 · radius 999 · padding 0 13 ·
 * gap 5 · 글자 14/700 · 체크 12. 선택하면 `#FFF5F2` 바탕 + 코랄 1.5px 안쪽 테두리 +
 * 코랄 글자, 왼쪽에 체크. 칩은 `flexShrink: 0`(`flex:0 0 auto`) — 없으면 줄 끝의
 * 칩이 눌려 잘린다. 그룹 제목 14/700 gray600, 오른쪽에 «전체 선택 / 전체 해제».
 *
 * 다중 선택이고, «아직 시작 전이에요»는 나머지 전부와 배타다 — 고르면 업종 선택이
 * 다 풀리고, 업종을 하나라도 고르면 이것이 풀린다.
 *
 * **이 Step만 화면 스크롤이 생길 수 있다.** 그래도 스크롤은 화면 전체 하나다
 * (StepFrame의 ScrollView) — 여기에 목록 전용 스크롤을 두지 않는다(SPEC §13.5.5).
 */
export function PrepStatus({
  selected,
  notStarted,
  onChange,
  onNotStarted,
}: {
  selected: readonly VendorCategory[];
  /** «아직 시작 전이에요»를 골랐는가 — 아무것도 안 고른 것(둘 다 아님)과 다르다. */
  notStarted: boolean;
  onChange: (next: VendorCategory[]) => void;
  onNotStarted: () => void;
}) {
  function toggle(category: VendorCategory) {
    onChange(
      selected.includes(category)
        ? selected.filter((one) => one !== category)
        : [...selected, category]
    );
  }

  function toggleGroup(group: PreparationGroup) {
    const whole = group.categories.every((category) => selected.includes(category));

    onChange(
      whole
        ? selected.filter((one) => !group.categories.includes(one))
        : [...selected, ...group.categories.filter((one) => !selected.includes(one))]
    );
  }

  return (
    <View style={styles.section}>
      {PREPARATION_GROUPS.map((group) => {
        const whole = group.categories.every((category) => selected.includes(category));

        return (
          <View key={group.key} style={styles.group}>
            <View style={styles.head}>
              <ThemedText type="t7" themeColor="textAssistive" style={styles.title}>
                {group.title}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${group.title} ${whole ? '전체 해제' : '전체 선택'}`}
                hitSlop={Spacing.two}
                onPress={() => toggleGroup(group)}>
                <ThemedText type="t7" themeColor={whole ? 'tint' : 'textAssistive'} style={whole && styles.title}>
                  {whole ? '전체 해제' : '전체 선택'}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.chips}>
              {group.categories.map((category) => (
                <Chip
                  key={category}
                  label={VENDOR_CATEGORY_LABEL[category]}
                  selected={selected.includes(category)}
                  onPress={() => toggle(category)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <View style={styles.group}>
        <View style={styles.head}>
          <ThemedText type="t7" themeColor="textAssistive" style={styles.title}>
            {PREPARATION_OTHER_GROUP_TITLE}
          </ThemedText>
        </View>
        <View style={styles.chips}>
          <Chip label={PREPARATION_NOT_STARTED_LABEL} selected={notStarted} onPress={onNotStarted} />
        </View>
      </View>

      <ThemedText type="t7" themeColor="textAssistive">
        여러 개 고를 수 있어요
      </ThemedText>
    </View>
  );
}

/**
 * 칩 하나. 시안 `prog()` — 36 · pill · 좌우 13 · 켜지면 #FFF5F2 바탕에 코랄 1.5px
 * 테두리와 코랄 글자 + 12px 체크, 꺼지면 gray50 바탕에 투명 테두리(자리를 지켜
 * 크기가 안 튄다).
 */
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  /* #FFF5F2는 라이트 값이다 — 어두운 모드에는 그 자리의 토큰(tintSubtle)을 쓴다. */
  const selectedBackground = theme === Colors.light ? PREP_CHIP_SELECTED_BACKGROUND : theme.tintSubtle;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: selectedBackground, borderColor: theme.tint }
          : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
      ]}>
      {selected ? (
        <Svg width={CHECK} height={CHECK} viewBox="0 0 24 24" fill="none">
          <Path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke={theme.tint}
            strokeWidth={CHECK_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
      <ThemedText type="t7" numberOfLines={1} themeColor={selected ? 'tint' : 'textSecondary'} style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * 선택 칩 바탕. SPEC §13.6 «선택 시 #FFF5F2» = §14 `color-mix()` 고정값 «#FFF5F2(surface)».
 * 테마 토큰 tintSubtle(#FFF0EE)과 다른 값이라 여기 이름 붙여 둔다. 토큰이 생기면
 * 여기만 바꾼다.
 */
const PREP_CHIP_SELECTED_BACKGROUND = '#FFF5F2';
/*
 * 시안 고정값 — 칩 좌우 13 · 칩 사이 5 · 체크 12 · 체크 선 3.4 · 테두리 1.5.
 * spacing 토큰에 13과 5가 없다(gapChip은 8이지만 SPEC이 이 칩의 gap을 5로 못박았다).
 */
const CHIP_PADDING_X = 13;
const CHIP_GAP = 5;
const CHECK = 12;
const CHECK_STROKE = 3.4;
const CHIP_BORDER = 1.5;

const styles = StyleSheet.create({
  /* 시안 padSec — 좌우 24 · 아래 24 · 그룹 사이 12. */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.rowPaddingY,
  },
  group: { gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: 700 },
  /* 시안 chipWrap — 줄바꿈 · 사이 5. */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: CHIP_GAP },
  chip: {
    flexShrink: 0,
    height: Layout.chip,
    borderRadius: Radius.pill,
    borderWidth: CHIP_BORDER,
    paddingHorizontal: CHIP_PADDING_X,
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_GAP,
  },
  label: { fontWeight: 700 },
});
