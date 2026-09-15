/**
 * 웨딩피드 관리
 *
 * 2026-09-15 대표 지시 — 「관리자에 웨딩피드 콘텐츠 메뉴 만들어. 목록 등록 삭제 수정
 * 다 가능해야 하고 지속 콘텐츠 작성한다」. 운영자가 직접 쓰고 고치고 지우는 위에,
 * 자동 작성(`worker-loops.ts`)이 공개 글이 목표(8건)보다 적을 때 스스로 채운다.
 *
 * 규칙과 한도는 `packages/domain/src/wedding-feed.ts` 한 곳에서만 온다 — 여기서
 * 값을 다시 적으면 화면과 서버가 다른 길이를 막게 된다.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_SOURCE_LABEL,
  WEDDING_FEED_STATUSES,
  WEDDING_FEED_STATUS_LABEL,
  WEDDING_FEED_TARGET_PUBLISHED,
  type WeddingFeedStatus,
} from '@weddingpick/domain';
import { Colors, FontSize, LineHeight, Radius, Spacing } from '@weddingpick/ui';

import { formatDateTimeDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  ConfirmCard,
  type Col,
  DataTable,
  LoadError,
  Page,
  Rows,
  StatusBanner,
  type TableRow,
} from './_ui';

type Post = {
  id: string;
  categoryLabel: string;
  title: string;
  summary: string;
  body: string;
  imageKey: string | null;
  imageUrl: string | null;
  status: WeddingFeedStatus;
  source: 'manual' | 'generated';
  model: string | null;
  topic: string | null;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Run = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  createdCount: number;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
  trigger: 'schedule' | 'manual';
};

type FeedData = { posts: Post[]; runs: Run[]; remainingTopics: number };

type FormState = {
  categoryLabel: string;
  title: string;
  summary: string;
  body: string;
  status: WeddingFeedStatus;
  sortOrder: string;
};

const BLANK_FORM: FormState = {
  categoryLabel: '',
  title: '',
  summary: '',
  body: '',
  status: 'draft',
  sortOrder: '0',
};

function toForm(post: Post): FormState {
  return {
    categoryLabel: post.categoryLabel,
    title: post.title,
    summary: post.summary,
    body: post.body,
    status: post.status,
    sortOrder: String(post.sortOrder),
  };
}

const COLS: Col[] = [
  { key: 'status', label: '상태', width: 70 },
  { key: 'category', label: '카테고리', width: 100 },
  { key: 'title', label: '제목', width: 320, grow: true },
  { key: 'source', label: '출처', width: 90 },
  { key: 'order', label: '순서', width: 60, align: 'right' },
  { key: 'updated', label: '수정일', width: 150 },
  { key: 'edit', label: '', width: 60 },
  { key: 'delete', label: '', width: 60 },
];

const STATUS_KIND: Record<WeddingFeedStatus, 'ok' | 'warn' | 'dim'> = {
  published: 'ok',
  draft: 'warn',
  archived: 'dim',
};

export default function WeddingFeedScreen() {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/wedding-feed')
      .then((d) => {
        if (cancelled) return;
        setData(d as FeedData);
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

  const [editing, setEditing] = useState<Post | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Post | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  const posts = data?.posts ?? [];
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;

  function openNew() {
    setForm(BLANK_FORM);
    setEditing('new');
    setSaveError(null);
  }

  function openEdit(post: Post) {
    setForm(toForm(post));
    setEditing(post);
    setSaveError(null);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const sortOrder = Number.parseInt(form.sortOrder, 10);
      const payload = {
        categoryLabel: form.categoryLabel,
        title: form.title,
        summary: form.summary,
        body: form.body,
        status: form.status,
        sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      };

      if (editing === 'new') {
        await apiFetch('/v1/admin/wedding-feed', { method: 'POST', body: JSON.stringify(payload) });
      } else if (editing) {
        await apiFetch(`/v1/admin/wedding-feed/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function commitDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/v1/admin/wedding-feed/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      reload();
    } catch (e) {
      setGenerateMsg(e instanceof Error ? e.message : '삭제 실패');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function generateNow() {
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const res = (await apiFetch('/v1/admin/wedding-feed/generate', { method: 'POST' })) as {
        created: number;
        skipped: string | null;
      };
      setGenerateMsg(res.skipped ?? `새 초안 ${res.created}건을 썼어요.`);
      reload();
    } catch (e) {
      setGenerateMsg(e instanceof Error ? e.message : '자동 작성 실패');
    } finally {
      setGenerating(false);
    }
  }

  const rows: TableRow[] = posts.map((post) => ({
    key: post.id,
    cells: [
      { v: WEDDING_FEED_STATUS_LABEL[post.status], badge: STATUS_KIND[post.status] },
      { v: post.categoryLabel },
      { v: post.title, bold: true },
      { v: WEDDING_FEED_SOURCE_LABEL[post.source] },
      { v: String(post.sortOrder) },
      { v: formatDateTimeDot(post.updatedAt) },
      { v: '수정', kind: 'brand', onPress: () => openEdit(post) },
      { v: '삭제', kind: 'bad', onPress: () => setDeleting(post) },
    ],
  }));

  const bannerTone = error ? 'bad' : draftCount > 0 ? 'warn' : 'ok';
  const bannerTitle = error
    ? '목록을 불러오지 못했어요'
    : draftCount > 0
      ? `검토를 기다리는 초안 ${draftCount}건이 있어요`
      : `공개 글 ${publishedCount}건이 돌고 있어요`;
  const bannerDetail = error
    ? error
    : `공개 ${publishedCount}건 · 초안 ${draftCount}건 · 목표 ${WEDDING_FEED_TARGET_PUBLISHED}건` +
      (data ? ` · 자동 작성이 쓸 수 있는 주제 ${data.remainingTopics}개 남음` : '');

  return (
    <Page
      title="웨딩피드 관리"
      sub="홈 아래쪽에 깔리는 읽을거리 — 직접 쓰거나 자동 작성이 채운다"
      action={{
        label: generating ? '쓰는 중…' : '지금 자동 작성',
        onPress: () => void generateNow(),
        kind: 'brand',
        disabled: generating,
      }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner tone={bannerTone} title={bannerTitle} detail={generateMsg ?? bannerDetail} />

          <CardGrid>
            <Card title="글 목록" sub="등록 · 수정 · 삭제는 직접 한다" action={{ label: '+ 새 글', onPress: openNew, kind: 'brand' }} full>
              <DataTable cols={COLS} rows={rows} empty="등록된 글이 없어요" />
            </Card>

            <Card title="자동 작성 기록" sub="최근 것부터. 아무것도 안 나온 바퀴도 남는다" full>
              {data.runs.length === 0 ? (
                <Text style={styles.emptyRuns}>아직 돈 적이 없어요.</Text>
              ) : (
                <Rows
                  items={data.runs.map((run) => ({
                    key: run.id,
                    dot: run.error ? 'bad' : run.createdCount > 0 ? 'ok' : 'none',
                    name: `${formatDateTimeDot(run.startedAt)} · ${run.trigger === 'manual' ? '지금 실행' : '자동'}`,
                    meta:
                      (run.model ? `모델 ${run.model} · ` : '') +
                      `만든 글 ${run.createdCount}건` +
                      (run.error ? ` · ${run.error}` : ''),
                  }))}
                />
              )}
            </Card>
          </CardGrid>

          {editing ? (
            <Card title={editing === 'new' ? '새 글 작성' : '글 수정'} full>
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>카테고리</Text>
                <TextInput
                  style={styles.input}
                  value={form.categoryLabel}
                  onChangeText={(v) => setForm((f) => ({ ...f, categoryLabel: v }))}
                  placeholder="예산 · 체크리스트 · 웨딩홀…"
                  maxLength={WEDDING_FEED_LIMITS.categoryLabel}
                />
                <Text style={styles.fieldLabel}>제목</Text>
                <TextInput
                  style={styles.input}
                  value={form.title}
                  onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                  maxLength={WEDDING_FEED_LIMITS.title}
                />
                <Text style={styles.fieldLabel}>한 줄 요약</Text>
                <TextInput
                  style={styles.input}
                  value={form.summary}
                  onChangeText={(v) => setForm((f) => ({ ...f, summary: v }))}
                  maxLength={WEDDING_FEED_LIMITS.summary}
                />
                <Text style={styles.fieldLabel}>본문</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  multiline
                  numberOfLines={6}
                  value={form.body}
                  onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
                  maxLength={WEDDING_FEED_LIMITS.body}
                  textAlignVertical="top"
                />
                <Text style={styles.fieldLabel}>노출 순서</Text>
                <TextInput
                  style={styles.input}
                  value={form.sortOrder}
                  onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldLabel}>상태</Text>
                <View style={styles.statusRow}>
                  {WEDDING_FEED_STATUSES.map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => setForm((f) => ({ ...f, status }))}
                      style={[styles.statusChip, form.status === status && styles.statusChipActive]}
                    >
                      <Text style={[styles.statusChipLabel, form.status === status && styles.statusChipLabelActive]}>
                        {WEDDING_FEED_STATUS_LABEL[status]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

                <View style={styles.formActions}>
                  <Pressable style={styles.btnGhost} onPress={() => setEditing(null)} disabled={saving}>
                    <Text style={styles.btnGhostLabel}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnPrimary, saving && styles.btnDisabled]}
                    onPress={() => void save()}
                    disabled={saving}
                  >
                    <Text style={styles.btnPrimaryLabel}>{saving ? '저장 중…' : '저장'}</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ) : null}

          {deleting ? (
            <ConfirmCard
              title="이 글을 지울까요?"
              body="지우면 되돌릴 수 없어요. 홈에 걸려 있었다면 그 자리도 함께 사라져요."
              items={[
                `제목 ${deleting.title}`,
                `카테고리 ${deleting.categoryLabel}`,
                `상태 ${WEDDING_FEED_STATUS_LABEL[deleting.status]} → 삭제됨`,
                `출처 ${WEDDING_FEED_SOURCE_LABEL[deleting.source]}`,
              ]}
              cta={deleteBusy ? '지우는 중…' : '삭제'}
              danger
              onConfirm={() => void commitDelete()}
              onCancel={() => setDeleting(null)}
            />
          ) : null}
        </>
      ) : null}
    </Page>
  );
}

const C = Colors.light;

const styles = StyleSheet.create({
  emptyRuns: { fontSize: FontSize.micro, color: C.textAssistive },
  form: { gap: Spacing.two },
  fieldLabel: { fontSize: FontSize.tab, fontWeight: '700', color: C.textAssistive, marginTop: Spacing.two },
  input: {
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: C.fieldBorder,
    backgroundColor: C.background,
    color: C.text,
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7,
  },
  multiline: { height: 140, paddingTop: Spacing.two },
  statusRow: { flexDirection: 'row', gap: Spacing.two },
  statusChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.control,
    backgroundColor: C.backgroundSelected,
  },
  statusChipActive: { backgroundColor: C.tint },
  statusChipLabel: { fontSize: FontSize.tab, fontWeight: '700', color: C.textSecondary },
  statusChipLabelActive: { color: C.onTint },
  error: { fontSize: FontSize.t7, color: C.negative },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, marginTop: Spacing.two },
  btnGhost: {
    height: 40,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.control,
    justifyContent: 'center',
    backgroundColor: C.backgroundSelected,
  },
  btnGhostLabel: { fontSize: FontSize.t7, fontWeight: '700', color: C.textSecondary },
  btnPrimary: {
    height: 40,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.control,
    justifyContent: 'center',
    backgroundColor: C.tint,
  },
  btnPrimaryLabel: { fontSize: FontSize.t7, fontWeight: '700', color: C.onTint },
  btnDisabled: { opacity: 0.5 },
});
