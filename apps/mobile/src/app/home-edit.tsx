import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import {
  DEFAULT_HOME_LAYOUT,
  HOME_FIXED_LABEL,
  HOME_SECTIONS,
  moveSection,
  readHomeLayout,
  writeHomeLayout,
  type HomeLayout,
  type HomeSectionKey,
} from '@/features/home/layout';
import { CheckDot, Hero, NoteBox, Section } from '@/features/settings/my-kit';

/** 시안 12b-remaining ④ «홈 편집 · WP-HOME-007»의 문구 그대로. */
const S = {
  title: '홈 편집',
  done: '완료',
  close: '닫기',
  heroLines: ['보고 싶은 것만', '남겨보세요'],
  fixedGroup: '항상 보여요',
  fixedTail: '고정',
  orderGroup: '순서 바꾸기',
  on: '켬',
  off: '숨김',
  noteTitle: '숨겨도 기록은 그대로 있어요',
  noteBody: '언제든 다시 켜면 그대로 보여요.',
  reset: '처음 순서로 되돌리기',
} as const;

/** 한 행의 높이. 드래그가 몇 칸을 지났는지 이 값으로 센다(행 + 아래 구분선). */
const ROW_HEIGHT = Layout.rowMinHeight + Layout.rowGap;

/**
 * 홈 편집 · WP-HOME-007. 홈 맨 아래에서 들어온다.
 *
 * 시안대로 닫기 내비 + «완료», 히어로, «항상 보여요» 한 행, «순서 바꾸기» 목록이다.
 * 손잡이(≡)를 끌어 자리를 바꾸고 행을 눌러 켜고 끈다.
 *
 * **바꾸는 즉시 저장한다.** «완료»는 저장 버튼이 아니라 나가는 문이다 — 토글과 드래그는
 * 상태 변경이지 제출이 아니고(알림 설정과 같은 규칙), 저장을 «완료»에 묶으면 뒤로 나간
 * 사람의 변경이 조용히 사라진다.
 *
 * 숨김은 **보여줄지**만 정한다. 준비 현황·제보·후보는 서버에 그대로 남는다 —
 * 시안의 «숨겨도 기록은 지우지 않는다»가 이 뜻이다.
 */
