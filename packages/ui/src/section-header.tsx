import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Spacing } from './theme';
import { ProductSymbol } from './product-symbol';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

export type SectionHeaderProps = {
  /**
   * 한 줄짜리 제목.
   *
   * **서브카피를 받는 prop이 없다.** 「섹션 제목 1줄, 서브카피 사용하지 않음」이
   * 규칙(CLAUDE.md)이라, 넣을 자리를 두면 언젠가 화면 하나가 채운다.
   */
  title: string;
  /** 오른쪽 끝 행동. 「더보기」처럼 짧은 한 마디만 온다. */
  actionLabel?: string;
  onAction?: () => void;
};

/** 목록 위에 얹는 제목 줄. 제목과 「더보기」 사이 간격은 `Layout.sectionHeadGap`이 정한다. */
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <ThemedText type="t4" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} ${actionLabel}`}
          onPress={onAction}
          hitSlop={HIT_SLOP}
          style={(state) => {
            const { pressed, hovered } = readWebInteractionState(state);
            return [styles.action, { opacity: pressed ? 0.6 : hovered ? 0.8 : 1 }];
          }}>
          <ThemedText type="t7" themeColor="textSecondary">
            {actionLabel}
          </ThemedText>
          <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textAssistive} />
        </Pressable>
      ) : null}
    </View>
  );
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Layout.sectionHeadGap,
  },
  /** 제목이 길어지면 제목이 줄고 「더보기」는 그대로 남는다. */
  title: {
    flexShrink: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    flexShrink: 0,
  },
});
