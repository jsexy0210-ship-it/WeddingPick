import type { ConsultationRecord } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { confirmConsultation, listConsultations } from '@/api/client';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { ActionButton, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';

import WeddingScreen from '../../index';

type Money = { value: number | null; evidence: string | null };

function money(data: Record<string, unknown>, key: string): Money | null {
  const raw = data[key];
  if (!raw || typeof raw !== 'object') return null;
  const cell = raw as { value?: unknown; evidence?: unknown };
  return typeof cell.value === 'number'
    ? { value: cell.value, evidence: typeof cell.evidence === 'string' ? cell.evidence : null }
    : null;
}

function list(data: Record<string, unknown>, key: string): string[] {
  const raw = data[key];
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

/** 홑 문자열 칸(`consultation-spec.ts`의 `text()`) — 값이 없으면 null. */
function str(data: Record<string, unknown>, key: string): string | null {
  const raw = data[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/**
 * 상담 정리 결과 시트 — WP-NOTE-005 · `docs/design/React_Native/note.jsx` frame-004.
 *
 *   formHead   공용 SheetHeader — 업체명 + 우측 36px 회색 원형 X
 *   sheetSub   «9월 14일 · 180만원» 14 · MUTED
 *   블록        `ab()` — 제목 12/700(확인 필요만 amber) + 상자 `padding:14px 16px;radius 10;SEC`
 *              (확인 필요는 `#fff8ee`), 줄 14/20
 *   sheetDock  «저장» 하나. 저장한 기록은 단추 없이 닫기만 한다
 *
 * `DESIGN_UNRESOLVED`: 정본 dock의 «수정»(ghost)은 고칠 칸을 보여줄 화면이 정본에 없어
 * 넣지 않았다. 정본 5블록 밖의 «혜택» · «주의할 점» · «상담 내용»은 실제로 읽어 낸 값이라
 * 대표님 확인 전까지 같은 블록 모양으로 남긴다.
 */
export default function ConsultationDetailRoute() {
  const { id, recordId } = useLocalSearchParams<{ id: string; recordId: string }>();
  const { height } = useWindowDimensions();
  const requestKey = `${id}:${recordId}`;
  const [record, setRecord] = useState<ConsultationRecord | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listConsultations(id)
      .then((page) => {
        if (!active) return;
        setRecord(page.records.find((item) => item.id === recordId) ?? null);
        setError(null);
      })
      .catch((caught: Error) => {
        if (active) setError(caught.message);
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [id, recordId, requestKey]);

  const loaded = loadedKey === requestKey;

  function close() {
    if (saving) return;
    dismissToOrReplace('/wedding?tab=consult');
  }

  async function save() {
    if (!record || saving) return;
    setSaving(true);
    setError(null);
    try {
      await confirmConsultation(record.id);
      showResultToast('상담 기록을 저장했어요');
      dismissToOrReplace('/wedding?tab=consult');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  const final = record ? money(record.common, 'finalAmount') ?? money(record.common, 'quotedTotal') : null;
  const created = record ? new Date(record.createdAt) : null;
  const sub = created
    ? `${created.getMonth() + 1}월 ${created.getDate()}일${final?.value != null ? ` · ${manwon(final.value)}` : ''}`
    : '';

  return (
    <View style={styles.host}>
      <WeddingScreen initialTab="consult" />

      <BottomSheet visible onRequestClose={close} style={styles.sheetHost} testID="consultation-detail-sheet">
        <SheetPanel style={styles.sheet}>
          {!loaded ? (
            <DelayedLoader active size={28} />
          ) : !record ? (
            <>
              <SheetHeader title="상담기록을 찾을 수 없어요" onClose={close} />
              <ActionButton label="닫기" onPress={close} />
            </>
          ) : (
            <>
              <SheetHeader title={record.vendorLabel ?? '업체 미확인'} titleLines={1} onClose={close} />
              <ThemedText type="f14" themeColor="textAssistive" numeric>
                {sub}
              </ThemedText>

              <ScrollView
                style={{ maxHeight: Math.max(260, height * 0.58) }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}>
                {/* WP-NOTE-005 정본 analysis 5블록 — 라벨은 정본 문구 그대로(대조표 「분석 라벨」). */}
                <Lines label="포함" items={list(record.common, 'included')} />
                <Lines label="별도로 확인할 비용" items={list(record.after, 'additionalCosts')} />
                <Lines
                  label="진행 조건"
                  items={[str(record.common, 'scheduleNote'), str(record.common, 'changeCondition')].filter(
                    (v): v is string => v !== null
                  )}
                />
                <Lines
                  label="취소 · 환불"
                  items={[str(record.common, 'cancelCondition'), str(record.common, 'refundCondition')].filter(
                    (v): v is string => v !== null
                  )}
                />
                <Lines label="확인 필요" items={list(record.after, 'missingInformation')} warn />
                {/* 정본 5블록 밖의 실제 추출 값 — 지우면 있는 정보를 없는 것처럼 만든다.
                    DESIGN_UNRESOLVED: 정본 목업엔 없는 두 칸, 대표님 확인 전까지 유지. */}
                <Lines label="혜택" items={list(record.after, 'benefits')} />
                <Lines label="주의할 점" items={list(record.after, 'warnings')} />

                {typeof record.after.summary === 'string' ? (
                  <Lines label="상담 내용" items={[record.after.summary]} />
                ) : null}

                {error ? (
                  <ThemedText type="t7" themeColor="negative">
                    {error}
                  </ThemedText>
                ) : null}
              </ScrollView>

              {!record.confirmedAt ? (
                <ActionButton
                  variant="primary"
                  label={saving ? '저장하는 중…' : '저장'}
                  disabled={saving}
                  onPress={() => void save()}
                />
              ) : null}
            </>
          )}
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

/** 정본 `ab()` — 5블록 중 「확인 필요」만 `warn`(amber #805217 · `theme.cautionary`)로 그린다. */
function Lines({ label, items, warn = false }: { label: string; items: string[]; warn?: boolean }) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <ThemedText type="f12" themeColor={warn ? 'cautionary' : 'textAssistive'} style={styles.bold}>
        {label}
      </ThemedText>
      {/* 「확인 필요」 상자의 정본 `#fff8ee`는 맞는 토큰이 없다(`cautionaryBackground`는 #ffe3ba) —
          DESIGN_UNRESOLVED. 토큰이 생길 때까지 다른 블록과 같은 SEC로 둔다. */}
      <View style={[styles.box, { backgroundColor: theme.backgroundSelected }]}>
        {items.map((item) => (
          <ThemedText key={item} type="f14">
            {item}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHost: { flexShrink: 1 },
  sheet: { flexShrink: 1 },
  bold: { fontWeight: 700 },
  /* note.js `sheetBody` — 블록 사이 `gap:16px`. */
  content: { gap: Spacing.three, paddingBottom: Spacing.two },
  /* `aBlock` — `gap:8px`. */
  group: { gap: Spacing.two },
  /* `ab().boxStyle` — `gap:8px;padding:14px 16px;border-radius:10px`. */
  box: { gap: Spacing.two, paddingVertical: 14, paddingHorizontal: Spacing.three, borderRadius: Radius.medium },
});
