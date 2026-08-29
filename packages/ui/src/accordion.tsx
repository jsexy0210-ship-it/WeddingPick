import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Layout, Radius, Spacing } from './theme';
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
 */
export function Accordion({ items }: AccordionProps) {
  const theme = useTheme();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ThemedView style={styles.list}>
      {items.map((item) => {
        const expanded = open === item.key;

        return (
          <ThemedView key={item.key} type="backgroundElement" style={styles.item}>
            <Pressable
              accessibilityRole="button"
              // 읽는 기계에 펼침 상태를 알린다. 화살표만으로는 전해지지 않는다.
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : item.key)}
              style={styles.head}>
              <ThemedText type="t5" style={styles.grow}>
                {item.title}
              </ThemedText>
              <ThemedText type="t5" themeColor="textAssistive">
                {expanded ? '−' : '+'}
              </ThemedText>
            </Pressable>

            {expanded ? (
              <ThemedText type="t6" themeColor="textSecondary" style={{ color: theme.textSecondary }}>
                {item.body}
              </ThemedText>
            ) : null}
          </ThemedView>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  item: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Layout.rowMinHeight,
  },
  grow: {
    flex: 1,
  },
});
