import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight, Radius, Spacing } from '@weddingpick/ui';

/**
 * 되돌릴 수 없는 조작을 한 번 더 확인받는 자리.
 *
 * 핸드오프 v3.27 관리자 공통 규칙 넷 중 마지막 — **위험한 조작은 무엇이 바뀌는지
 * 항목으로 보여준 뒤 한 번 더 확인.** 「정말 하시겠어요?」만 묻는 확인창은 확인이
 * 아니다. 누르는 사람이 이미 알고 있는 것을 다시 묻는 것뿐이고, 두 번째 누르기는
 * 첫 번째만큼 빠르다.
 *
 * 그래서 `changes`를 받는다. 롤백 실행이 무엇을 어떤 값으로 되돌리는지, 약관 공개가
 * 어느 판을 얼리는지를 **항목으로** 적어 보인다 — 목록을 읽는 동안에는 손이 멈춘다.
 *
 * 화면마다 따로 만들지 않고 한곳에 둔 것은, 위험한 단추가 앞으로도 늘기 때문이다.
 * 각자 만들면 어느 화면은 확인이 있고 어느 화면은 없는 상태가 되고, 그 차이는
 * 사고가 난 뒤에야 눈에 띈다.
 */
export function DangerConfirm({
  visible,
  title,
  description,
  changes,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  /** 왜 이것이 위험한지 한 줄. 안내 최대 2줄 규칙을 넘기지 않는다. */
  description: string;
  /** 무엇이 바뀌는가. 빈 목록으로 부르지 않는다 — 보여줄 것이 없으면 확인창도 필요 없다. */
  changes: string[];
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.changeBox}>
            <Text style={styles.changeHead}>이렇게 바뀌어요</Text>
            <ScrollView style={styles.changeList}>
              {changes.map((change) => (
                <Text key={change} style={styles.changeItem}>
                  · {change}
                </Text>
              ))}
            </ScrollView>
          </View>

          <View style={styles.actions}>
            {/* 취소가 왼쪽이다. 위험한 쪽이 손가락이 먼저 닿는 자리에 오지 않게 한다. */}
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, busy && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={busy}
            >
              <Text style={styles.confirmText}>{busy ? '처리 중…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.light.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 520,
    maxWidth: '90%',
    backgroundColor: Colors.light.background,
    borderRadius: Radius.medium,
    padding: Spacing.four,
  },
  title: { fontSize: FontSize.t4, fontWeight: '700', color: Colors.light.text },
  description: {
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7,
    color: Colors.light.textSecondary,
    marginTop: Spacing.two,
  },
  changeBox: {
    backgroundColor: Colors.light.cautionaryBackground,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  changeHead: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.cautionary },
  // 항목이 많아도 확인창이 화면을 넘지 않게 한다. 표는 카드 안에서만 스크롤한다(v3.27).
  changeList: { maxHeight: 200, marginTop: Spacing.two },
  changeItem: {
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7,
    color: Colors.light.text,
    marginBottom: Spacing.one,
  },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: FontSize.t6, fontWeight: '600', color: Colors.light.textSecondary },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.control,
    backgroundColor: Colors.light.negative,
    alignItems: 'center',
  },
  confirmText: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.background },
  btnDisabled: { opacity: 0.4 },
});
