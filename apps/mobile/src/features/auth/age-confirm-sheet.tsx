import { StyleSheet, View } from 'react-native';

import { ActionButton, Layout, ProductSymbol, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

const LABEL = '만 14세 이상이에요';

/**
 * 카카오가 연령대를 주지 않아 판정하지 못한 드문 경우(`age_unverified`)에만 뜬다.
 *
 * v3.29 dc.html 로그인 화면(WP-AUTH-001)에는 이 상태가 없다 — 시안은 카카오가
 * 연령대를 주는 보통 경우만 그린다. 이 시트는 그 시안이 다루지 않는, 세션이 열리기
 * «전»에 한 번 더 확인이 필요한 자리를 메우는 기존 안전장치다(`packages/domain/src/signup.ts`
 * «못 한 확인은 통과가 아니다»). 확인하면 같은 제공자로 `ageAcknowledged: true`를 실어
 * 다시 로그인을 시도한다.
 */
export function AgeConfirmSheet({
  visible,
  busy,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetPanel>
        <ThemedView style={styles.headline}>
          <ThemedText type="t4">만 14세 이상인지{'\n'}확인하면 시작할 수 있어요</ThemedText>
        </ThemedView>

        <View style={[styles.row, { backgroundColor: theme.tintSurface }]}>
          <View style={[styles.mark, { backgroundColor: theme.tint }]}>
            <ProductSymbol name="check" size={14} color={theme.onTint} />
          </View>
          <ThemedText type="f16" themeColor="tint" style={styles.rowLabel}>
            {LABEL}
          </ThemedText>
        </View>

        <ThemedView style={styles.actions}>
          <ActionButton
            variant="primary"
            size="xlarge"
            label="확인하고 계속하기"
            disabled={busy}
            onPress={onConfirm}
          />
        </ThemedView>
      </SheetPanel>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headline: { gap: Spacing.one },
  row: {
    minHeight: Layout.ctaSheet,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: { fontWeight: 700 },
  mark: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: Spacing.two },
});
