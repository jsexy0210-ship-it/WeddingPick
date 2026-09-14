import {
  PREPARATION_GROUPS,
  PREPARATION_NOT_STARTED_LABEL,
  PREPARATION_OTHER_GROUP_TITLE,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { chunk } from './calendar';
import { CheckCircle } from './check-circle';

/**
 * 준비 현황(3/5). 시안 20-onboarding-v2 `prog()` · screens.json WP-APP-020 ③ ·
 * CHANGELOG v3.22 «그룹 제목 14px #868B94 · 2열 카드 48px · radius 10 · 글자 16 ·
 * 체크 20 · gap 8. 항목 1개 그룹은 1열 full-width».
 *
 *   시작 준비     결정사 · 웨딩홀
 *   스드메        스튜디오 · 드레스 · 메이크업 · 헤어변형
 *   본식 준비     본식스냅 · 부케 · 청첩장
 *   예물 · 신혼   예물 · 혼수 · 허니문
 *   기타 상태     아직 시작 전이에요
 *
 * **2열 카드다** — v3.19의 «칩 가로 wrap»(36 · «전체 선택/해제»)은 v3.22가 다시
 * 카드로 되돌렸고(최신 md가 이긴다) 시안도 카드라 그 형태만 남긴다. 카드 48 ·
 * radius 10 · 좌우 14 · 이름과 체크 사이 6 · 켜지면 흰 바탕 + 코랄 1.5px 테두리 +
 * 오른쪽 체크 20, 꺼지면 gray50 바탕에 투명 테두리(자리를 지켜 크기가 안 튄다).
 * 이름 16/700 — 켜지면 ink, 꺼지면 #4D5159.
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

  return (
    <View style={styles.section}>
      {PREPARATION_GROUPS.map((group) => (
        <View key={group.key} style={styles.group}>
          <ThemedText type="t7" themeColor="textAssistive" style={styles.title}>
            {group.title}
          </ThemedText>

          <CardGrid
            items={group.categories.map((category) => ({
              key: category,
              label: VENDOR_CATEGORY_LABEL[category],
              selected: selected.includes(category),
              onPress: () => toggle(category),
            }))}
          />
        </View>
      ))}

      <View style={styles.group}>
        <ThemedText type="t7" themeColor="textAssistive" style={styles.title}>
          {PREPARATION_OTHER_GROUP_TITLE}
        </ThemedText>
        <CardGrid
          items={[{ key: 'not-started', label: PREPARATION_NOT_STARTED_LABEL, selected: notStarted, onPress: onNotStarted }]}
        />
      </View>

      <ThemedText type="t7" themeColor="textAssistive">
        여러 개 고를 수 있어요
      </ThemedText>
    </View>
  );
}

type CardItem = { key: string; label: string; selected: boolean; onPress: () => void };

/**
 * 2열 격자(`repeat(2, 1fr)` · gap 8). 항목이 하나뿐인 그룹은 1열 full-width다.
 * 3개짜리 그룹의 마지막 줄은 빈 칸으로 채워 카드 폭을 맞춘다 — 홀로 남은 카드가
 * 가로로 늘어나면 위 줄과 어긋난다.
 */
function CardGrid({ items }: { items: readonly CardItem[] }) {
  const columns = items.length === 1 ? 1 : COLUMNS;

  return (
    <View style={styles.grid}>
      {chunk(items, columns).map((row) => (
        <View key={row.map((item) => item.key).join('-')} style={styles.row}>
          {row.map(({ key, ...item }) => (
            <Card key={key} {...item} />
          ))}
          {Array.from({ length: columns - row.length }, (_, index) => (
            <View key={`pad-${index}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** 카드 하나. 시안 `prog()` — 48 · radius 10 · 좌우 14 · 이름 16/700 · 오른쪽 체크 20. */
function Card({ label, selected, onPress }: Omit<CardItem, 'key'>) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.cell,
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
    </Pressable>
  );
}

const COLUMNS = 2;
/*
 * 시안 고정값 — 카드 좌우 14 · 이름과 체크 사이 6 · 체크 20 · 테두리 1.5.
 * 카드 높이 48은 토큰 Layout.controlLarge와 같다.
 */
const CARD_PADDING_X = 14;
const CARD_GAP = 6;
const CHECK = 20;
const CARD_BORDER = 1.5;

const styles = StyleSheet.create({
  /* 시안 padSec — 좌우 24 · 아래 24 · 그룹 사이 12. */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.rowPaddingY,
  },
  /* 시안 progGroup — 제목과 격자 사이 8. */
  group: { gap: Spacing.two },
  title: { fontWeight: 700 },
  grid: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  /* minmax(0,1fr). */
  cell: { flex: 1, flexBasis: 0, minWidth: 0 },
  card: {
    height: Layout.controlLarge,
    borderRadius: Radius.medium,
    borderWidth: CARD_BORDER,
    paddingHorizontal: CARD_PADDING_X,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CARD_GAP,
  },
  label: { flex: 1, minWidth: 0, fontWeight: 700 },
});
