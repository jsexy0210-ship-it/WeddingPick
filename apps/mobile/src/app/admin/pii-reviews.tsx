import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { formatDateTimeDot } from '@/features/common/format-date';

import { apiFetch } from './_api';

/**
 * 개인정보 검토 큐 — 문서에서 개인정보 꼴이 보인 것을 사람이 확인한다.
 *
 * `admin.html`에 있던 화면을 여기로 옮겼다(2026-09-09, 관리자 화면을 `/admin` 하나로
 * 통일하면서). 옮기며 하나 고쳤다 — 예전에는 지울 항목의 «필드명»과 «종류»를 사람이
 * 손으로 타이핑했다. 서버가 `hints`로 그 둘을 이미 알려주므로 **누르기만 하면 되게** 했다.
 * 손으로 적으면 오타 하나에 엉뚱한 자리가 지워지거나 아무 일도 안 일어난다.
 */
type PendingReview = {
  id: string;
  createdAt: string;
  detectedKinds: string[];
  hintCount: number;
};

type Hint = { field: string; kind: string };

type ReviewDetail = {
  id: string;
  createdAt: string;
  detectedKinds: string[];
  hints: Hint[];
  fields: Record<string, string>;
  reviewStatus: string;
};

export default function PiiReviewsScreen() {
  const [items, setItems] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** 이미 지운 힌트. 서버가 목록을 다시 주기 전까지 화면에서 흐리게 둔다. */
  const [redacted, setRedacted] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/v1/admin/pii-reviews')
      .then((data) => {
        if (cancelled) return;
        setItems((data as { reviews?: PendingReview[] }).reviews ?? []);
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

  const open = useCallback((id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setActionError(null);
    setRedacted([]);

    apiFetch(`/v1/admin/pii-reviews/${id}`)
      .then((data) => setDetail(data as ReviewDetail))
      .catch((e: unknown) => setDetailError(e instanceof Error ? e.message : '상세를 불러오지 못했어요'));
  }, []);

  function reload() {
    setLoading(true);
    setSelectedId(null);
    setDetail(null);
    setRev((r) => r + 1);
  }

  async function post(path: string, body?: unknown) {
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(path, {
        method: 'POST',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
      return false;
    } finally {
      setActing(false);
    }
  }

  async function markClean() {
    if (!selectedId) return;
    if (await post(`/v1/admin/pii-reviews/${selectedId}/clean`)) reload();
  }

  async function redact(hint: Hint) {
    if (!selectedId) return;
    const key = `${hint.field}:${hint.kind}`;
    if (redacted.includes(key)) return;
    if (await post(`/v1/admin/pii-reviews/${selectedId}/redact`, hint)) {
      setRedacted((prev) => [...prev, key]);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>개인정보 검토</Text>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.list}>
          <DelayedLoader active={loading} size={40} style={styles.centered} />
          {!loading && error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && (
            <ScrollView>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colId]}>문서</Text>
                <Text style={[styles.th, styles.colKinds]}>보인 것</Text>
                <Text style={[styles.th, styles.colCount]}>자리</Text>
                <Text style={[styles.th, styles.colDate]}>올린 때</Text>
              </View>

              {items.length === 0 && <Text style={styles.emptyText}>검토할 문서가 없어요.</Text>}

              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.tableRow, selectedId === item.id && styles.tableRowActive]}
                  onPress={() => open(item.id)}>
                  <Text style={[styles.td, styles.colId, styles.monoText]} numberOfLines={1}>
                    {item.id.slice(0, 8)}…
                  </Text>
                  <Text style={[styles.td, styles.colKinds]} numberOfLines={1}>
                    {item.detectedKinds.join(' · ') || '—'}
                  </Text>
                  <Text style={[styles.td, styles.colCount]}>{item.hintCount}곳</Text>
                  <Text style={[styles.td, styles.colDate]}>{formatDateTimeDot(item.createdAt)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.detail}>
          {!selectedId ? (
            <View style={styles.detailEmpty}>
              <Text style={styles.emptyText}>왼쪽에서 문서를 선택하세요</Text>
            </View>
          ) : detailError ? (
            <Text style={styles.errorText}>{detailError}</Text>
          ) : !detail ? (
            <DelayedLoader size={28} style={styles.centered} />
          ) : (
            <ScrollView>
              <Text style={styles.detailSectionTitle}>문서</Text>

              <Text style={styles.detailLabel}>문서 ID</Text>
              <Text style={styles.detailValue}>{detail.id}</Text>

              <Text style={styles.detailLabel}>올린 때</Text>
              <Text style={styles.detailValue}>{formatDateTimeDot(detail.createdAt)}</Text>

              <Text style={styles.detailLabel}>검토 상태</Text>
              <Text style={styles.detailValue}>{detail.reviewStatus}</Text>

              <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>보인 자리</Text>
              <Text style={styles.detailHint}>
                누르면 그 자리의 값을 지웁니다. 되돌릴 수 없어요.
              </Text>

              {detail.hints.length === 0 && (
                <Text style={styles.emptyInline}>개인정보 꼴이 보이는 자리가 없어요.</Text>
              )}

              {detail.hints.map((hint) => {
                const key = `${hint.field}:${hint.kind}`;
                const done = redacted.includes(key);
                return (
                  <Pressable
                    key={key}
                    disabled={done || acting}
                    style={[styles.hintRow, done && styles.hintRowDone]}
                    onPress={() => void redact(hint)}>
                    <View style={styles.hintTexts}>
                      <Text style={styles.hintField}>{hint.field}</Text>
                      <Text style={styles.hintKind}>{hint.kind}</Text>
                    </View>
                    <Text style={[styles.hintAction, done && styles.hintActionDone]}>
                      {done ? '지웠어요' : '지우기'}
                    </Text>
                  </Pressable>
                );
              })}

              <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>내용</Text>
              {Object.entries(detail.fields).map(([field, value]) => (
                <View key={field}>
                  <Text style={styles.detailLabel}>{field}</Text>
                  <Text style={styles.fieldValue}>{value}</Text>
                </View>
              ))}

              {actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}

              <Pressable
                disabled={acting}
                style={[styles.cleanBtn, acting && styles.btnDisabled]}
                onPress={() => void markClean()}>
                <Text style={styles.cleanBtnText}>개인정보 없음으로 마치기</Text>
              </Pressable>
              <Text style={styles.detailHint}>
                지울 것이 없다고 판단하면 여기서 검토를 끝냅니다. 큐에서 사라져요.
              </Text>
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
  emptyInline: { color: Colors.light.textAssistive, fontSize: FontSize.t7 },
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
  colId: { width: 96 },
  colKinds: { flex: 1 },
  colCount: { width: 64 },
  colDate: { width: 132 },
  monoText: { color: Colors.light.textSecondary },
  detailSectionTitle: { fontSize: FontSize.badge, fontWeight: '700', color: Colors.light.textAssistive, marginBottom: 12 },
  detailLabel: { fontSize: FontSize.tab, fontWeight: '600', color: Colors.light.textAssistive, marginBottom: 3, marginTop: 14 },
  detailValue: { fontSize: FontSize.t7, color: Colors.light.text },
  fieldValue: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  detailHint: { fontSize: FontSize.badge, color: Colors.light.textAssistive, marginTop: 8 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.negativeBorder,
    backgroundColor: Colors.light.negativeBoxBackground,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  hintRowDone: { borderColor: Colors.light.border, backgroundColor: Colors.light.backgroundElement },
  hintTexts: { flex: 1 },
  hintField: { fontSize: FontSize.t7, color: Colors.light.text, fontWeight: '600' },
  hintKind: { fontSize: FontSize.badge, color: Colors.light.textAssistive },
  hintAction: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.negative },
  hintActionDone: { color: Colors.light.textAssistive },
  actionErrorText: { color: Colors.light.negative, fontSize: FontSize.t7, marginTop: 12 },
  cleanBtn: {
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.text,
  },
  cleanBtnText: { color: Colors.light.background, fontSize: FontSize.t7, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
