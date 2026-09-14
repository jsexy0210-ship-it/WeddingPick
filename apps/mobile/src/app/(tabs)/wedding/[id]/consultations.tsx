import type { ConsultationRecord } from '@weddingpick/api-contract';
import {
  VISIT_NOTE_AUDIO_CONSENT_VERSION,
  VISIT_NOTE_AUDIO_CONSENT_POINTS,
  manwon,
} from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  completeConsultationUpload,
  confirmConsultation,
  createConsultationUpload,
  listConsultations,
} from '@/api/client';
import { pickConsultationAudio } from '@/features/capture/pickers';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';
import { formatDateDot } from '@/features/common/format-date';
import {
  ActionButton,
  ErrorView,
  Layout,
  SkeletonView,
  Spacing,
  ThemedText,
} from '@weddingpick/ui';
import { Badge, Band, Hero, NavBar, NoteCard, Screen } from '@/features/wedding/screen-kit';

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
 * 파일이 너무 크면 고르는 자리에서 막는다.
 *
 * **길이는 앱이 재지 않는다.** 기기에서 음성 길이를 읽으려면 재생기가 필요한데,
 * 재 봐야 서버가 믿지 않는다 — 보내는 쪽이 정하는 값이라 두 시간짜리를 60초라고
 * 적어 보낼 수 있다. 길이는 파일이 도착한 뒤 서버가 `ffprobe`로 잰다.
 *
 * 크기는 다르다. 고르는 순간 알 수 있고, 미리 막으면 100MB를 다 올리고 나서
 * 거절당하는 일이 없다.
 */
const MAX_BYTES = 100 * 1024 * 1024;

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
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    listConsultations(id)
      .then((page) => setRecords(page.records))
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  /**
   * 고르기 → 올리기 → 판정 시작.
   *
   * **파일 본체는 API 서버를 지나가지 않는다.** 서명 URL을 받아 스토리지로 바로
   * 올린다 — 100MB짜리가 API를 거칠 이유가 없다.
   */
  async function upload() {
    setConsentOpen(false);

    const picked = await pickConsultationAudio();

    if (!picked) return;

    if (picked.sizeBytes !== undefined && picked.sizeBytes > MAX_BYTES) {
      setError(`파일이 너무 커요. ${Math.floor(MAX_BYTES / 1024 / 1024)}MB까지 올릴 수 있어요.`);
      return;
    }

    setUploading(true);

    try {
      const file = await fetch(picked.uri).then((response) => response.blob());

      const target = await createConsultationUpload({
        weddingId: id,
        mimeType: picked.mimeType as never,
        byteSize: file.size,
        consentVersion: VISIT_NOTE_AUDIO_CONSENT_VERSION,
      });

      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': picked.mimeType },
        body: file,
      });

      if (!put.ok) throw new Error(`올리지 못했어요 (${put.status})`);

      /* 올리기가 끝났음을 알려야 판정이 시작된다. 여기까지 와야 한 건이다. */
      await completeConsultationUpload(target.consultationId);
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setUploading(false);
    }
  }

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
        right={{ label: ADD, onPress: () => setConsentOpen(true), disabled: uploading }}
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

          {/*
            * **기록 사이를 띠로 나눈다.** 카드로 감싸면 화면 바탕 위에 상자가 또
            * 놓여 이중 컨테이너가 된다 — 이 저장소가 전수로 걷어낸 그 모양이다.
            * 찍어 보니 바탕색 없는 카드는 경계가 아예 안 보여서 두 기록이 한
            * 덩어리로 읽혔다.
            */}
          {records.map((record, index) => (
            <View key={record.id}>
              {index > 0 ? <Band /> : null}
              <Record
                record={record}
                saving={saving === record.id}
                onSave={() => void save(record.id)}
              />
            </View>
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

          <ActionButton label={CONSENT_AGREE} onPress={() => void upload()} disabled={uploading} />
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
    <View style={styles.record}>
      <View style={styles.head}>
        <ThemedText type="t4">{record.vendorLabel ?? '업체 미확인'}</ThemedText>
        {record.confirmedAt ? null : <Badge label={PENDING} tone="wait" />}
      </View>

      {/* 1. 총 제시금액이 맨 위다. 사람이 제일 먼저 보는 값이다. */}
      {final?.value === null || final === null ? null : (
        <View>
          <ThemedText type="t2">{manwon(final.value)}</ThemedText>
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
    </View>
  );
}

/**
 * 빈 목록은 아예 안 그린다 — 「없음」을 줄줄이 세우면 있는 것이 묻힌다.
 *
 * **`Section`을 쓰지 않는다.** 그것은 화면 바탕에 놓는 것이라 좌우 gutter를
 * 제 안에 갖고 있고, 카드 안에 넣으면 패딩이 두 번 먹어 **제목과 항목의 왼쪽
 * 선이 어긋난다.** 찍어 보고 알았다 — 코드로는 안 보인다.
 */
function Lines({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.group}>
      <ThemedText type="t7" themeColor="textAssistive">
        {label}
      </ThemedText>
      {items.map((item) => (
        <ThemedText key={item} type="body">
          · {item}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * 아래 여백은 **탭바 높이 위에** 얹는다. 화면 자체는 탭 안에 있어서, 그냥
   * `Spacing.five`만 두면 마지막 줄이 탭바에 잘린다 — 찍어 보고 알았다.
   */
  body: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.tabBar + Spacing.five,
    gap: Spacing.three,
  },
  /** 기록 한 건. 상자로 감싸지 않는다 — 띠가 경계를 맡는다. */
  record: { gap: Spacing.two },
  /** 카드 안의 한 묶음. 라벨과 항목이 같은 왼쪽 선에 선다. */
  group: { gap: Spacing.half },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  evidence: { marginTop: 2 },
  gone: { marginTop: Spacing.one },
  reviewNote: { marginBottom: Spacing.one },
});
