/**
 * WP-ADM-034 성장 · 광고 실운영 전환 게이트
 * 테스트 전체 오픈 → 데이터 축적 → AI 독립 분석 → 보고서 → 최종 결정 → 실운영
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { BACKEND_PENDING, PendingBackendNotice } from '@/features/admin/pending-backend';
import { formatDateDot } from '@/features/common/format-date';

type GateStepStatus = 'done' | 'in_progress' | 'pending' | 'blocked';

type GateStep = {
  id: string;
  label: string;
  description: string;
  status: GateStepStatus;
  completedAt: string | null;
  detail: string | null;
  requiresAction: boolean;
};

type AdsGateData = {
  currentPhase: number;
  steps: GateStep[];
  readyForProduction: boolean;
  blockers: string[];
};

const STEP_COLOR: Record<GateStepStatus, string> = {
  done: '#1aa174',
  in_progress: '#0088cc',
  pending: '#868b94',
  blocked: '#e81607',
};
const STEP_LABEL: Record<GateStepStatus, string> = {
  done: '완료',
  in_progress: '진행 중',
  pending: '대기',
  blocked: '차단됨',
};

export default function AdsGateScreen() {
  const [data, setData] = useState<AdsGateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/ads-gate')
      .then((d) => {
        if (cancelled) return;
        setData(d as AdsGateData);
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

  async function approveProduction() {
    setConfirming(true);
    try {
      await apiFetch('/v1/admin/ads-gate/approve', { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setConfirming(false); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>성장 · 광고 실운영 전환 게이트</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <PendingBackendNotice actions="실운영 전환 확정" />
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
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* 현재 상태 */}
          <View style={[styles.statusBanner, data.readyForProduction ? styles.bannerGreen : styles.bannerBlue]}>
            <Text style={styles.bannerTitle}>
              {data.readyForProduction ? '실운영 전환 준비 완료' : `단계 ${data.currentPhase} 진행 중`}
            </Text>
            {data.blockers.length > 0 && (
              <Text style={styles.bannerSub}>차단 요인: {data.blockers.join(', ')}</Text>
            )}
          </View>

          {/* 게이트 단계 */}
          {data.steps.map((step, i) => (
            <View key={step.id} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepDot, { backgroundColor: STEP_COLOR[step.status] }]} />
                <View style={styles.stepMain}>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  <Text style={styles.stepDesc}>{step.description}</Text>
                </View>
                <Text style={[styles.stepStatus, { color: STEP_COLOR[step.status] }]}>
                  {STEP_LABEL[step.status]}
                </Text>
              </View>
              {step.detail && (
                <Text style={styles.stepDetail}>{step.detail}</Text>
              )}
              {step.completedAt && (
                <Text style={styles.stepDate}>
                  완료: {formatDateDot(step.completedAt)}
                </Text>
              )}
              {i < data.steps.length - 1 && <View style={styles.stepConnector} />}
            </View>
          ))}

          {/* 최종 결정 */}
          {data.readyForProduction && (
            <View style={styles.approvalBox}>
              <Text style={styles.approvalTitle}>최종 사용자 결정이 필요해요</Text>
              <Text style={styles.approvalDesc}>
                AI 두 개가 독립적으로 분석했고, 보고서 2건이 생성됐습니다.
                실운영 전환을 확정하려면 아래 버튼을 눌러주세요.
              </Text>
              <Pressable
                style={[styles.approvalBtn, (BACKEND_PENDING || confirming) && styles.btnDisabled]}
                onPress={() => void approveProduction()}
                disabled={BACKEND_PENDING || confirming}
              >
                <Text style={styles.approvalBtnText}>
                  {confirming ? '처리 중…' : '실운영 전환 확정'}
                </Text>
              </Pressable>
            </View>
          )}
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
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  statusBanner: {
    borderRadius: 10,
    padding: 16,
  },
  bannerGreen: { backgroundColor: '#e8faf6', borderWidth: 1, borderColor: '#1aa174' },
  bannerBlue: { backgroundColor: '#ebf7fa', borderWidth: 1, borderColor: '#0088cc' },
  bannerTitle: { fontSize: FontSize.t6, fontWeight: '700', color: '#17181c', marginBottom: 4 },
  bannerSub: { fontSize: FontSize.t7, color: '#e81607' },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e4e5ea',
  },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  stepMain: { flex: 1 },
  stepLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c' },
  stepDesc: { fontSize: FontSize.t7, color: '#868b94', marginTop: 2 },
  stepStatus: { fontSize: FontSize.tab, fontWeight: '700', flexShrink: 0 },
  stepDetail: {
    fontSize: FontSize.t7,
    color: '#3a3b40',
    marginTop: 8,
    paddingLeft: 22,
    lineHeight: LineHeight.t7,
  },
  stepDate: {
    fontSize: FontSize.tab,
    color: '#868b94',
    marginTop: 4,
    paddingLeft: 22,
  },
  stepConnector: {
    position: 'absolute',
    left: 20,
    bottom: -12,
    width: 1,
    height: 12,
    backgroundColor: '#e4e5ea',
  },
  approvalBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    borderWidth: 2,
    borderColor: '#ff6f61',
    marginTop: 8,
  },
  approvalTitle: { fontSize: FontSize.t6, fontWeight: '700', color: '#17181c', marginBottom: 8 },
  approvalDesc: { fontSize: FontSize.t7, color: '#5a5d6a', lineHeight: LineHeight.t7, marginBottom: 16 },
  approvalBtn: {
    backgroundColor: '#ff6f61',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approvalBtnText: { fontSize: FontSize.t6, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
