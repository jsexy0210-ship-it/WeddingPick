/**
 * 웨딩피드 관리
 *
 * 2026-09-15 대표 지시 — 「관리자에 웨딩피드 콘텐츠 메뉴 만들어. 목록 등록 삭제 수정
 * 다 가능해야 하고 지속 콘텐츠 작성한다」. 운영자가 직접 쓰고 고치고 지운다.
 *
 * **자동 작성은 화면에서 뺐다**(2026-09-15 대표 지시 — 「내가 직접 작성할게 자동
 * 작성은 빼」). 대표님이 「지금 자동 작성」을 누르셨을 때 실패했고, 그 원인을 캐다가
 * 나온 사실이 결정을 바꿨다 — **운영 서버의 Anthropic API 호출은 Max 구독 밖이라
 * 종량 과금이다.** 제미나이에서 클로드로 옮긴 것이 돈을 아낀 것이 아니었다.
 *
 * 서버 쪽 경로(`POST /v1/admin/wedding-feed/generate` · `worker-loops.ts`)는
 * 지우지 않고 남긴다 — 대표님이 다시 켜자고 하시면 화면에 단추를 되돌리면 된다.
 * 다만 **키가 배포에 없어 지금 부르면 실패한다.** 안 되는 단추를 화면에 두면
 * 운영자는 그것을 「고장」으로 읽는다(CLAUDE.md — 빈 껍데기는 메뉴에서 뺀다).
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
  /*
   * 지우기가 실패했을 때 배너에 적는 말. 전에는 자동 작성의 `generateMsg`를 빌려
   * 쓰고 있었다 — 자동 작성을 화면에서 빼면서 드러났다. 빌린 상태는 그 주인이
   * 사라질 때까지 아무도 모른다.
   */
  const [actionMsg, setActionMsg] = useState<string | null>(null);


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
      setActionMsg(e instanceof Error ? e.message : '삭제 실패');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
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
    : `공개 ${publishedCount}건 · 초안 ${draftCount}건 · 목표 ${WEDDING_FEED_TARGET_PUBLISHED}건`;

  return (
    <Page
      title="웨딩피드 관리"
      sub="홈 아래쪽에 깔리는 읽을거리 — 대표님이 직접 쓴다"
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner tone={actionMsg ? 'bad' : bannerTone} title={bannerTitle} detail={actionMsg ?? bannerDetail} />

          <CardGrid>
            <Card title="글 목록" sub="등록 · 수정 · 삭제는 직접 한다" action={{ label: '+ 새 글', onPress: openNew, kind: 'brand' }} full>
              <DataTable cols={COLS} rows={rows} empty="등록된 글이 없어요" />
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
