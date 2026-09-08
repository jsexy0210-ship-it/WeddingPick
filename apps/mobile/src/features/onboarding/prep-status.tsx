import {
  PREPARATION_GROUPS,
  PREPARATION_NOT_STARTED_LABEL,
  PREPARATION_OTHER_GROUP_TITLE,
  VENDOR_CATEGORY_LABEL,
  type PreparationGroup,
  type VendorCategory,
} from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { chunk } from './calendar';
import { CheckCircle } from './check-circle';

/**
 * 준비 현황(3/5). 핸드오프 v3.22 §13.6 «준비 현황 · 그룹 분류 · 12개 업종».
 *
 *   시작 준비     결정사 · 웨딩홀
 *   스드메        스튜디오 · 드레스 · 메이크업 · 헤어변형
 *   본식 준비     본식스냅 · 부케 · 청첩장
 *   예물 · 신혼   예물 · 혼수 · 허니문
 *   기타 상태     아직 시작 전이에요
 *
 * 그룹 제목 14/700 gray600 · 2열 카드 48 · radius 10 · 글자 16/700 · 체크 20 ·
 * 사이 8. 항목 하나인 그룹은 1열 full-width. 다중 선택이고, «아직 시작 전이에요»는
 * 나머지 전부와 배타다 — 고르면 업종 선택이 다 풀리고, 업종을 하나라도 고르면
 * 이것이 풀린다.
 *
 * 그룹 제목 오른쪽의 «전체 선택»은 그룹이 다 켜지면 «전체 해제»(코랄)가 된다
 * (2026-09-08 오더). 기타 상태 그룹에는 없다 — 항목이 하나뿐이다.
 *
 * **이 Step만 화면 스크롤이 생긴다.** 12개를 뷰포트에 맞추려면 카드가 34까지
 * 작아져 누르기 어렵다. 그래도 스크롤은 화면 전체 하나다(StepFrame의
 * ScrollView) — 여기에 목록 전용 스크롤을 두지 않는다(SPEC §13.5.5).
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

            {chunk(group.categories, COLUMNS).map((row) => (
              <View key={row.join('-')} style={styles.row}>
                {row.map((category) => (
                  <Card
                    key={category}
                    label={VENDOR_CATEGORY_LABEL[category]}
                    selected={selected.includes(category)}
                    onPress={() => toggle(category)}
                  />
                ))}
                {/* 홀수 줄의 빈 칸 — 마지막 카드가 두 칸을 다 먹지 않게 한다. */}
                {row.length < COLUMNS ? <View style={styles.spacer} /> : null}
              </View>
            ))}
          </View>
        );
      })}

      <View style={styles.group}>
        <View style={styles.head}>
          <ThemedText type="t7" themeColor="textAssistive" style={styles.title}>
            {PREPARATION_OTHER_GROUP_TITLE}
          </ThemedText>
        </View>
        <View style={styles.row}>
          <Card label={PREPARATION_NOT_STARTED_LABEL} selected={notStarted} onPress={onNotStarted} />
        </View>
      </View>

      <ThemedText type="t7" themeColor="textAssistive">
        여러 개 고를 수 있어요
      </ThemedText>
    </View>
  );
}

/**
 * 카드 하나. 시안 `prog()` — 48 · radius 10 · 좌우 14 · 켜지면 흰 바탕에 코랄
 * 1.5px 테두리, 꺼지면 gray50 바탕에 투명 테두리(자리를 지켜 크기가 안 튄다).
 */
function Card({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.cell}>
      <ThemedView
        style={[
          styles.card,
          selected
            ? { backgroundColor: theme.background, borderColor: theme.tint }
            : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
        ]}>
        <ThemedText
          type="t6"
          numberOfLines={1}
          themeColor={selected ? 'text' : 'textSecondary'}
          style={styles.label}>
          {label}
        </ThemedText>
        <CheckCircle size={CHECK} checked={selected} />
      </ThemedView>
    </Pressable>
  );
}

const COLUMNS = 2;
/* 시안 고정값 — 카드 48 · 좌우 14 · 체크 20 · 라벨과 체크 사이 6. */
const CARD_HEIGHT = 48;
const CARD_PADDING_X = 14;
const CHECK = 20;
const CARD_GAP = 6;

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
  row: { flexDirection: 'row', gap: Spacing.two },
  cell: { flex: 1, minWidth: 0 },
  spacer: { flex: 1 },
  card: {
    height: CARD_HEIGHT,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    paddingHorizontal: CARD_PADDING_X,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CARD_GAP,
  },
  label: { flexShrink: 1, fontWeight: 700 },
});
