import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@weddingpick/ui';

/**
 * 되돌릴 수 없는 결정을 한 번 더 묻는 자리.
 *
 * 핸드오프 v3.27 관리자 공통 규칙 넷 중 마지막 — 「위험한 조작은 무엇이 바뀌는지
 * 항목으로 보여준 뒤 한 번 더 확인」. 검토 계열(인증 심사 · 반론 · 후기 이의)의
 * 결정은 전부 큐에서 항목을 빼고 사용자 쪽 화면을 바꾼다. 잘못 누르면 되돌릴
 * 방법이 없다.
 *
 * **무엇이 바뀌는지를 문장이 아니라 항목으로 적는다.** 「정말 하시겠어요?」는
 * 무엇을 확인하라는 것인지 말해 주지 않아서, 읽지 않고 한 번 더 누르는 절차가
 * 될 뿐이다. 바뀌는 것을 줄 단위로 세어 보여야 확인이 확인이 된다.
 */
export function ConfirmDecision({
  question,
  changes,
  confirmLabel,
  tone,
  busy,
  onConfirm,
  onCancel,
}: {
  /** 무엇을 하려는지 한 줄. */
  question: string;
  /** 누르면 바뀌는 것. 한 줄에 하나. */
  changes: string[];
  confirmLabel: string;
  /** `danger`는 되돌릴 수 없는 쪽(내리기 · 반려 · 게시 불가). */
  tone: 'danger' | 'primary';
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const danger = tone === 'danger';

  return (
    <View style={[styles.box, danger && styles.boxDanger]}>
      <Text style={[styles.question, danger && styles.questionDanger]}>{question}</Text>

      {changes.map((change) => (
        <View key={change} style={styles.changeRow}>
          <Text style={[styles.bullet, danger && styles.questionDanger]}>·</Text>
          <Text style={styles.change}>{change}</Text>
        </View>
      ))}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.cancelBtn, busy && styles.btnDisabled]}
          onPress={onCancel}
          disabled={busy}
        >
          <Text style={styles.cancelText}>그만두기</Text>
        </Pressable>
        <Pressable
          style={[styles.confirmBtn, danger && styles.confirmBtnDanger, busy && styles.btnDisabled]}
          onPress={onConfirm}
          disabled={busy}
        >
          <Text style={styles.confirmText}>{busy ? '처리 중…' : confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.light.cautionaryBorder,
    backgroundColor: Colors.light.cautionaryBoxBackground,
  },
  boxDanger: {
    borderColor: Colors.light.negativeBorder,
    backgroundColor: Colors.light.negativeBoxBackground,
  },
  question: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    color: Colors.light.cautionary,
    marginBottom: Spacing.two,
  },
  questionDanger: { color: Colors.light.negative },
  changeRow: { flexDirection: 'row', gap: Spacing.one, marginBottom: Spacing.one },
  bullet: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.cautionary },
  change: { flex: 1, fontSize: FontSize.t7, color: Colors.light.textStrong },
  actionRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.control,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    backgroundColor: Colors.light.background,
  },
  cancelText: { fontSize: FontSize.t7, fontWeight: '600', color: Colors.light.textStrong },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.control,
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
  },
  confirmBtnDanger: { backgroundColor: Colors.light.negativeAction },
  confirmText: { fontSize: FontSize.t7, fontWeight: '600', color: Colors.light.background },
  btnDisabled: { opacity: 0.5 },
});
