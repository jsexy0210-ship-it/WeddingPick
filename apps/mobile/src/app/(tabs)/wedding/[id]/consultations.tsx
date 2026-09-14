import type { ConsultationRecord } from '@weddingpick/api-contract';
import { VISIT_NOTE_AUDIO_CONSENT_POINTS, manwon } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { confirmConsultation, listConsultations } from '@/api/client';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';
import { formatDateDot } from '@/features/common/format-date';
import {
  ActionButton,
  ErrorView,
  Layout,
  SkeletonView,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import { Badge, Hero, NavBar, NoteCard, Screen, Section } from '@/features/wedding/screen-kit';

/**
 * 상담기록 — 올린 녹음에서 뽑은 것을 보고 고치고 저장한다.
 *
 * ## 무엇을 먼저 보여주나
 *
 * **녹취록을 먼저 보여주지 않는다**(2026-09-14 요청 §30). 애초에 만들지도 않는다.
 * 사람이 계약 전에 알아야 하는 순서로 세운다 —
 *
 *   총 제시금액 → 기본 포함 → 추가 비용 → 혜택 → 주의할 점 → 다시 확인할 것
 *
 * **「다시 확인할 것」이 이 화면의 값어치다.** 들은 것을 적어주는 것보다 못 들은
 * 것을 짚어주는 것이 계약 전에 쓸모 있다.
 *
 * ## 확정이 아니다
 *
 * 저장하기 전까지는 「확인 필요」다. 사용자가 보고 눌러야 저장되고, **그때 원본이
 * 지워진다.** 화면에 「녹음 파일은 지웠어요」가 뜨는 이유는 약속했으면 지켜진 것도
 * 보여야 하기 때문이다.
 */

/** 문구. spec/strings.ko.json consultation.* */
const TITLE = '상담기록';
const EMPTY_TITLE = '아직 올린 상담이 없어요';
const EMPTY_BODY = '업체와 상담한 녹음을 올리면 금액과 조건을 정리해드려요.';
const ADD = '녹음 올리기';
const PENDING = '확인 필요';
const CONSENT_TITLE = '올리기 전에 확인해주세요';
const CONSENT_AGREE = '확인했어요';
const REVIEW_BODY = '금액과 계약 조건은 저장하기 전에 확인해주세요.';
const CONFIRM = '확인했어요. 저장할게요';
const AUDIO_GONE = '녹음 파일은 지웠어요';

/**
 * 파일 고르기가 아직 없다 — 올리는 길은 다음 작업이다.
 *
 * **서버는 이미 있다.** 업로드 자리를 주는 라우트도, 읽는 파이프라인도, 저장과
 * 파기도 돈다. 없는 것은 앱에서 파일을 고르는 부분뿐이라, 그것이 붙으면 이 값
 * 하나만 지운다.
 *
 * 관리자 화면의 `READ_ONLY`와는 다른 자리다 — 그쪽은 메뉴에 「조회만」을 함께
 * 적어야 하는 짝이 있고, 여기는 단추 하나가 전부다.
 *
 * **그때까지 눌리지 않게 막는다.** 눌리는데 아무 일도 안 일어나면 사용자는
 * 고장으로 읽는다.
 */
const BACKEND_PENDING = true;

type Money = { value: number | null; confidence: number; evidence: string | null };

function money(data: Record<string, unknown>, key: string): Money | null {
  const raw = data[key];

  if (!raw || typeof raw !== 'object') return null;

  const cell = raw as Partial<Money>;

  return typeof cell.value === 'number'
    ? { value: cell.value, confidence: cell.confidence ?? 0, evidence: cell.evidence ?? null }
    : null;
}

function list(data: Record<string, unknown>, key: string): string[] {
  const raw = data[key];

  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

export default function ConsultationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<ConsultationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  /* 두 번 눌러도 한 번만 보낸다. */
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    listConsultations(id)
      .then((page) => setRecords(page.records))
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  async function save(recordId: string) {
    setSaving(recordId);

    try {
      await confirmConsultation(recordId);
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <Screen>
      <NavBar
        title={TITLE}
        right={{ label: ADD, onPress: () => setConsentOpen(true), disabled: BACKEND_PENDING }}
      />

      {records === null ? (
        <SkeletonView />
      ) : records.length === 0 ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Hero title={EMPTY_TITLE} sub={EMPTY_BODY} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Hero title={`상담 ${records.length}건을 정리했어요`} />

          {records.map((record) => (
            <Record
              key={record.id}
              record={record}
              saving={saving === record.id}
              onSave={() => void save(record.id)}
            />
          ))}
        </ScrollView>
      )}

      <BottomSheet visible={consentOpen} onRequestClose={() => setConsentOpen(false)}>
        <View style={SHEET_PANEL}>
          <ThemedText type="title">{CONSENT_TITLE}</ThemedText>

          {/*
            * 지켜야 하는 것의 원본은 도메인이다. 여기서 문장을 새로 짓지 않는다 —
            * 화면과 처리방침이 다른 말을 하면 어느 쪽이 맞는지 알 수 없어진다.
            */}
          {VISIT_NOTE_AUDIO_CONSENT_POINTS.map((point) => (
            <ThemedText key={point} type="body">
              · {point}
            </ThemedText>
          ))}

          <ActionButton
            label={CONSENT_AGREE}
            onPress={() => setConsentOpen(false)}
            disabled={BACKEND_PENDING}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function Record({
  record,
  saving,
  onSave,
}: {
  record: ConsultationRecord;
  saving: boolean;
  onSave: () => void;
}) {
  const final = money(record.common, 'finalAmount') ?? money(record.common, 'quotedTotal');
  const included = list(record.common, 'included');
  const extras = list(record.after, 'additionalCosts');
  const benefits = list(record.after, 'benefits');
  const warnings = list(record.after, 'warnings');
  const missing = list(record.after, 'missingInformation');
  const summary = typeof record.after.summary === 'string' ? record.after.summary : null;

  return (
    <ThemedView style={styles.card}>
      <View style={styles.head}>
        <ThemedText type="t4">{record.vendorLabel ?? '업체 미확인'}</ThemedText>
        {record.confirmedAt ? null : <Badge label={PENDING} tone="wait" />}
      </View>

      {/* 1. 총 제시금액이 맨 위다. 사람이 제일 먼저 보는 값이다. */}
      {final?.value === null || final === null ? null : (
        <View>
          <ThemedText type="amount">{manwon(final.value)}</ThemedText>
          {final.evidence ? (
            <ThemedText type="small" style={styles.evidence}>
              들은 말: {final.evidence}
            </ThemedText>
          ) : null}
        </View>
      )}

      <Lines label="기본 포함" items={included} />
      <Lines label="추가 비용" items={extras} />
      <Lines label="혜택" items={benefits} />
      <Lines label="주의할 점" items={warnings} />

      {/* **이것이 이 화면의 값어치다.** 못 들은 것을 짚어준다. */}
      <Lines label="다시 확인할 것" items={missing} />

      {summary ? <NoteCard title="상담 내용" body={summary} /> : null}

      {record.confirmedAt ? (
        <ThemedText type="small" style={styles.gone}>
          {formatDateDot(record.confirmedAt)} · {AUDIO_GONE}
        </ThemedText>
      ) : (
        <View>
          <ThemedText type="small" style={styles.reviewNote}>
            {REVIEW_BODY}
          </ThemedText>
          <ActionButton label={CONFIRM} onPress={onSave} disabled={saving} />
        </View>
      )}
    </ThemedView>
  );
}

/** 빈 목록은 아예 안 그린다 — 「없음」을 줄줄이 세우면 있는 것이 묻힌다. */
function Lines({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <Section label={label}>
      {items.map((item) => (
        <ThemedText key={item} type="body">
          · {item}
        </ThemedText>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.five, gap: Spacing.three },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  evidence: { marginTop: 2 },
  gone: { marginTop: Spacing.one },
  reviewNote: { marginBottom: Spacing.one },
});
