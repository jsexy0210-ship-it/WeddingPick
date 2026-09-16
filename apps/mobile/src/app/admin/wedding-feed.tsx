/**
 * 웨딩피드 관리
 *
 * 2026-09-15 대표 지시 — 「관리자에 웨딩피드 콘텐츠 메뉴 만들어. 목록 등록 삭제 수정
 * 다 가능해야 하고 지속 콘텐츠 작성한다」. 운영자가 직접 쓰고 고치고 지우는 위에,
 * 자동 작성(`worker-loops.ts`)이 공개 글이 목표(8건)보다 적을 때 스스로 채운다.
 *
 * **자동 작성을 한 번 뺐다가 되살렸다**(2026-09-15). 대표님이 「지금 자동 작성」을
 * 누르셨을 때 실패했고, 원인을 캐다 나온 사실이 결정을 두 번 뒤집었다 — 운영 서버의
 * 클로드 API 호출은 Max 구독 밖이라 종량 과금이다. 그래서 「내가 직접 작성할게 자동
 * 작성은 빼」로 뺐고, 제미나이면 값이 다르다는 것을 확인한 뒤 「제미나이로 되돌린다」로
 * 되살렸다. 지금 작성기는 `createGeminiFeedWriter`다.
 *
 * **자동 루프는 꺼져 있다.** `WEDDING_FEED_AUTOWRITE`를 배포에 넣지 않았다 — 이
 * 단추로 한 편 써 보고 품질을 확인한 뒤에 켜는 것이 순서다.
 *
 * 규칙과 한도는 `packages/domain/src/wedding-feed.ts` 한 곳에서만 온다 — 여기서
 * 값을 다시 적으면 화면과 서버가 다른 길이를 막게 된다.
 *
 * **2026-09-15 — 「사이트·기록」 화면의 탭 하나로 자리 잡았다.** `main`의 옛
 * 사이드바는 이 화면을 FAQ·링크 미리보기와 같은 「문구 · 카드」 묶음에 두었는데,
 * 그 묶음이 그대로 「사이트·기록」 탭 넷(FAQ 관리 · 약관·방침 · 링크 미리보기 ·
 * 감사 기록)이 됐다 — 웨딩피드도 사용자에게 노출되는 콘텐츠를 관리자가 직접
 * 쓰고 고치는 화면이라 같은 자리다. `faq.tsx`의 `TABS` 끝에 추가했다. 이 파일
 * 맨 아래 `WeddingFeedRedirect`가 옛 주소를 `/admin/faq?tab=wedding-feed`로
 * 보내고, 본문은 `WeddingFeedPanel`로 이름만 바꿨다.
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  WEDDING_FEED_ALL_TAB,
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_SOURCE_LABEL,
  WEDDING_FEED_STATUSES,
  WEDDING_FEED_STATUS_LABEL,
  WEDDING_FEED_TARGET_PUBLISHED,
  WEDDING_FEED_TAXONOMY_LIMITS,
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

/**
 * 탭과 카테고리 — 2026-09-16 대표 지시 「탭별 카테고리별로 다 설정 가능해야한다」.
 *
 * 전에는 둘 다 코드에 있었고 카테고리 칸은 자유 입력이었다. 「웨딩홀 」(뒤 공백)처럼
 * 적으면 그 글은 어느 탭에도 안 뜨는데 **오류도 안 나고 목록에서는 멀쩡해 보였다.**
 */
type Group = { id: string; name: string; sortOrder: number; active: boolean };

type Category = {
  id: string;
  name: string;
  groupId: string | null;
  sortOrder: number;
  active: boolean;
  /** 이 카테고리로 쌓인 글 수. 지우기를 막는 근거다. */
  postCount: number;
};

type Taxonomy = { groups: Group[]; categories: Category[]; ungrouped: string[] };

type GroupForm = { name: string; sortOrder: string; active: boolean };
type CategoryForm = GroupForm & { groupId: string | null };

