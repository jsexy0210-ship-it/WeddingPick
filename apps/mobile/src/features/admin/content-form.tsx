import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, FontSize } from '@weddingpick/ui';
import { ConfirmCard, useAdminAccess } from '@/app/admin/_ui';

export type ContentField = { key: string; label: string; multiline?: boolean; options?: readonly { value: string; label: string }[] };
export function ContentButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.5 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

/** 여러 운영 메뉴의 입력·저장 오류·중복 제출 방지를 공유한다. */
export function ContentForm({ title, fields, initial, onSave, onClose }: {
  title: string; fields: readonly ContentField[]; initial: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>; onClose: () => void;
}) {
  const { canEdit } = useAdminAccess();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (busy || !canEdit) return;
    setBusy(true); setError(null);
    try { await onSave(values); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : '저장에 실패했어요'); }
    finally { setBusy(false); }
  }
  return <Modal transparent visible animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={styles.overlay}><View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView>
        {fields.map((field) => <View key={field.key} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          {field.options ? <View style={styles.options}>{field.options.map((option) =>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: values[field.key] === option.value }} disabled={busy}
              key={option.value} onPress={() => setValues((v) => ({ ...v, [field.key]: option.value }))}
              style={[styles.button, values[field.key] === option.value && styles.selected]}>
              <Text style={styles.buttonText}>{option.label}</Text>
            </Pressable>)}</View> :
            <TextInput accessibilityLabel={field.label} editable={!busy} value={values[field.key] ?? ''}
              onChangeText={(value) => setValues((v) => ({ ...v, [field.key]: value }))} multiline={field.multiline}
              style={[styles.input, field.multiline && styles.multiline]} />}
        </View>)}
      </ScrollView>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.options}><ContentButton label="취소" onPress={onClose} disabled={busy} /><ContentButton label={busy ? '저장 중…' : '저장'} onPress={() => void save()} disabled={busy || !canEdit} /></View>
    </View></View>
  </Modal>;
}

export function DeleteContentButton({ name, onDelete }: { name: string; onDelete: () => Promise<void> }) {
  const { canDelete } = useAdminAccess();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await onDelete(); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : '삭제에 실패했어요'); }
    finally { setBusy(false); }
  }
  return <><ContentButton label="삭제" disabled={!canDelete} onPress={() => { setError(null); setOpen(true); }} />
    <Modal transparent visible={open} onRequestClose={() => { if (!busy) setOpen(false); }}>
      <ConfirmCard title="삭제하시겠어요?" body={name} items={['목록에서 해당 항목을 삭제해요.']} danger permission="delete" cta={busy ? '삭제 중…' : '삭제'}
        onCancel={() => { if (!busy) setOpen(false); }} onConfirm={() => void remove()}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ConfirmCard>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', padding: 24 },
  panel: { backgroundColor: Colors.light.background, padding: 24, borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90%', gap: 16 },
  title: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  field: { gap: 8, marginBottom: 16 }, label: { color: Colors.light.text, fontSize: FontSize.t7 },
  input: { borderWidth: 1, borderColor: Colors.light.fieldBorder, padding: 10, borderRadius: 6, fontSize: FontSize.t6, color: Colors.light.text },
  multiline: { minHeight: 120, textAlignVertical: 'top' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: Colors.light.fieldBorder, backgroundColor: Colors.light.background },
  selected: { borderColor: Colors.light.tint, backgroundColor: Colors.light.backgroundSelected },
  buttonText: { fontSize: FontSize.t7, color: Colors.light.text }, error: { color: Colors.light.negative, fontSize: FontSize.t7 },
});
