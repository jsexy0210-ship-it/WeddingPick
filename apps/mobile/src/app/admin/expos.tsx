/**
 * 박람회 관리. `docs/expo-agent-spec.md`가 정본이다.
 *
 * 검수 대기(`admin_review_required`)가 맨 위에 온다 — 지금 봐야 할 것이 위(2026-09-15
 * 관리자 공통 규칙). 삭제는 되돌릴 수 없어 `ConfirmCard`로 무엇이 바뀌는지 보여준 뒤
 * 진행한다. 자동 수집은 아직 붙지 않았다(PR 본문 참고) — 지금은 수동 등록 + 검수
 * 경로다.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { formatCount } from '@weddingpick/domain';
import { DelayedLoader } from '@/features/loading/delayed-loader';

import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  ConfirmCard,
  DataTable,
  KpiRow,
  LoadError,
  Page,
  StatusBanner,
  type Col,
  type Kind,
  type TableRow,
} from './_ui';

type ExpoStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'CANCELLED' | 'POSTPONED';

type ExpoAdmin = {
  id: string;
  title: string;
  organizer: string;
  host: string | null;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  region: string;
  city: string | null;
  district: string | null;
  registrationDeadline: string | null;
  reservationUrl: string | null;
  officialWebsiteUrl: string | null;
  benefits: string[];
  description: string;
  eventCategories: string[];
  status: ExpoStatus;
  confidence: string | null;
  confidenceScore: number | null;
  adminReviewRequired: boolean;
  reviewReason: string[];
  sourceNote: string;
  lastVerifiedAt: string;
};

type ExpoDue = { id: string; title: string; startsAt: string; endsAt: string; venue: string };

const STATUS_LABEL: Record<ExpoStatus, string> = {
  UPCOMING: '진행 예정',
  ONGOING: '진행 중',
  ENDED: '종료',
  CANCELLED: '취소',
  POSTPONED: '연기',
};

const STATUS_KIND: Record<ExpoStatus, Kind> = {
  UPCOMING: 'brand',
  ONGOING: 'ok',
  ENDED: 'dim',
  CANCELLED: 'bad',
  POSTPONED: 'warn',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  OFFICIAL_CONFIRMED: '공식 확인',
  CROSS_CONFIRMED: '교차 확인',
  SOCIAL_ONLY: 'SNS만',
  CONFLICT: '출처 충돌',
};

const CONFIDENCE_KIND: Record<string, Kind> = {
  OFFICIAL_CONFIRMED: 'ok',
  CROSS_CONFIRMED: 'brand',
  SOCIAL_ONLY: 'warn',
  CONFLICT: 'bad',
};

const LIST_COLS: Col[] = [
  { key: 'title', label: '행사명', width: 220, grow: true },
  { key: 'period', label: '기간', width: 180 },
  { key: 'venue', label: '장소', width: 180 },
  { key: 'region', label: '지역', width: 80 },
  { key: 'status', label: '상태', width: 90 },
  { key: 'confidence', label: '신뢰도', width: 100 },
  { key: 'source', label: '출처', width: 160 },
  { key: 'edit', label: '수정', width: 70 },
  { key: 'remove', label: '삭제', width: 70 },
];

const QUEUE_COLS: Col[] = [
  { key: 'title', label: '행사명', width: 220, grow: true },
  { key: 'period', label: '기간', width: 180 },
  { key: 'venue', label: '장소', width: 180 },
  { key: 'reason', label: '검수 사유', width: 240 },
  { key: 'confidence', label: '신뢰도', width: 100 },
  { key: 'act', label: '조치', width: 100 },
];

const PREVIEW_COLS: Col[] = [
  { key: 'title', label: '행사명', width: 260, grow: true },
  { key: 'period', label: '기간', width: 180 },
  { key: 'venue', label: '장소', width: 200 },
];

type FormState = {
  title: string;
  organizer: string;
  host: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  region: string;
  registrationDeadline: string;
  reservationUrl: string;
  officialWebsiteUrl: string;
  benefits: string;
  description: string;
  sourceNote: string;
  confidence: string;
  confidenceScore: string;
  adminReviewRequired: boolean;
};

const EMPTY_FORM: FormState = {
  title: '',
  organizer: '',
  host: '',
  startsAt: '',
  endsAt: '',
  venue: '',
  address: '',
  region: '',
  registrationDeadline: '',
  reservationUrl: '',
  officialWebsiteUrl: '',
  benefits: '',
  description: '',
  sourceNote: '관리자 등록',
  confidence: '',
  confidenceScore: '',
  adminReviewRequired: false,
};

function toForm(e: ExpoAdmin): FormState {
  return {
    title: e.title,
    organizer: e.organizer,
    host: e.host ?? '',
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venue: e.venue,
    address: e.address,
    region: e.region,
    registrationDeadline: e.registrationDeadline ?? '',
    reservationUrl: e.reservationUrl ?? '',
    officialWebsiteUrl: e.officialWebsiteUrl ?? '',
    benefits: e.benefits.join(', '),
    description: e.description,
    sourceNote: e.sourceNote,
    confidence: e.confidence ?? '',
    confidenceScore: e.confidenceScore != null ? String(e.confidenceScore) : '',
    adminReviewRequired: e.adminReviewRequired,
  };
}

function toBody(f: FormState) {
  return {
    title: f.title.trim(),
    organizer: f.organizer.trim(),
    host: f.host.trim() || null,
    startsAt: f.startsAt.trim(),
    endsAt: f.endsAt.trim(),
    venue: f.venue.trim(),
    address: f.address.trim(),
    region: f.region.trim(),
    registrationDeadline: f.registrationDeadline.trim() || null,
    reservationUrl: f.reservationUrl.trim() || null,
    officialWebsiteUrl: f.officialWebsiteUrl.trim() || null,
    benefits: f.benefits
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    description: f.description.trim(),
    sourceNote: f.sourceNote.trim() || '관리자 등록',
    confidence: f.confidence || null,
    confidenceScore: f.confidenceScore.trim() ? Number(f.confidenceScore.trim()) : null,
    adminReviewRequired: f.adminReviewRequired,
  };
}

export default function ExposScreen() {
  const [expos, setExpos] = useState<ExpoAdmin[] | null>(null);
  const [preview, setPreview] = useState<ExpoDue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ExpoAdmin | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      apiFetch('/v1/admin/expos') as Promise<{ expos: ExpoAdmin[] }>,
      apiFetch('/v1/admin/expos/deletion-preview') as Promise<{ expos: ExpoDue[] }>,
    ])
      .then(([list, due]) => {
        if (cancelled) return;
        setExpos(list.expos);
        setPreview(due.expos);
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

  const reload = () => setRev((r) => r + 1);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormError(null);
  }

  function openEdit(expo: ExpoAdmin) {
    setForm(toForm(expo));
    setEditingId(expo.id);
    setFormError(null);
  }

  async function save() {
    if (!form) return;
    if (!form.title.trim() || !form.organizer.trim() || !form.startsAt.trim() || !form.endsAt.trim() || !form.venue.trim() || !form.region.trim()) {
      setFormError('행사명 · 주최사 · 기간 · 장소 · 지역은 반드시 채워야 해요.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = toBody(form);
      if (editingId) {
        await apiFetch(`/v1/admin/expos/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/admin/expos', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm(null);
      setEditingId(null);
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/expos/${id}/approve`, { method: 'POST' });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/expos/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  const reviewList = (expos ?? []).filter((e) => e.adminReviewRequired);
  const ongoingCount = (expos ?? []).filter((e) => e.status === 'ONGOING').length;

  const listRows: TableRow[] = (expos ?? []).map((e) => ({
    key: e.id,
    cells: [
      { v: e.title, bold: true },
      { v: `${e.startsAt} ~ ${e.endsAt}`, kind: 'dim' },
      { v: e.venue, kind: 'dim' },
      { v: e.region, kind: 'dim' },
      { v: STATUS_LABEL[e.status], badge: STATUS_KIND[e.status] },
      e.confidence
        ? { v: CONFIDENCE_LABEL[e.confidence] ?? e.confidence, badge: CONFIDENCE_KIND[e.confidence] ?? 'none' }
        : { v: '확인 필요', badge: 'warn' as Kind },
      { v: e.sourceNote || '—', kind: 'dim' },
      { v: '수정', kind: 'brand', onPress: () => openEdit(e) },
      { v: '삭제', kind: 'bad', onPress: () => setDeleting(e) },
    ],
  }));

  const queueRows: TableRow[] = reviewList.map((e) => ({
    key: e.id,
    cells: [
      { v: e.title, bold: true },
      { v: `${e.startsAt} ~ ${e.endsAt}`, kind: 'dim' },
      { v: e.venue, kind: 'dim' },
      { v: e.reviewReason.join(' · ') || '확인 필요', kind: 'warn' },
      e.confidence
        ? { v: CONFIDENCE_LABEL[e.confidence] ?? e.confidence, badge: CONFIDENCE_KIND[e.confidence] ?? 'none' }
        : { v: '미확인', badge: 'warn' as Kind },
      { v: '검수 완료', kind: 'brand', onPress: () => void approve(e.id) },
    ],
  }));

  const previewRows: TableRow[] = (preview ?? []).map((e) => ({
    key: e.id,
    cells: [
      { v: e.title, bold: true },
      { v: `${e.startsAt} ~ ${e.endsAt}`, kind: 'dim' },
      { v: e.venue, kind: 'dim' },
    ],
  }));

  return (
    <Page
      title="박람회 관리"
      sub="수집 · 검수 · 종료 자동 삭제"
      action={{ label: '박람회 등록', onPress: openCreate, kind: 'brand' }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && expos ? (
        <>
          <StatusBanner
            tone={actionError ? 'bad' : reviewList.length === 0 ? 'ok' : 'warn'}
            title={
              actionError
                ? '처리하지 못했어요'
                : reviewList.length === 0
                  ? '검수 대기가 없어요'
                  : `검수 대기 ${formatCount(reviewList.length)}건이 있어요`
            }
            detail={
              actionError
                ? actionError
                : reviewList.length === 0
                  ? '아래는 지금 노출 중인 박람회 전체예요.'
                  : 'SNS 한 곳에서만 확인됐거나 출처끼리 정보가 달라 확인이 필요해요.'
            }
          />

          <KpiRow
            items={[
              {
                label: '검수 대기',
                value: `${formatCount(reviewList.length)}건`,
                kind: reviewList.length === 0 ? 'ok' : 'bad',
              },
              { label: '전체 박람회', value: `${formatCount(expos.length)}건` },
              { label: '진행 중', value: `${formatCount(ongoingCount)}건`, kind: 'ok' },
              {
                label: '내일 종료 정리',
                value: `${formatCount((preview ?? []).length)}건`,
                note: '종료일 다음 날 자동 삭제',
                kind: (preview ?? []).length > 0 ? 'warn' : 'none',
              },
            ]}
          />

          <CardGrid>
            <Card title="검수 대기" sub="지금 확인이 필요한 박람회" full>
              <DataTable cols={QUEUE_COLS} rows={queueRows} empty="확인할 것이 없어요" />
            </Card>

            <Card
              title="내일 지워질 박람회"
              sub="오늘이 종료일이라 내일 자동 삭제돼요"
              full
              note="종료된 박람회는 본문이 사라지고 최소 로그만 남아요."
            >
              <DataTable cols={PREVIEW_COLS} rows={previewRows} empty="내일 지워질 박람회가 없어요" />
            </Card>

            <Card title="전체 박람회" sub="지금 노출 중이거나 관리 중인 박람회" full>
              <DataTable cols={LIST_COLS} rows={listRows} empty="등록된 박람회가 없어요" />
            </Card>
          </CardGrid>

          {deleting ? (
            <ConfirmCard
              title="박람회를 지울까요?"
              body={`${deleting.title}을(를) 지워요.`}
              items={[
                '박람회 본문(일정 · 장소 · 혜택 · 소개)이 사라져요 — 되돌릴 수 없어요',
                '행사명 · 기간 · 장소만 최소 로그로 남아요',
                '검색 · 상세 · 알림 구독에서 함께 사라져요',
              ]}
              cta="삭제"
              danger
              onConfirm={() => void confirmDelete()}
              onCancel={() => setDeleting(null)}
            />
          ) : null}
        </>
      ) : null}

      {/* 등록 · 수정 폼 — 아직 자동 수집이 붙지 않아 지금은 수동 등록이 기본 경로다. */}
      <Modal visible={form !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{editingId ? '박람회 수정' : '박람회 등록'}</Text>

              <Field label="행사명" value={form?.title ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, title: v })} />
              <Field label="주최사" value={form?.organizer ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, organizer: v })} />
              <Field label="주관사(선택)" value={form?.host ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, host: v })} />
              <View style={styles.row2}>
                <Field label="시작일 (YYYY-MM-DD)" value={form?.startsAt ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, startsAt: v })} style={styles.half} />
                <Field label="종료일 (YYYY-MM-DD)" value={form?.endsAt ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, endsAt: v })} style={styles.half} />
              </View>
              <Field label="장소" value={form?.venue ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, venue: v })} />
              <Field label="주소" value={form?.address ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, address: v })} />
              <Field label="지역 (예: 서울)" value={form?.region ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, region: v })} />
              <Field
                label="사전등록 마감일(선택)"
                value={form?.registrationDeadline ?? ''}
                onChangeText={(v) => setForm((f) => f && { ...f, registrationDeadline: v })}
              />
              <Field
                label="공식 신청 링크(선택)"
                value={form?.reservationUrl ?? ''}
                onChangeText={(v) => setForm((f) => f && { ...f, reservationUrl: v })}
              />
              <Field
                label="공식 홈페이지(선택)"
                value={form?.officialWebsiteUrl ?? ''}
                onChangeText={(v) => setForm((f) => f && { ...f, officialWebsiteUrl: v })}
              />
              <Field
                label="혜택 (쉼표로 구분)"
                value={form?.benefits ?? ''}
                onChangeText={(v) => setForm((f) => f && { ...f, benefits: v })}
              />
              <Field
                label="소개"
                value={form?.description ?? ''}
                onChangeText={(v) => setForm((f) => f && { ...f, description: v })}
                multiline
              />
              <Field label="출처" value={form?.sourceNote ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, sourceNote: v })} />

              <Text style={styles.fieldLabel}>신뢰도</Text>
              <View style={styles.confidenceRow}>
                {(['OFFICIAL_CONFIRMED', 'CROSS_CONFIRMED', 'SOCIAL_ONLY', 'CONFLICT'] as const).map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.confidenceBtn, form?.confidence === c && styles.confidenceBtnActive]}
                    onPress={() => setForm((f) => f && { ...f, confidence: f.confidence === c ? '' : c })}
                  >
                    <Text style={[styles.confidenceBtnText, form?.confidence === c && styles.confidenceBtnTextActive]}>
                      {CONFIDENCE_LABEL[c]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={styles.reviewToggle}
                onPress={() => setForm((f) => f && { ...f, adminReviewRequired: !f.adminReviewRequired })}
              >
                <View style={[styles.checkbox, form?.adminReviewRequired && styles.checkboxOn]} />
                <Text style={styles.fieldLabelInline}>검수 대기로 표시</Text>
              </Pressable>

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <View style={styles.modalActions}>
                <Pressable style={styles.ghostBtn} onPress={() => setForm(null)}>
                  <Text style={styles.ghostBtnText}>취소</Text>
                </Pressable>
                <Pressable style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={() => void save()} disabled={saving}>
                  <Text style={styles.primaryBtnText}>{saving ? '저장 중' : '저장'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Page>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  style?: object;
}) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalScroll: { paddingVertical: 40, alignItems: 'center' },
  modalBox: {
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    padding: 24,
    width: 520,
  },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textAssistive, marginBottom: 6, marginTop: 12 },
  fieldLabelInline: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  fieldInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
  },
  fieldInputMultiline: { height: 80, textAlignVertical: 'top' as const, paddingVertical: 8 },
  confidenceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  confidenceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  confidenceBtnActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tintSubtle },
  confidenceBtnText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  confidenceBtnTextActive: { color: Colors.light.tint, fontWeight: '700' },
  reviewToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: Colors.light.fieldBorder },
  checkboxOn: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  formError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  ghostBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  ghostBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textStrong },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  primaryBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  btnDisabled: { opacity: 0.5 },
});
