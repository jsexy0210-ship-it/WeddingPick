/**
 * WP-ADM-041 운영 · Kill Switch
 * 기능별 중지 · 통계 반영 중지 · 보상 지급 중지 · 자동 게시 중지 · 추천 중지
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatDateTimeDot } from '@/features/common/format-date';

type SwitchItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  /**
   * 이 스위치를 읽는 코드가 실제로 있는가. false면 껐다 켜도 동작이 바뀌지 않는다.
   * 화면이 그 사실을 숨기면, 끈 줄 알고 손을 놓는 일이 생긴다.
   */
  wired?: boolean;
  lastChangedAt: string | null;
  lastChangedBy: string | null;
};

type KillSwitchData = { switches: SwitchItem[] };

export default function KillSwitchScreen() {
  const [data, setData] = useState<KillSwitchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/kill-switches')
      .then((d) => {
        if (cancelled) return;
        setData(d as KillSwitchData);
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

  async function toggle(id: string, current: boolean) {
    setToggling(id);
    try {
      await apiFetch(`/v1/admin/kill-switches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !current }),
      });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setToggling(null); }
  }

  const grouped = data?.switches.reduce<Record<string, SwitchItem[]>>((acc, item) => {
    const cat = item.category || '기타';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {}) ?? {};

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Kill Switch</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />
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
                <View key={item.id} style={[styles.switchRow, i % 2 === 1 && styles.switchRowZebra]}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchName}>{item.name}</Text>
                    <Text style={styles.switchDesc}>{item.description}</Text>
                    {item.wired === false && (
                      <Text style={styles.switchUnwired}>
                        아직 연결되지 않았습니다 — 꺼도 기능은 그대로 돕니다
                      </Text>
                    )}
                    {item.lastChangedAt && (
                      <Text style={styles.switchMeta}>
                        {formatDateTimeDot(item.lastChangedAt)}
                        {item.lastChangedBy ? ` · ${item.lastChangedBy}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.switchRight}>
                    <Text style={[styles.switchStatus, { color: item.enabled ? '#1aa174' : '#868b94' }]}>
                      {item.enabled ? '활성' : '비활성'}
                    </Text>
                    <Switch
                      value={item.enabled}
                      onValueChange={() => void toggle(item.id, item.enabled)}
                      disabled={toggling !== null}
                      trackColor={{ true: '#ff6f61', false: '#e4e5ea' }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  switchRowZebra: { backgroundColor: '#fafbfc' },
  switchInfo: { flex: 1, marginRight: 12 },
  switchName: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c', marginBottom: 2 },
  switchDesc: { fontSize: FontSize.tab, color: '#868b94', lineHeight: LineHeight.micro },
  // 끈 줄 알고 손을 놓는 것을 막는 줄이다. 회색으로 묻히면 안 된다.
  switchUnwired: { fontSize: FontSize.tab, color: '#ff4d4d', lineHeight: LineHeight.micro, marginTop: 2 },
  switchMeta: { fontSize: FontSize.tab, color: '#adb1ba', marginTop: 4 },
  switchRight: { alignItems: 'flex-end', gap: 4 },
  switchStatus: { fontSize: FontSize.tab, fontWeight: '700' },
});