const BLANK_GROUP: GroupForm = { name: '', sortOrder: '0', active: true };
const BLANK_CATEGORY: CategoryForm = { name: '', groupId: null, sortOrder: '0', active: true };

const GROUP_COLS: Col[] = [
  { key: 'name', label: '탭 이름', width: 160, grow: true },
  { key: 'categories', label: '카테고리', width: 90, align: 'right' },
  { key: 'order', label: '순서', width: 60, align: 'right' },
  { key: 'active', label: '노출', width: 70 },
  { key: 'edit', label: '', width: 60 },
  { key: 'delete', label: '', width: 60 },
];

const CATEGORY_COLS: Col[] = [
  { key: 'name', label: '카테고리', width: 140, grow: true },
  { key: 'group', label: '탭', width: 130 },
  { key: 'posts', label: '글', width: 70, align: 'right' },
  { key: 'order', label: '순서', width: 60, align: 'right' },
  { key: 'active', label: '노출', width: 70 },
  { key: 'edit', label: '', width: 60 },
  { key: 'delete', label: '', width: 60 },
];

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

export function WeddingFeedPanel() {
  const [data, setData] = useState<FeedData | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  /*
   * 글과 분류표를 **함께** 받는다. 따로 받으면 글 목록이 먼저 그려지고 카테고리
   * 고르는 칸이 뒤늦게 채워져, 그 사이에 「새 글」을 누르면 고를 것이 없는 칸이 뜬다.
   */
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([apiFetch('/v1/admin/wedding-feed'), apiFetch('/v1/admin/wedding-feed/taxonomy')])
      .then(([feed, tax]) => {
        if (cancelled) return;
        setData(feed as FeedData);
        setTaxonomy(tax as Taxonomy);
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
   * 쓰고 있었다 — 자동 작성을 화면에서 뺐다 되살리는 동안 드러났다. 빌린 상태는
   * 그 주인이 사라질 때까지 아무도 모른다.
   */
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  // ── 탭과 카테고리 ──
  const [editingGroup, setEditingGroup] = useState<Group | 'new' | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(BLANK_GROUP);
  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(BLANK_CATEGORY);
  const [taxonomySaving, setTaxonomySaving] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const posts = data?.posts ?? [];
  const groups = taxonomy?.groups ?? [];
  const categories = taxonomy?.categories ?? [];
  const activeCategories = categories.filter((c) => c.active);
  /**
   * 지금 폼의 카테고리가 고를 수 있는 값인가.
   *
   * 옛 글은 목록에 없는 값을 들고 있을 수 있다 — 목록이 생기기 전에 손으로 적었거나
   * 방금 꺼 둔 카테고리다. **그 값을 지우지 않고 보여주되 저장은 막는다.** 보여주는
   * 것은 무엇이 적혀 있었는지를 남기기 위해서고, 막는 것은 잘못된 값이 그대로 다시
   * 저장되지 않게 하기 위해서다.
   */
  const needsPick =
    editing !== null && !activeCategories.some((c) => c.name === form.categoryLabel);
  const groupName = (id: string | null) =>
    id === null ? '없음' : (groups.find((g) => g.id === id)?.name ?? '없음');
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

  function openGroup(group: Group | 'new') {
    setGroupForm(
      group === 'new'
        ? { ...BLANK_GROUP, sortOrder: String(groups.length + 1) }
        : { name: group.name, sortOrder: String(group.sortOrder), active: group.active }
    );
    setEditingGroup(group);
    setEditingCategory(null);
    setTaxonomyError(null);
  }

  function openCategory(category: Category | 'new') {
    setCategoryForm(
      category === 'new'
        ? { ...BLANK_CATEGORY, sortOrder: String(categories.length + 1) }
        : {
            name: category.name,
            groupId: category.groupId,
            sortOrder: String(category.sortOrder),
            active: category.active,
          }
    );
    setEditingCategory(category);
    setEditingGroup(null);
    setTaxonomyError(null);
  }

  /** 순서 칸은 글자로 받고 숫자로 보낸다. 비거나 깨진 값은 0이다. */
  const toOrder = (raw: string) => {
    const n = Number.parseInt(raw, 10);

    return Number.isNaN(n) ? 0 : n;
  };

  async function saveGroup() {
    if (!editingGroup) return;
    setTaxonomySaving(true);
    setTaxonomyError(null);
    try {
      const payload = {
        name: groupForm.name,
        sortOrder: toOrder(groupForm.sortOrder),
        active: groupForm.active,
      };
      const path =
        editingGroup === 'new'
          ? '/v1/admin/wedding-feed/groups'
          : `/v1/admin/wedding-feed/groups/${editingGroup.id}`;

      await apiFetch(path, {
        method: editingGroup === 'new' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
      setEditingGroup(null);
      reload();
    } catch (e) {
      setTaxonomyError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setTaxonomySaving(false);
    }
  }

  async function saveCategory() {
    if (!editingCategory) return;
    setTaxonomySaving(true);
    setTaxonomyError(null);
    try {
      const payload = {
        name: categoryForm.name,
        groupId: categoryForm.groupId,
        sortOrder: toOrder(categoryForm.sortOrder),
        active: categoryForm.active,
      };
      const path =
        editingCategory === 'new'
          ? '/v1/admin/wedding-feed/categories'
          : `/v1/admin/wedding-feed/categories/${editingCategory.id}`;

      await apiFetch(path, {
        method: editingCategory === 'new' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
      setEditingCategory(null);
      reload();
    } catch (e) {
      setTaxonomyError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setTaxonomySaving(false);
    }
  }

  /**
   * 켬·끔만 바로 바꾼다.
   *
   * **끄기는 지우기가 아니라서 되돌릴 수 있다** — 그래서 한 번 더 묻지 않는다.
   * 쌓인 글은 그대로 있고 다시 켜면 돌아온다.
   */
  async function toggleGroup(group: Group) {
    setActionMsg(null);
    try {
      await apiFetch(`/v1/admin/wedding-feed/groups/${group.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: group.name,
          sortOrder: group.sortOrder,
          active: !group.active,
        }),
      });
      reload();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : '변경 실패');
    }
  }

  async function toggleCategory(category: Category) {
    setActionMsg(null);
    try {
      await apiFetch(`/v1/admin/wedding-feed/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: category.name,
          groupId: category.groupId,
          sortOrder: category.sortOrder,
          active: !category.active,
        }),
      });
      reload();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : '변경 실패');
    }
  }

  async function commitDeleteGroup() {
    if (!deletingGroup) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/v1/admin/wedding-feed/groups/${deletingGroup.id}`, { method: 'DELETE' });
      setDeletingGroup(null);
      reload();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : '삭제 실패');
      setDeletingGroup(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  /**
   * 카테고리를 지운다.
   *
   * **글이 딸려 있으면 서버가 거절한다.** 지우면 그 글들이 어느 탭에도 안 뜨는데
   * 화면은 멀쩡해 보인다 — 이 기능이 없애려던 바로 그 상태다. 거절 문구를 그대로
   * 띄우고 끄기를 권한다.
   */
  async function commitDeleteCategory() {
    if (!deletingCategory) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/v1/admin/wedding-feed/categories/${deletingCategory.id}`, {
        method: 'DELETE',
      });
      setDeletingCategory(null);
      reload();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : '삭제 실패');
      setDeletingCategory(null);
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

  const groupRows: TableRow[] = groups.map((group) => ({
    key: group.id,
    cells: [
      { v: group.name, bold: true },
      { v: `${categories.filter((c) => c.groupId === group.id).length}개` },
      { v: String(group.sortOrder) },
      {
        v: group.active ? '켬' : '끔',
        kind: group.active ? 'ok' : 'dim',
        onPress: () => void toggleGroup(group),
      },
      { v: '수정', kind: 'brand', onPress: () => openGroup(group) },
      { v: '삭제', kind: 'bad', onPress: () => setDeletingGroup(group) },
    ],
  }));

  const categoryRows: TableRow[] = categories.map((category) => ({
    key: category.id,
    cells: [
      { v: category.name, bold: true },
      {
        v: groupName(category.groupId),
        badge: category.groupId === null && category.active ? 'warn' : undefined,
      },
      { v: `${category.postCount.toLocaleString('ko-KR')}편` },
      { v: String(category.sortOrder) },
      {
        v: category.active ? '켬' : '끔',
        kind: category.active ? 'ok' : 'dim',
        onPress: () => void toggleCategory(category),
      },
      { v: '수정', kind: 'brand', onPress: () => openCategory(category) },
      { v: '삭제', kind: 'bad', onPress: () => setDeletingCategory(category) },
    ],
  }));

  /*
   * 어느 탭에도 안 든 카테고리. **이것이 맨 위에 떠야 한다** — 그 카테고리의 글은
   * 「전체」에서만 보이고, 오류도 안 나고 목록에서는 멀쩡해 보여서 운영자가
   * 「왜 이 글이 탭에 안 뜨지」를 묻기 전까지 아무도 모른다.
   */
  const ungrouped = taxonomy?.ungrouped ?? [];

  const bannerTone = error ? 'bad' : ungrouped.length > 0 || draftCount > 0 ? 'warn' : 'ok';
  const bannerTitle = error
    ? '목록을 불러오지 못했어요'
    : ungrouped.length > 0
      ? `어느 탭에도 들지 않은 카테고리 ${ungrouped.length}개가 있어요`
      : draftCount > 0
        ? `검토를 기다리는 초안 ${draftCount}건이 있어요`
        : `공개 글 ${publishedCount}건이 돌고 있어요`;
  const bannerDetail = error
    ? error
    : ungrouped.length > 0
      ? `${ungrouped.join(' · ')} — 이 카테고리로 쓴 글은 「전체」에서만 보여요. 탭을 정해 주세요.`
      : `공개 ${publishedCount}건 · 초안 ${draftCount}건 · 목표 ${WEDDING_FEED_TARGET_PUBLISHED}건` +
        (data ? ` · 자동 작성이 쓸 수 있는 주제 ${data.remainingTopics}개 남음` : '');

  return (
    <Page
      embedded
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
          <StatusBanner tone={bannerTone} title={bannerTitle} detail={actionMsg ?? generateMsg ?? bannerDetail} />

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

            <Card
              title="탭과 카테고리"
              sub="피드 화면 위쪽 탭과 그 안에 드는 카테고리 — 앱은 여기 있는 것을 그린다"
              action={{ label: '+ 새 탭', onPress: () => openGroup('new'), kind: 'brand' }}
              full
            >
              <DataTable cols={GROUP_COLS} rows={groupRows} empty="등록된 탭이 없어요" />
            </Card>

            <Card
              title="카테고리"
              sub="글 작성에서 고르는 값. 끄면 고를 수 없고 쌓인 글은 그대로 남는다"
              action={{ label: '+ 새 카테고리', onPress: () => openCategory('new'), kind: 'brand' }}
              full
            >
              <DataTable
                cols={CATEGORY_COLS}
                rows={categoryRows}
                empty="등록된 카테고리가 없어요"
              />
            </Card>
          </CardGrid>

          {editingGroup ? (
            <Card title={editingGroup === 'new' ? '새 탭' : '탭 수정'} full>
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>탭 이름</Text>
                <TextInput
                  style={styles.input}
                  value={groupForm.name}
                  onChangeText={(v) => setGroupForm((f) => ({ ...f, name: v }))}
                  placeholder="준비·예산"
                  maxLength={WEDDING_FEED_TAXONOMY_LIMITS.groupName}
                />
                <Text style={styles.fieldLabel}>노출 순서</Text>
                <TextInput
                  style={styles.input}
                  value={groupForm.sortOrder}
                  onChangeText={(v) => setGroupForm((f) => ({ ...f, sortOrder: v }))}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldLabel}>노출</Text>
                <View style={styles.statusRow}>
                  <Pressable
                    onPress={() => setGroupForm((f) => ({ ...f, active: true }))}
                    style={[styles.statusChip, groupForm.active && styles.statusChipActive]}
                  >
                    <Text
                      style={[
                        styles.statusChipLabel,
                        groupForm.active && styles.statusChipLabelActive,
                      ]}
                    >
                      켬
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGroupForm((f) => ({ ...f, active: false }))}
                    style={[styles.statusChip, !groupForm.active && styles.statusChipActive]}
                  >
                    <Text
                      style={[
                        styles.statusChipLabel,
                        !groupForm.active && styles.statusChipLabelActive,
                      ]}
                    >
                      끔
                    </Text>
                  </Pressable>
                </View>

                {taxonomyError ? <Text style={styles.error}>{taxonomyError}</Text> : null}

                <View style={styles.formActions}>
                  <Pressable
                    style={styles.btnGhost}
                    onPress={() => setEditingGroup(null)}
                    disabled={taxonomySaving}
                  >
                    <Text style={styles.btnGhostLabel}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnPrimary, taxonomySaving && styles.btnDisabled]}
                    onPress={() => void saveGroup()}
                    disabled={taxonomySaving}
                  >
                    <Text style={styles.btnPrimaryLabel}>
                      {taxonomySaving ? '저장 중…' : '저장'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ) : null}

          {editingCategory ? (
            <Card
              title={editingCategory === 'new' ? '새 카테고리' : '카테고리 수정'}
              note={
                editingCategory !== 'new' && editingCategory.postCount > 0
                  ? `이름을 고치면 이 카테고리로 쓴 글 ${editingCategory.postCount.toLocaleString('ko-KR')}편의 카드 위 줄도 함께 바뀌어요.`
                  : undefined
              }
              full
            >
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>카테고리 이름</Text>
                <TextInput
                  style={styles.input}
                  value={categoryForm.name}
                  onChangeText={(v) => setCategoryForm((f) => ({ ...f, name: v }))}
                  placeholder="예산"
                  maxLength={WEDDING_FEED_TAXONOMY_LIMITS.categoryName}
                />

                <Text style={styles.fieldLabel}>어느 탭</Text>
                <View style={styles.pickRow}>
                  {groups.map((group) => (
                    <Pressable
                      key={group.id}
                      onPress={() => setCategoryForm((f) => ({ ...f, groupId: group.id }))}
                      style={[
                        styles.statusChip,
                        categoryForm.groupId === group.id && styles.statusChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipLabel,
                          categoryForm.groupId === group.id && styles.statusChipLabelActive,
                        ]}
                      >
                        {group.name}
                      </Text>
                    </Pressable>
                  ))}
                  {/*
                    탭 없이 두는 것을 «고를 수 있게» 한다. 막아 두면 탭을 지웠을 때
                    떨어져 나온 카테고리를 저장할 수 없게 되고, 그 상태를 되돌릴
                    자리가 사라진다. 고른 뒤에는 맨 위 경고줄에 뜬다.
                  */}
                  <Pressable
                    onPress={() => setCategoryForm((f) => ({ ...f, groupId: null }))}
                    style={[
                      styles.statusChip,
                      categoryForm.groupId === null && styles.statusChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipLabel,
                        categoryForm.groupId === null && styles.statusChipLabelActive,
                      ]}
                    >
                      정하지 않음
                    </Text>
                  </Pressable>
                </View>
                {categoryForm.groupId === null && categoryForm.active ? (
                  <Text style={styles.hint}>
                    탭을 정하지 않으면 이 카테고리로 쓴 글은 「{WEDDING_FEED_ALL_TAB.label}」에서만
                    보여요.
                  </Text>
                ) : null}

                <Text style={styles.fieldLabel}>노출 순서</Text>
                <TextInput
                  style={styles.input}
                  value={categoryForm.sortOrder}
                  onChangeText={(v) => setCategoryForm((f) => ({ ...f, sortOrder: v }))}
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>노출</Text>
                <View style={styles.statusRow}>
                  <Pressable
                    onPress={() => setCategoryForm((f) => ({ ...f, active: true }))}
                    style={[styles.statusChip, categoryForm.active && styles.statusChipActive]}
                  >
                    <Text
                      style={[
                        styles.statusChipLabel,
                        categoryForm.active && styles.statusChipLabelActive,
                      ]}
                    >
                      켬
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setCategoryForm((f) => ({ ...f, active: false }))}
                    style={[styles.statusChip, !categoryForm.active && styles.statusChipActive]}
                  >
                    <Text
                      style={[
                        styles.statusChipLabel,
                        !categoryForm.active && styles.statusChipLabelActive,
                      ]}
                    >
                      끔
                    </Text>
                  </Pressable>
                </View>

                {taxonomyError ? <Text style={styles.error}>{taxonomyError}</Text> : null}

                <View style={styles.formActions}>
                  <Pressable
                    style={styles.btnGhost}
                    onPress={() => setEditingCategory(null)}
                    disabled={taxonomySaving}
                  >
                    <Text style={styles.btnGhostLabel}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnPrimary, taxonomySaving && styles.btnDisabled]}
                    onPress={() => void saveCategory()}
                    disabled={taxonomySaving}
                  >
                    <Text style={styles.btnPrimaryLabel}>
                      {taxonomySaving ? '저장 중…' : '저장'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ) : null}

          {editing ? (
            <Card title={editing === 'new' ? '새 글 작성' : '글 수정'} full>
              <View style={styles.form}>
                {/*
                  **자유 입력이 아니라 고르기다**(2026-09-16 대표 지시).
                  전에는 `TextInput`이라 「웨딩홀 」(뒤 공백)이나 「스튜디오/드레스」를
                  적을 수 있었고, 그 글은 어느 탭에도 안 뜨는데 오류도 안 나고 화면도
                  멀쩡해서 알아챌 방법이 없었다. 목록에서 고르면 그 문제가 뿌리에서 없어진다.
                */}
                <Text style={styles.fieldLabel}>카테고리</Text>
                {activeCategories.length === 0 ? (
                  <Text style={styles.hint}>
                    고를 카테고리가 없어요. 위 「카테고리」에서 먼저 하나 만들어 주세요.
                  </Text>
                ) : (
                  <View style={styles.pickRow}>
                    {activeCategories.map((category) => (
                      <Pressable
                        key={category.id}
                        onPress={() =>
                          setForm((f) => ({ ...f, categoryLabel: category.name }))
                        }
                        style={[
                          styles.statusChip,
                          form.categoryLabel === category.name && styles.statusChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipLabel,
                            form.categoryLabel === category.name && styles.statusChipLabelActive,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {/*
                  **옛 글의 값이 목록에 없을 수 있다.** 목록이 생기기 전에 손으로 적은
                  값이거나 방금 꺼 둔 카테고리다. 지우지 않고 **그대로 보여준다** —
                  지우면 그 글에 무엇이 적혀 있었는지가 사라지고, 무엇이 잘못됐는지도
                  같이 사라진다. 대신 **저장하려면 골라야 한다**(아래 `needsPick`) —
                  보여주기만 하고 통과시키면 잘못된 값이 그대로 다시 저장된다.
                */}
                {needsPick ? (
                  <Text style={styles.hint}>
                    지금 값 「{form.categoryLabel.trim() === '' ? '(비어 있음)' : form.categoryLabel}
                    」은 목록에 없어요. 위에서 하나 골라 주세요.
                  </Text>
                ) : null}
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
                    style={[styles.btnPrimary, (saving || needsPick) && styles.btnDisabled]}
                    onPress={() => void save()}
                    disabled={saving || needsPick}
                  >
                    <Text style={styles.btnPrimaryLabel}>{saving ? '저장 중…' : '저장'}</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ) : null}

          {deletingGroup ? (
            <ConfirmCard
              title="이 탭을 지울까요?"
              body="탭만 사라져요. 딸린 카테고리와 글은 그대로 남지만 어느 탭에도 들지 않게 되어, 그 글은 「전체」에서만 보여요."
              items={[
                `탭 ${deletingGroup.name}`,
                `딸린 카테고리 ${categories.filter((c) => c.groupId === deletingGroup.id).length}개 → 탭 없음`,
                `글 ${categories
                  .filter((c) => c.groupId === deletingGroup.id)
                  .reduce((sum, c) => sum + c.postCount, 0)
                  .toLocaleString('ko-KR')}편 → 「전체」에서만 보임`,
              ]}
              cta={deleteBusy ? '지우는 중…' : '삭제'}
              danger
              onConfirm={() => void commitDeleteGroup()}
              onCancel={() => setDeletingGroup(null)}
            />
          ) : null}

          {/*
            **쓰는 카테고리는 지우지 못한다.** 지우면 그 글들이 어느 탭에도 안 뜨는데
            화면은 멀쩡해 보인다 — 이 기능이 없애려던 바로 그 상태다. 몇 편이 딸려
            있는지 보여주고, 지우는 대신 «끄기»를 권한다. 서버도 같은 것을 거절한다.
          */}
          {deletingCategory ? (
            deletingCategory.postCount > 0 ? (
              <ConfirmCard
                title="이 카테고리는 지울 수 없어요"
                body="이 카테고리로 쓴 글이 있어요. 지우면 그 글들이 어느 탭에도 뜨지 않아요. 글을 다른 카테고리로 옮기거나 지운 뒤에 다시 시도해 주세요. 당장 감추려면 「끔」으로 두세요."
                items={[
                  `카테고리 ${deletingCategory.name}`,
                  `딸린 글 ${deletingCategory.postCount.toLocaleString('ko-KR')}편`,
                  `지금 상태 ${deletingCategory.active ? '켬' : '끔'}`,
                ]}
                cta="끄기"
                onConfirm={() => {
                  const target = deletingCategory;

                  setDeletingCategory(null);
                  if (target.active) void toggleCategory(target);
                }}
                onCancel={() => setDeletingCategory(null)}
              />
            ) : (
              <ConfirmCard
                title="이 카테고리를 지울까요?"
                body="지우면 되돌릴 수 없어요. 딸린 글이 없어서 사라지는 글은 없어요."
                items={[
                  `카테고리 ${deletingCategory.name}`,
                  `탭 ${groupName(deletingCategory.groupId)}`,
                  '딸린 글 0편',
                ]}
                cta={deleteBusy ? '지우는 중…' : '삭제'}
                danger
                onConfirm={() => void commitDeleteCategory()}
                onCancel={() => setDeletingCategory(null)}
              />
            )
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

/** 옛 주소 — 「사이트·기록」의 웨딩피드 관리 탭으로 보낸다. */
export default function WeddingFeedRedirect() {
  return <Redirect href="/admin/faq?tab=wedding-feed" />;
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
  /** 고를 것이 많은 줄. 칸을 넘기면 다음 줄로 내려간다 — 카테고리는 계속 늘어난다. */
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  hint: { fontSize: FontSize.micro, color: C.textAssistive, lineHeight: LineHeight.t7 },
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
