import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { formatDateTimeDot } from '@/features/common/format-date';

import { apiFetch } from './_api';
import { BACKEND_PENDING, PendingBackendNotice } from '@/features/admin/pending-backend';

/**
 * 후기 이의제기 — 업체가 후기에 이의를 걸면 그 후기를 잠시 내리고 사람이 판단한다.
 *
 * `admin.html`에 있던 화면을 여기로 옮겼다(2026-09-09).
 *
 * 세 갈래다. **되살리기**는 후기를 다시 보이게 하고, **내리기**는 영구히 감춘다.
 * **기한 늘리기**는 판단을 미루는 것이라 결론이 아니다 — 그래서 다른 자리에 뒀다.
 * 셋 다 메모가 필수다. 왜 그렇게 판단했는지 없으면 나중에 답할 수 없다.
 */
type ObjectedReview = {
  id: string;
  vendorName: string;
  title: string;
  objectionHoldUntil: string;
  expired: boolean;
};

export default function ObjectionsScreen() {
  const [items, setItems] = useState<ObjectedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  const [selected, setSelected] = useState<ObjectedReview | null>(null);
  const [note, setNote] = useState('');
  const [days, setDays] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/v1/admin/objections')
      .then((data) => {
        if (cancelled) return;
        setItems((data as { objections?: ObjectedReview[] }).objections ?? []);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rev]);

  function reload() {
    setLoading(true);
    setSelected(null);
    setNote('');
    setDays('');
    setRev((r) => r + 1);
  }

  async function send(path: string, body: Record<string, unknown>) {
    if (!selected) return;
    if (!note.trim()) {
      setActionError('메모를 입력해주세요.');
      return;
    }

    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/objections/${selected.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim(), ...body }),
      });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  async function extend() {
    const parsed = Number(days);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setActionError('며칠 더 볼지 1 이상의 정수로 적어주세요.');
      return;
    }
    await send('hold', { days: parsed });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>후기 이의제기</Text>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.list}>
          <PendingBackendNotice actions="되살리기 · 내리기" />
      <DelayedLoader active={loading} size={40} style={styles.centered} />
          {!loading && error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && (
            <ScrollView>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colVendor]}>업체명</Text>
                <Text style={[styles.th, styles.colTitle]}>후기 제목</Text>
                <Text style={[styles.th, styles.colUntil]}>판단 기한</Text>
              </View>

              {items.length === 0 && <Text style={styles.emptyText}>확인 중인 이의가 없어요.</Text>}

              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.tableRow, selected?.id === item.id && styles.tableRowActive]}
                  onPress={() => {
                    setSelected(item);
                    setNote('');
                    setDays('');
                    setActionError(null);
                  }}>
                  <Text style={[styles.td, styles.colVendor]} numberOfLines={1}>
                    {item.vendorName}
                  </Text>
                  <Text style={[styles.td, styles.colTitle]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.colUntil}>
                    <Text style={[styles.td, item.expired && styles.overdueText]}>
                      {formatDateTimeDot(item.objectionHoldUntil)}
                    </Text>
                    {item.expired && <Text style={styles.overdueBadge}>기한 지남</Text>}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.detail}>
          {!selected ? (
            <View style={styles.detailEmpty}>
              <Text style={styles.emptyText}>왼쪽에서 항목을 선택하세요</Text>
            </View>
          ) : (
            <ScrollView>
              <Text style={styles.detailSectionTitle}>이의가 걸린 후기</Text>

              <Text style={styles.detailLabel}>업체명</Text>
              <Text style={styles.detailValue}>{selected.vendorName}</Text>

              <Text style={styles.detailLabel}>후기 제목</Text>
              <Text style={styles.detailValue}>{selected.title}</Text>

              <Text style={styles.detailLabel}>판단 기한</Text>
              <Text style={[styles.detailValue, selected.expired && styles.overdueText]}>
                {formatDateTimeDot(selected.objectionHoldUntil)}
                {selected.expired ? ' · 기한이 지났어요' : ''}
              </Text>

              <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>판단</Text>
              <Text style={styles.detailHint}>
                무엇을 근거로 그렇게 정했는지 적어주세요. 나중에 답해야 하는 기록입니다.
              </Text>

              <Text style={styles.detailLabel}>메모 (필수)</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={3}
                placeholder="판단 근거"
                value={note}
                onChangeText={setNote}
              />

              {actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}

              <View style={styles.actionRow}>
                <Pressable
                  disabled={BACKEND_PENDING || acting}
                  style={[styles.restoreBtn, (BACKEND_PENDING || acting) && styles.btnDisabled]}
                  onPress={() => void send('restore', {})}>
                  <Text style={styles.restoreBtnText}>되살리기</Text>
                </Pressable>
                <Pressable
                  disabled={BACKEND_PENDING || acting}
                  style={[styles.removeBtn, (BACKEND_PENDING || acting) && styles.btnDisabled]}
                  onPress={() => void send('remove', {})}>
                  <Text style={styles.removeBtnText}>내리기</Text>
                </Pressable>
              </View>

              <Text style={[styles.detailSectionTitle, { marginTop: 28 }]}>아직 못 정했다면</Text>
              <Text style={styles.detailHint}>
                기한만 늘립니다. 후기는 계속 내려가 있어요.
              </Text>
              <View style={styles.extendRow}>
                <TextInput
                  style={styles.daysInput}
                  placeholder="일수"
                  keyboardType="number-pad"
                  value={days}
                  onChangeText={setDays}
                />
                <Pressable
                  disabled={acting}
                  style={[styles.extendBtn, acting && styles.btnDisabled]}
                  onPress={() => void extend()}>
                  <Text style={styles.extendBtnText}>기한 늘리기</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1, flexDirection: 'row' },
  list: { flex: 1, backgroundColor: Colors.light.background, borderRightWidth: 1, borderRightColor: Colors.light.border },
  detail: { width: 428, backgroundColor: Colors.light.background, padding: 24 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { marginTop: 40 },
  emptyText: { color: Colors.light.textAssistive, fontSize: FontSize.t7, padding: 24 },
  errorText: { color: Colors.light.negative, fontSize: FontSize.t7, padding: 24 },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  colVendor: { width: 180 },
  colTitle: { flex: 1 },
  colUntil: { width: 148 },
  overdueText: { color: Colors.light.negative },
  overdueBadge: { fontSize: FontSize.badge, color: Colors.light.negative, fontWeight: '700' },
  detailSectionTitle: { fontSize: FontSize.badge, fontWeight: '700', color: Colors.light.textAssistive, marginBottom: 12 },
  detailLabel: { fontSize: FontSize.tab, fontWeight: '600', color: Colors.light.textAssistive, marginBottom: 3, marginTop: 14 },
  detailValue: { fontSize: FontSize.t7, color: Colors.light.text },
  detailHint: { fontSize: FontSize.badge, color: Colors.light.textAssistive, marginBottom: 8 },
  noteInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    padding: 10,
    fontSize: FontSize.t7,
    color: Colors.light.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionErrorText: { color: Colors.light.negative, fontSize: FontSize.t7, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  restoreBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: Colors.light.text },
  restoreBtnText: { color: Colors.light.background, fontSize: FontSize.t7, fontWeight: '700' },
  removeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.negative,
  },
  removeBtnText: { color: Colors.light.negative, fontSize: FontSize.t7, fontWeight: '700' },
  extendRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  daysInput: {
    width: 88,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: FontSize.t7,
    color: Colors.light.text,
  },
  extendBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSelected,
  },
  extendBtnText: { color: Colors.light.textStrong, fontSize: FontSize.t7, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
