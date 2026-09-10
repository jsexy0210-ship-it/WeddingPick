/**
 * WP-ADM-041 운영 · Kill Switch
 * 기능별 중지 · 통계 반영 중지 · 보상 지급 중지 · 자동 게시 중지 · 추천 중지
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { OpsAlert, OpsConfirm, OpsEmpty } from '@/features/admin/ops-kit';
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
  /* 시안 confirmCard — 스위치를 내릴 때만 묻는다. 다시 켜는 것은 한 번에 된다. */
  const [pending, setPending] = useState<SwitchItem | null>(null);

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

  const stopped = data?.switches.filter((s2) => !s2.enabled) ?? [];

  const grouped = data?.switches.reduce<Record<string, SwitchItem[]>>((acc, item) => {
    const cat = item.category || '기타';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {}) ?? {};

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>긴급 중지</Text>
          <Text style={styles.subtitle}>기능별 스위치 · 끄면 무엇이 멈추는지 보여요</Text>
        </View>
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
        <ScrollView contentContainerStyle={styles.scrollBody}>
          {/* 지금 봐야 할 것이 맨 위 — 하나라도 내려가 있으면 그것부터 말한다. */}
          <View style={styles.bannerWrap}>
            {stopped.length > 0 ? (
              <OpsAlert
                kind="bad"
                title={`${stopped.length}개가 멈춰 있어요`}
                sub={stopped.map((s2) => s2.name).join(' · ')}
              />
            ) : (
              <OpsAlert kind="ok" title="모두 켜져 있어요" sub="멈춰 있는 기능이 없어요." />
            )}
          </View>

          {data.switches.length === 0 ? (
            <View style={styles.bannerWrap}>
              <OpsEmpty title="확인할 것이 없어요" sub="등록된 스위치가 없어요." />
            </View>
          ) : null}

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
                    <Text style={[styles.switchStatus, { color: item.enabled ? Colors.light.positive : Colors.light.textAssistive }]}>
                      {item.enabled ? '활성' : '비활성'}
                    </Text>
                    <Switch
                      value={item.enabled}
                      onValueChange={() => {
                        if (item.enabled) setPending(item);
                        else void toggle(item.id, item.enabled);
                      }}
                      disabled={toggling !== null}
                      trackColor={{ true: Colors.light.tint, false: Colors.light.border }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* 위험한 조작은 한 번 더 — 무엇이 멈추는지 항목으로 보인 뒤 진행한다. */}
      <OpsConfirm
        visible={pending !== null}
        title={pending ? `${pending.name}을(를) 끌까요?` : ''}
        body="끄는 즉시 아래가 멈춰요. 다시 켜면 바로 복구돼요."
        items={pending ? [pending.description, '멈춘 동안 쌓인 건은 확인 필요 목록에 남아요.'].filter(Boolean) : []}
        confirmLabel="끄기"
        onConfirm={() => {
          const target = pending;
          setPending(null);
          if (target) void toggle(target.id, target.enabled);
        }}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleWrap: { flex: 1 },
  subtitle: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive, marginTop: 2 },
  scrollBody: { paddingBottom: 24 },
  bannerWrap: { paddingHorizontal: 24, paddingTop: 16 },
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  categoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  categoryLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textSecondary },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  switchRowZebra: { backgroundColor: Colors.light.backgroundElement },
  switchInfo: { flex: 1, marginRight: 12 },
  switchName: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text, marginBottom: 2 },
  switchDesc: { fontSize: FontSize.tab, color: Colors.light.textAssistive, lineHeight: LineHeight.micro },
  // 끈 줄 알고 손을 놓는 것을 막는 줄이다. 회색으로 묻히면 안 된다.
  switchUnwired: { fontSize: FontSize.tab, color: Colors.light.negative, lineHeight: LineHeight.micro, marginTop: 2 },
  switchMeta: { fontSize: FontSize.tab, color: Colors.light.textDisabled, marginTop: 4 },
  switchRight: { alignItems: 'flex-end', gap: 4 },
  switchStatus: { fontSize: FontSize.tab, fontWeight: '700' },
});
