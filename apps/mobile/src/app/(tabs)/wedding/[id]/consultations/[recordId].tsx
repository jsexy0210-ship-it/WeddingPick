import type { ConsultationRecord } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { confirmConsultation, listConsultations } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { formatDateDot } from '@/features/common/format-date';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { ActionButton, Spacing, ThemedText } from '@weddingpick/ui';
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
      dismissToOrReplace('/wedding?tab=consult');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  const final = record ? money(record.common, 'finalAmount') ?? money(record.common, 'quotedTotal') : null;

  return (
    <View style={styles.host}>
      <WeddingScreen initialTab="consult" />

      <BottomSheet visible onRequestClose={close} style={styles.sheetHost} testID="consultation-detail-sheet">
        <SheetPanel style={styles.sheet}>
          {!loaded ? (
            <DelayedLoader active size={28} />
          ) : !record ? (
            <>
              <ThemedText type="t4">상담기록을 찾을 수 없어요</ThemedText>
              <ActionButton label="닫기" onPress={close} />
            </>
          ) : (
            <>
              <View style={styles.head}>
                <ThemedText type="t4">{record.vendorLabel ?? '업체 미확인'}</ThemedText>
                <ThemedText type="t7" themeColor="textSecondary">
                  {record.confirmedAt ? `${formatDateDot(record.confirmedAt)} · 저장됨` : '정리 완료'}
                </ThemedText>
              </View>

              <ScrollView
                style={{ maxHeight: Math.max(260, height * 0.58) }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}>
                {final?.value != null ? (
                  <View style={styles.group}>
                    <ThemedText type="t2">{manwon(final.value)}</ThemedText>
                    {final.evidence ? (
                      <ThemedText type="t7" themeColor="textSecondary">
                        들은 말: {final.evidence}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}

                {/* 이름표는 v3.28 `analysis` 블록 제목 — 포함 · 별도로 확인할 비용 · 확인 필요. */}
                <Lines label="포함" items={list(record.common, 'included')} />
                <Lines label="별도로 확인할 비용" items={list(record.after, 'additionalCosts')} />
                <Lines label="혜택" items={list(record.after, 'benefits')} />
                <Lines label="주의할 점" items={list(record.after, 'warnings')} />
                <Lines label="확인 필요" items={list(record.after, 'missingInformation')} />

                {typeof record.after.summary === 'string' ? (
                  <View style={styles.group}>
                    <ThemedText type="t7" themeColor="textSecondary">상담 내용</ThemedText>
                    <ThemedText type="body">{record.after.summary}</ThemedText>
                  </View>
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
              <ActionButton label="닫기" disabled={saving} onPress={close} />
            </>
          )}
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

function Lines({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <ThemedText type="t7" themeColor="textSecondary">{label}</ThemedText>
      {items.map((item) => <ThemedText key={item} type="body">· {item}</ThemedText>)}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHost: { flexShrink: 1 },
  sheet: { flexShrink: 1 },
  head: { gap: Spacing.one },
  content: { gap: Spacing.three, paddingBottom: Spacing.two },
  group: { gap: Spacing.one },
});
