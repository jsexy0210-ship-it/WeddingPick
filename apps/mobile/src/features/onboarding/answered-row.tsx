import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { CheckCircle } from './check-circle';

/**
 * 답을 마친 질문 한 줄. 시안 20-onboarding-v2 `answeredRow` — 체크 20 · 라벨 ·
 * 값(말줄임 · 오른쪽 정렬) · «바꾸기» 버튼(30 · gray100 · radius 6). 최소 높이 40,
 * 상하 6. 상단 구분선은 없다(v3.21 «답 줄 구분선 · 상단 border 삭제»).
 *
 * «바꾸기»를 누르면 그 질문만 다시 위로 올라와 열리고 뒤의 답은 그대로다 —
 * 되돌아가는 길이 «이전»만이면 네 번째 질문에서 예식일을 고치려고 세 번을
 * 되감아야 한다.
 */
export function AnsweredRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <CheckCircle size={CHECK} checked />

      <ThemedText type="t6" themeColor="textAssistive" style={styles.label}>
        {label}
      </ThemedText>

      <ThemedText type="t6" numeric numberOfLines={1} style={styles.value}>
        {value}
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 바꾸기`}
        onPress={onEdit}
        hitSlop={Spacing.two}
        style={[styles.edit, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="t7" themeColor="textSecondary" style={styles.editLabel}>
          바꾸기
        </ThemedText>
      </Pressable>
    </View>
  );
}

/* 시안 고정값 — 답 줄 40 · 체크 20 · 바꾸기 30. 타이포·컨트롤 토큰에 없는 치수다. */
const ROW_MIN_HEIGHT = 40;
const CHECK = 20;
const EDIT_HEIGHT = 30;
const EDIT_PADDING_X = 10;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EDIT_PADDING_X,
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: Spacing.two - Spacing.half,
  },
  label: { flexShrink: 0 },
  value: { flex: 1, minWidth: 0, textAlign: 'right', fontWeight: 700 },
  edit: {
    height: EDIT_HEIGHT,
    paddingHorizontal: EDIT_PADDING_X,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: { fontWeight: 700 },
});