export default function HomeEditScreen() {
  const theme = useTheme();
  const [layout, setLayout] = useState<HomeLayout | null>(null);

  useEffect(() => {
    void readHomeLayout().then(setLayout);
  }, []);

  // 읽는 동안에도 기본 구성을 그린다 — 편집 화면이 빈 채로 잠깐 뜨는 것이 더 나쁘다.
  const shown = layout ?? DEFAULT_HOME_LAYOUT;

  function apply(next: HomeLayout) {
    setLayout(next);
    void writeHomeLayout(next);
  }

  function toggle(key: HomeSectionKey) {
    const hidden = shown.hidden.includes(key)
      ? shown.hidden.filter((hiddenKey) => hiddenKey !== key)
      : [...shown.hidden, key];

    apply({ ...shown, hidden });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={S.close}
            hitSlop={Spacing.one}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
            <ProductSymbol name="close" size={Layout.iconTab} color={theme.text} />
          </Pressable>
          <ThemedText type="t5" numberOfLines={1} style={styles.navTitle}>
            {S.title}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={Spacing.two}
            style={styles.navAction}>
            <ThemedText type="t6" themeColor="tint" style={styles.bold}>
              {S.done}
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero lines={S.heroLines} />

          <Section title={S.fixedGroup}>
            <View style={styles.rows}>
              <FixedRow />
            </View>
          </Section>

          <Section title={S.orderGroup}>
            <View style={styles.rows}>
              {shown.order.map((key, index) => (
                <OrderRow
                  key={key}
                  label={HOME_SECTIONS.find((section) => section.key === key)?.label ?? key}
                  hidden={shown.hidden.includes(key)}
                  index={index}
                  count={shown.order.length}
                  onToggle={() => toggle(key)}
                  onMove={(to) => apply({ ...shown, order: moveSection(shown.order, index, to) })}
                />
              ))}
            </View>
          </Section>

          <Section>
            <NoteBox title={S.noteTitle} body={S.noteBody} />
          </Section>

          {/* 시안 상태 «초기화» — 기본 순서로 되돌린다. 숨김도 함께 풀린다. */}
          <Section>
            <Pressable
              accessibilityRole="button"
              onPress={() => apply(DEFAULT_HOME_LAYOUT)}
              hitSlop={Spacing.one}
              style={({ pressed }) => [styles.resetRow, pressed && styles.pressed]}>
              <ThemedText type="t6" themeColor="textSecondary">
                {S.reset}
              </ThemedText>
            </Pressable>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 「항상 보여요」 한 행 — 체크 원 · 이름 · 회색 «고정». 누를 수 없다. */
function FixedRow() {
  const theme = useTheme();

  return (
    <View>
      <View style={styles.row}>
        <CheckDot on />
        <ThemedText type="t5" numberOfLines={1} style={styles.rowName}>
          {HOME_FIXED_LABEL}
        </ThemedText>
        <Badge kind="none" style={styles.badge}>
          {S.fixedTail}
        </Badge>
      </View>
      <View style={[styles.hr, { backgroundColor: theme.border }]} />
    </View>
  );
}

/**
 * 「순서 바꾸기」 한 행. 손잡이(≡)를 끌면 자리가 바뀌고, 행을 누르면 켜고 꺼진다.
 *
 * 드래그는 PanResponder로 짠다 — 행이 넷뿐이고 높이가 고정이라 움직인 거리를 행 높이로
 * 나누면 몇 칸을 지났는지 그대로 나온다. 목록 하나 때문에 새 의존성을 들이지 않는다
 * (웹 export도 같은 코드로 돈다).
 */
function OrderRow({
  label,
  hidden,
  index,
  count,
  onToggle,
  onMove,
}: {
  label: string;
  hidden: boolean;
  index: number;
  count: number;
  onToggle: () => void;
  onMove: (to: number) => void;
}) {
  const theme = useTheme();
  const shift = useMemo(() => new Animated.Value(0), []);
  const [dragging, setDragging] = useState(false);

  /*
   * responder는 한 번만 만든다 — 끌고 있는 도중에 다시 만들면 그 제스처가 끊긴다.
   * 대신 최신 자리·개수·콜백을 여기 담아 두고, **손을 뗄 때** 읽는다(렌더 중에는 읽지
   * 않는다). 자리가 바뀐 뒤에도 옛 index로 계산하면 엉뚱한 곳으로 간다.
   */
  const latest = useRef({ index, count, onMove });

  useEffect(() => {
    latest.current = { index, count, onMove };
  });

  /*
   * 규칙(react-hooks/refs)이 useMemo 안을 렌더로 보고 `latest.current` 접근을 막는다.
   * 실제로 읽는 시점은 손을 뗄 때이고, responder를 렌더마다 다시 만들면 끌던 제스처가
   * 끊긴다 — 여기서는 ref가 맞아서 이 한 줄만 끈다.
   */
  const pan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => setDragging(true),
        onPanResponderMove: (_event, gesture) => shift.setValue(gesture.dy),
        onPanResponderRelease: (_event, gesture) => {
          const { index: from, count: total, onMove: move } = latest.current;
          const steps = Math.round(gesture.dy / ROW_HEIGHT);
          const to = Math.min(Math.max(from + steps, 0), total - 1);

          setDragging(false);
          shift.setValue(0);
          if (to !== from) move(to);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          shift.setValue(0);
        },
      }),
    [shift],
  );

  return (
    <Animated.View
      style={[
        styles.orderRow,
        { transform: [{ translateY: shift }] },
        dragging && { zIndex: 1, backgroundColor: theme.backgroundElement },
      ]}>
      <View style={styles.row}>
        <View
          {...pan.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={`${label} 순서 바꾸기`}
          accessibilityActions={ORDER_ACTIONS}
          onAccessibilityAction={(event) => {
            const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
            const to = Math.min(Math.max(index + step, 0), count - 1);

            if (to !== index) onMove(to);
          }}
          style={styles.handle}>
          {/* 시안 lead «≡» 18px gray400. */}
          <ThemedText type="t5" themeColor="textDisabled">
            ≡
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: !hidden }}
          accessibilityLabel={label}
          onPress={onToggle}
          style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}>
          <ThemedText
            type="t5"
            themeColor={hidden ? 'textDisabled' : 'text'}
            numberOfLines={1}
            style={styles.rowName}>
            {label}
          </ThemedText>
          <Badge kind={hidden ? 'none' : 'ok'} style={styles.badge}>
            {hidden ? S.off : S.on}
          </Badge>
        </Pressable>
      </View>
      <View style={[styles.hr, { backgroundColor: theme.border }]} />
    </Animated.View>
  );
}

/** 끌 수 없는 사람을 위한 길 — 보조 기술이 위·아래로 한 칸씩 옮긴다. */
const ORDER_ACTIONS = [
  { name: 'decrement', label: '위로' },
  { name: 'increment', label: '아래로' },
] as const;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /*
   * 13-my-sub navBack — 56 · `padding:0 20px 0 12px` · gap 8. 뒤로 자리에 닫기가
   * 온다(시안 close: true).
   *
   * 좌우를 거터(24)로 두고 상자를 `marginLeft: -8`로 끌어당기고 있었다 — 상자가
   * 16에서 시작해 아이콘이 24에 앉았다. 다른 화면은 전부 20이다(`NavBar` ·
   * `SubScreen` · `BackBar`). 2026-09-11 대표 지시로 맞췄다. 값은 이 주석이 원래부터
   * 가리키던 13-my-sub의 navBack 그대로다 — 코드가 제 출처와 어긋나 있었다.
   */
  nav: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.navPaddingRight,
    gap: Layout.navGap,
  },
  navButton: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1 },
  navAction: { minHeight: Layout.iconButton, justifyContent: 'center' },

  content: { paddingBottom: Spacing.five },

  rows: { gap: Layout.rowGap },
  orderRow: { backgroundColor: 'transparent' },
  row: {
    minHeight: Layout.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Layout.rowPaddingY,
  },
  /* 시안 lead 24 고정 폭. 손잡이는 잡기 쉬워야 해서 세로는 행 높이만큼 준다. */
  handle: {
    width: Layout.iconTab,
    minHeight: Layout.rowMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: Layout.rowMinHeight,
  },
  rowName: { flex: 1 },
  /*
   * 배지는 기본이 `alignSelf: 'flex-start'`다(pick-status-badge STATUS_BADGE_STYLE).
   * 행 높이를 56으로 잡아둔 이 목록에서는 그대로 두면 이름보다 17px 위로 뜬다.
   */
  badge: { alignSelf: 'center' },
  hr: { height: 1 },

  resetRow: { minHeight: Layout.rowMinHeight, justifyContent: 'center' },

  pressed: { opacity: 0.6 },
  bold: { fontWeight: '700' },
});
