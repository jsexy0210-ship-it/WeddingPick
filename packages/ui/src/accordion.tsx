import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { Layout, Radius, Spacing, USE_NATIVE_DRIVER } from './theme';
import { ProductSymbol } from './product-symbol';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from './use-theme';

export type AccordionItem = {
  key: string;
  title: string;
  body: string;
};

export type AccordionProps = {
  items: readonly AccordionItem[];
};

/**
 * 펼쳐서 읽는 목록. 디자인 핸드오프 20번의 FAQ.
 *
 * **한 번에 하나만 펼친다.** 여럿을 펼쳐두면 화면이 길어져 무엇을 읽던 중인지
 * 잃는다. 열려 있던 것을 다시 누르면 닫힌다.
 *
 * ## 값이 어디서 왔는가
 *
 * **피그마에 아코디언이 없다.** `my.txt`의 고객지원 블록은 펼치는 것이 아니라
 * 넘어가는 메뉴 행이라 다른 부품이다. 그래서 SEED `accordion` · `accordion-item`이
 * 채운다(2026-09-15 MASTER 확정: 「피그마에 실측값이 있으면 이긴다. 없는 자리만
 * SEED에서」). 값은 `spec/seed-components.json`에 뽑혀 있다.
 *
 *   항목 간격 12 · 안쪽 여백 16 · 제목 16/22 · 본문 13/18 · 셰브런 20 · 회전 300ms
 *
 * **굵기만 SEED를 따르지 않는다.** SEED는 제목 · 본문 모두 500(Medium)인데 우리는
 * Pretendard를 넷만 싣는다 — Regular 400 · SemiBold 600 · Bold 700 · ExtraBold 800.
 * **500이 없다.** 없는 굵기를 적으면 안드로이드가 흉내 내서(합성) 글자가 뭉개진다 —
 * `apps/mobile/assets/fonts/README.md`가 굵기를 넷 싣는 이유로 적어 둔 그 문제다.
 * 그래서 **가장 가까우면서 실제로 실려 있는 600**으로 간다(2026-09-15 MASTER 확정).
 *
 * **곡률은 SEED의 12가 아니라 16이다.** 피그마에 r12가 한 곳도 없고 카드는 r16(68곳)
 * 아니면 r22(41곳)다. 최상위 규칙 3번이 「피그마에 없는 화면은 피그마의 «규칙»으로
 * 만든다」고 적는데, 곡률에 대해서는 **피그마가 규칙을 갖고 있다.** 없는 값을 새로
 * 만들지 않는다(`radius.$note` 「이 외 값을 만들지 않는다」).
 */
export function Accordion({ items }: AccordionProps) {
  const theme = useTheme();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ThemedView style={styles.list}>
      {items.map((item) => {
        const expanded = open === item.key;

        return (
          <ThemedView
            key={item.key}
            type="backgroundElement"
            style={[styles.item, expanded ? styles.itemOpen : null]}>
            <Pressable
              accessibilityRole="button"
              // 읽는 기계에 펼침 상태를 알린다. 화살표만으로는 전해지지 않는다.
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : item.key)}
              style={styles.head}>
              <ThemedText type="t6" style={[styles.title, styles.grow]}>
                {item.title}
              </ThemedText>
              <Chevron expanded={expanded} color={theme.textAssistive} />
            </Pressable>

            {expanded ? (
              <ThemedText type="micro" themeColor="textSecondary" style={styles.body}>
                {item.body}
              </ThemedText>
            ) : null}
          </ThemedView>
        );
      })}
    </ThemedView>
  );
}

/**
 * 펼침 표시. 닫혔을 때 아래를 보고, 펼치면 180° 돌아 위를 본다.
 *
 * **`+`·`−` 글자를 쓰지 않는다** — 글꼴마다 굵기와 높이가 달라 같은 자리에서 다르게
 * 앉는다. SEED도 셰브런이고 크기 20 · 회전 300ms를 적는다.
 */
function Chevron({ expanded, color }: { expanded: boolean; color: string }) {
  const spin = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(spin, {
      toValue: expanded ? 1 : 0,
      duration: CHEVRON_SPIN_MS,
      easing: Easing.bezier(0.35, 0, 0.35, 1),
      /* 웹에는 네이티브 드라이버가 없다 — true를 그대로 넘기면 콘솔 경고가 쌓인다. */
      useNativeDriver: USE_NATIVE_DRIVER,
    });

    animation.start();

    // 화면을 떠나면 멈춘다. 안 그러면 안 보이는 곳에서 계속 돈다.
    return () => animation.stop();
  }, [expanded, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <ProductSymbol name="chevronDown" size={Layout.iconRow} color={color} />
    </Animated.View>
  );
}

/** SEED `accordion-item` «suffixIcon.rotateDuration 300ms» · `$duration.d6`. */
const CHEVRON_SPIN_MS = 300;

const styles = StyleSheet.create({
  /** SEED `accordion` variant=separated size=medium «root.gap 12». */
  list: {
    gap: Layout.inlineGap,
  },
  item: {
    borderRadius: Radius.cardLarge,
    paddingHorizontal: Spacing.three,
  },
  /**
   * 아래 여백은 **펼쳤을 때만** 붙인다.
   *
   * 접힌 항목에도 붙이면 제목이 칸 가운데가 아니라 위쪽에 앉는다 — 여는 단추가
   * 위아래 16을 이미 갖고 있어서 그 아래에 여백이 한 번 더 쌓이기 때문이다.
   * 찍어 보고 알았다(2026-09-15).
   */
  itemOpen: {
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  /**
   * SEED `accordion-item` size=medium «trigger.paddingY 16». 제목 22 + 16×2 = 54인데
   * **`rowMinHeight` 56을 그대로 둔다** — 손가락이 닿는 자리의 최소치라 2px 때문에
   * 낮추지 않는다(`touchTarget` 44보다 커야 한다).
   */
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.three,
  },
  /** SEED는 제목 · 본문 모두 500인데 우리는 그 굵기를 싣지 않는다 — 위 주석 참고. */
  title: { fontWeight: 600 },
  body: { fontWeight: 600 },
  grow: {
    flex: 1,
  },
});
