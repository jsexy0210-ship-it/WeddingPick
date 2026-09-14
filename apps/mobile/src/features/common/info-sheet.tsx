import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, Layout, Radius, ThemedText, useTheme } from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

/**
 * 금액 옆 ⓘ가 여는 설명 시트 — WP-SHT-014 «실 제보가 뭔가요?» · WP-SHT-015 «기준금액이 뭔가요?».
 * 시안 17-sheets-states `sh('SHT-014' …)` · `sh('SHT-015' …)`.
 *
 *   그래버 → 제목 20/27 700 → 본문 15/22 gray700 → «알겠어요» 하나
 *
 * 확인 시트(`ConfirmSheet`)와 나누는 이유는 고를 것이 없기 때문이다 — 읽고 닫는 시트에
 * 취소 버튼을 두면 무엇이 취소되는지 알 수 없다. 버튼은 하나이고 닫기와 같은 뜻이다.
 *
 * 문구는 `spec/strings.ko.json` `data.verifiedTooltip*` · `data.medianTooltip*`이 원본이다.
 * screens.json WP-SHT-014의 본문은 금지어(`실제로 낸 금액`)를 담은 옛 문장이라 쓰지 않는다 —
 * strings.ko.json이 같은 뜻을 금지어 없이 적어둔 쪽이고, CLAUDE.md 용어 규칙이 그쪽 편이다.
 */
export type InfoTopic = 'verifiedData' | 'baseAmount';

const SHEETS: Record<InfoTopic, { title: string; body: string }> = {
  /** `data.verifiedTooltipTitle` · `data.verifiedTooltipBody`. */
  verifiedData: {
    title: '실 제보가 뭔가요?',
    body: '자료로 확인한 제보 금액만 모은 정보예요. 웨딩픽은 비싸다 싸다를 판정하지 않아요.',
  },
  /** `data.medianTooltipTitle` · `data.medianTooltipBody`. CLAUDE.md가 문장까지 정했다. */
  baseAmount: {
    title: '기준금액이 뭔가요?',
    body: '실 제보의 중앙값이에요',
  },
};

const CLOSE_LABEL = '알겠어요';

export function InfoSheet({
  topic,
  onClose,
}: {
  /** null이면 시트가 닫혀 있다. */
  topic: InfoTopic | null;
  onClose: () => void;
}) {
  /* 닫히는 모션이 도는 동안에도 마지막 내용이 보여야 한다 — 글자가 먼저 사라지지 않게 붙잡아둔다. */
  const [shown, setShown] = useState<InfoTopic>('verifiedData');
  if (topic !== null && topic !== shown) setShown(topic);

  const sheet = SHEETS[shown];

  return (
    <BottomSheet visible={topic !== null} onRequestClose={onClose}>
      <SheetPanel>
        <View style={styles.head}>
          <ThemedText type="t4">{sheet.title}</ThemedText>
          <ThemedText type="t6" themeColor="textSecondary">
            {sheet.body}
          </ThemedText>
        </View>
        <ActionButton variant="primary" size="xlarge" label={CLOSE_LABEL} onPress={onClose} />
      </SheetPanel>
    </BottomSheet>
  );
}

/**
 * 금액 옆 ⓘ. 18(`size.iconInline`)짜리 회색 동그라미이고 터치 영역은 44(`size.touchMin`)다 —
 * 글줄 사이에 끼우므로 보이는 크기와 누르는 크기를 따로 둔다.
 */
export function InfoDot({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [styles.dot, { borderColor: theme.textDisabled }, pressed && styles.pressed]}>
      <ThemedText type="micro" themeColor="textDisabled" style={styles.glyph}>
        i
      </ThemedText>
    </Pressable>
  );
}

/** 18 동그라미를 44 터치 영역으로 넓힌다((44 − 18) / 2). */
const HIT_SLOP = (Layout.touchTarget - Layout.iconInline) / 2;

const styles = StyleSheet.create({
  head: { gap: Layout.sheetHeadGap },
  dot: {
    width: Layout.iconInline,
    height: Layout.iconInline,
    flexShrink: 0,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
