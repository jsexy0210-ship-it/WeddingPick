/**
 * WP-ADM-051 시스템 · Policy Engine
 * 공개 기준 · 이상치 기준 · 보상 한도 · 재시도 횟수 · 롤백 임계값 편집
 */
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FontSize, LineHeight, Spinner } from '@weddingpick/ui';
import { apiFetch } from './_api';

type PolicyType = 'number' | 'percentage' | 'boolean' | 'string';
type PolicyItem = {
  id: string;
  key: string;
  label: string;
  description: string;
  category: string;
  type: PolicyType;
  value: string;
  defaultValue: string;
  lastChangedAt: string | null;
  lastChangedBy: string | null;
};

type PolicyData = { policies: PolicyItem[] };

export default function PolicyEngineScreen() {
  const [data, setData] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/policy-engine')
      .then((d) => {
        if (cancelled) return;
        setData(d as PolicyData);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [rev]);

  function openEdit(item: PolicyItem) {
    setEditing(item);
    setEditValue(item.value);
    setSaveError(null);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/v1/admin/policy-engine/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: editValue }),
      });
      setEditing(null);
      setRev((r) => r + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  const grouped = data?.policies.reduce<Record<string, PolicyItem[]>>((acc, item) => {
    const cat = item.category || '기타';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {}) ?? {};

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Policy Engine</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {loading && <View style={styles.centered}><Spinner size={40} /></View>}
      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setRev((r) => r + 1)}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && data && (
        <ScrollView>
          {Object.entries(grouped).map(([cat, items]) => (
            <View key={cat}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{cat}</Text>
              </View>
              {items.map((item, i) => (
                <View key={item.id} style={[styles.policyRow, i % 2 === 1 && styles.policyRowZebra]}>
                  <View style={styles.policyMain}>
                    <Text style={styles.policyLabel}>{item.label}</Text>
                    <Text style={styles.policyKey}>{item.key}</Text>
                    <Text style={styles.policyDesc}>{item.description}</Text>
                    {item.lastChangedAt && (
                      <Text style={styles.policyMeta}>
                        {new Date(item.lastChangedAt).toLocaleString('ko-KR')}
                        {item.lastChangedBy ? ` · ${item.lastChangedBy}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.policyRight}>
                    <Text style={styles.policyValue}>{item.value}</Text>
                    {item.value !== item.defaultValue && (
                      <Text style={styles.policyDefault}>기본: {item.defaultValue}</Text>
                    )}
                    <Pressable style={styles.editBtn} onPress={() => openEdit(item)}>
                      <Text style={styles.editBtnText}>수정</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={editing !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editing?.label}</Text>
            <Text style={styles.modalDesc}>{editing?.description}</Text>
            <Text style={styles.modalKey}>{editing?.key}</Text>
            <Text style={styles.fieldLabel}>값</Text>
            <TextInput
              style={styles.fieldInput}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType={editing?.type === 'number' || editing?.type === 'percentage' ? 'numeric' : 'default'}
              placeholder={editing?.defaultValue}
            />
            <Text style={styles.defaultHint}>기본값: {editing?.defaultValue}</Text>
            {saveError && <Text style={styles.saveError}>{saveError}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)} disabled={saving}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={() => void save()}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? '저장 중…' : '저장'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f3f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: '#17181c' },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f2f3f6' },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  categoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  categoryLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#4d5159' },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  policyRowZebra: { backgroundColor: '#fafbfc' },
  policyMain: { flex: 1, marginRight: 16 },
  policyLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c', marginBottom: 2 },
  policyKey: { fontSize: FontSize.tab, color: '#adb1ba', fontFamily: 'monospace', marginBottom: 2 },
  policyDesc: { fontSize: FontSize.tab, color: '#868b94', lineHeight: LineHeight.micro, marginBottom: 4 },
  policyMeta: { fontSize: FontSize.tab, color: '#adb1ba' },
  policyRight: { alignItems: 'flex-end', gap: 4 },
  policyValue: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
  policyDefault: { fontSize: FontSize.tab, color: '#868b94' },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f2f3f6',
    borderWidth: 1,
    borderColor: '#d1d3d8',
  },
  editBtnText: { fontSize: FontSize.tab, color: '#3a3b40' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 14, padding: 24, width: 480 },
  modalTitle: { fontSize: FontSize.t6, fontWeight: '700', color: '#17181c', marginBottom: 4 },
  modalDesc: { fontSize: FontSize.t7, color: '#868b94', marginBottom: 4 },
  modalKey: { fontSize: FontSize.tab, color: '#adb1ba', fontFamily: 'monospace', marginBottom: 12 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#868b94', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 44,
    fontSize: FontSize.t7,
  },
  defaultHint: { fontSize: FontSize.tab, color: '#adb1ba', marginTop: 4 },
  saveError: { fontSize: FontSize.t7, color: '#e53e3e', marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: '#f2f3f6' },
  cancelBtnText: { fontSize: FontSize.t7, color: '#3a3b40' },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: '#ff6f61' },
  saveBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
