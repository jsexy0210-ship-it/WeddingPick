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
 * 자동 루프는 `WEDDING_FEED_AUTOWRITE=true`일 때만 돈다. 관리자 응답이 수동 작성
 * 준비 여부와 예약 작성 상태를 따로 내려 화면이 둘을 같은 것으로 오해하지 않게 한다.
 *
 * 규칙과 한도는 `packages/domain/src/wedding-feed.ts` 한 곳에서만 온다 — 여기서
 * 값을 다시 적으면 화면과 서버가 다른 길이를 막게 된다.
 *
 * 사용자 홈에 바로 나가는 콘텐츠라 관리자 사이드바의 독립 메뉴에서 연다.
 *
 * **카테고리 목록은 앱과 하나다**(2026-09-26 대표 지적 — 「관리자 웨딩피드 카테고리와
 * 앱웹 카테고리와 정보가 전혀 다르다」). 전에는 여기서 탭·카테고리를 표로 고쳤는데
 * 그 탭을 그리는 앱 화면이 없었다 — 앱 라운지 「웨딩정보」는 정본 칩을 그린다. 이제
 * 고르는 목록과 칩은 domain `WEDDING_FEED_CATEGORIES` · `WEDDING_FEED_CHIPS`에서 오고,
 * 글마다 «앱 칩» 칸이 앱 라운지에서 어느 칩에 뜨는지를 앱과 같은 함수로 적는다.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  WEDDING_FEED_CATEGORIES,
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_SOURCE_LABEL,
  WEDDING_FEED_STATUSES,
  WEDDING_FEED_STATUS_LABEL,
  isWeddingFeedCategoryLabel,
  weddingFeedChipLabel,
  weddingFeedChipOf,
  withObject,
  type WeddingFeedStatus,
} from '@weddingpick/domain';
import { Colors, FontSize, LineHeight, Radius, Spacing } from '@weddingpick/ui';

import {
  ADMIN_IMAGE_TYPES,
  ADMIN_UPLOAD_MAX_BYTES,
  fitImageForUpload,
  readableAdminError,
} from '@/features/admin/fit-image-upload';
import { formatDateDot, formatDateTimeDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { WritePressable } from './_role';
import {
  Card,
  CardGrid,
  AdminFormModal,
  ConfirmCard,
  type Col,
  DataTable,
  LoadError,
  Page,
  Rows,
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
  bodyImageKey: string | null;
  bodyImageUrl: string | null;
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

type FeedData = {
  posts: Post[];
  runs: Run[];
  remainingTopics: number;
  nextSortOrder: number;
  automation: { manualReady: boolean; scheduledEnabled: boolean };
};

/**
 * 앱 라운지 「웨딩정보」에서 이 카테고리의 글이 어디에 뜨는가 — 앱 칩(`loungeFeedMatches`)과
 * 같은 domain 함수로 센다. 칩이 없는 카테고리는 «전체»에만, 목록 밖 이름도 «전체»에만 뜬다.
 */
function appChipText(categoryLabel: string): string {
  if (!isWeddingFeedCategoryLabel(categoryLabel)) return '전체만 · 목록 밖';
  const chip = weddingFeedChipOf(categoryLabel);

  return chip === null ? '전체만' : `${weddingFeedChipLabel(chip)} · 전체`;
}

const CATEGORY_COLS: Col[] = [
  { key: 'name', label: '카테고리', width: 140, grow: true },
  { key: 'chip', label: '앱 칩', width: 160 },
  { key: 'published', label: '공개 글', width: 90, align: 'right' },
  { key: 'total', label: '전체 글', width: 90, align: 'right' },
];

type AutoStep = 'text' | 'thumbnail' | 'body';

/** 「자동 작성」 진행 표시. `name`은 실패 문장에 들어간다(「…을/를 만들지 못했어요」). */
const AUTO_STEP_LABEL: Record<AutoStep, { order: number; progress: string; name: string }> = {
  text: { order: 1, progress: '글을 쓰는 중이에요', name: '글' },
  thumbnail: { order: 2, progress: '대표 썸네일을 만드는 중이에요', name: '대표 썸네일' },
  body: { order: 3, progress: '본문 이미지를 만드는 중이에요', name: '본문 이미지' },
};

type FormState = {
  categoryLabel: string;
  title: string;
  summary: string;
  body: string;
  imageKey: string | null;
  imageUrl: string | null;
  bodyImageKey: string | null;
  bodyImageUrl: string | null;
  generated: boolean;
  status: WeddingFeedStatus;
  sortOrder: string;
};

const BLANK_FORM: FormState = {
  categoryLabel: '',
  title: '',
  summary: '',
  body: '',
  imageKey: null,
  imageUrl: null,
  bodyImageKey: null,
  bodyImageUrl: null,
  generated: false,
  status: 'draft',
  sortOrder: '1',
};

function toForm(post: Post): FormState {
  return {
    categoryLabel: post.categoryLabel,
    title: post.title,
    summary: post.summary,
    body: post.body,
    imageKey: post.imageKey,
    imageUrl: post.imageUrl,
    bodyImageKey: post.bodyImageKey,
    bodyImageUrl: post.bodyImageUrl,
    generated: post.source === 'generated',
    status: post.status,
    sortOrder: String(post.sortOrder),
  };
}

const COLS: Col[] = [
  { key: 'status', label: '상태', width: 70 },
  { key: 'category', label: '카테고리', width: 100 },
  { key: 'chip', label: '앱 칩', width: 140 },
  { key: 'title', label: '제목', width: 320, grow: true },
  { key: 'source', label: '출처', width: 90 },
  { key: 'order', label: '순서', width: 60, align: 'right' },
  { key: 'published', label: '공개일', width: 110 },
  { key: 'updated', label: '수정일', width: 150 },
  { key: 'edit', label: '', width: 60 },
  { key: 'delete', label: '', width: 60 },
];

const STATUS_KIND: Record<WeddingFeedStatus, 'ok' | 'warn' | 'dim'> = {
  published: 'ok',
  draft: 'warn',
  archived: 'dim',
};

export function WeddingFeedPanel({ embedded = true }: { embedded?: boolean }) {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  /*
   * 글만 받는다. 카테고리 목록은 domain 상수라 기다릴 것이 없다 — 앱 칩과 같은 값이다.
   */
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/wedding-feed')
      .then((feed) => {
        if (cancelled) return;
        setData(feed as FeedData);
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

  /** 새 글 팝업 안에서만 쓰는 Gemini 초안과 이미지 업로드 상태. */
  const [draftGenerating, setDraftGenerating] = useState(false);
  /** 「자동 작성」이 지금 무엇을 만드는 중인가 — 글 → 대표 썸네일 → 본문 이미지. */
  const [autoStep, setAutoStep] = useState<AutoStep | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  /**
   * 이 팝업에서 받은 초안 제목. 다시 누르면 서버가 이것과도 다른 글을 쓴다 — 저장 전
   * 초안은 표에 없어서 서버가 모른다(2026-09-26 대표 지시 「중첩되지 않는 내용으로 생성한다」).
   */
  const draftTitles = useRef<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState<'thumbnail' | 'body' | null>(null);
  const [generatingImage, setGeneratingImage] = useState<'thumbnail' | 'body' | null>(null);
  const [previewing, setPreviewing] = useState(false);
  /** 늦게 끝난 Gemini/업로드가 새로 연 다른 폼을 덮지 못하게 편집 세션을 구분한다. */
  const formRevision = useRef(0);

  const posts = data?.posts ?? [];
  /**
   * 지금 폼의 카테고리가 고를 수 있는 값인가.
   *
   * 옛 글은 목록에 없는 값을 들고 있을 수 있다 — 목록이 생기기 전에 손으로 적었거나
   * 2026-09-16~26 사이 관리자 표에서 따로 만든 카테고리다. **그 값을 지우지 않고 보여주되 저장은 막는다.** 보여주는
   * 것은 무엇이 적혀 있었는지를 남기기 위해서고, 막는 것은 잘못된 값이 그대로 다시
   * 저장되지 않게 하기 위해서다.
   */
  const needsPick = editing !== null && !isWeddingFeedCategoryLabel(form.categoryLabel);

  function openNew() {
    formRevision.current += 1;
    draftTitles.current = [];
    setForm({ ...BLANK_FORM, sortOrder: String(data?.nextSortOrder ?? 1) });
    setEditing('new');
    setPreviewing(false);
    setSaveError(null);
    setDraftError(null);
  }

  function openEdit(post: Post) {
    formRevision.current += 1;
    draftTitles.current = [];
    setForm(toForm(post));
    setEditing(post);
    setPreviewing(false);
    setSaveError(null);
    setDraftError(null);
  }

  function closePostEditor() {
    formRevision.current += 1;
    setEditing(null);
    setPreviewing(false);
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
        imageKey: form.imageKey,
        bodyImageKey: form.bodyImageKey,
        generated: editing === 'new' ? form.generated : false,
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
      closePostEditor();
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

  /**
   * 「자동 작성」 — 글과 이미지를 한 번에 만든다(2026-09-26 대표 지시 「자동 작성 버튼 클릭 시
   * 내용과 이미지가 자동으로 생성되게 한다」).
   *
   * 글 → 대표 썸네일 → 본문 이미지 순서로 요청 셋을 잇는다. 한 요청에 몰면 운영 Nginx의
   * 60초 한도를 넘는다. 이미지는 방금 쓴 글을 보고 만들고, 서버가 같은 카테고리의 최근
   * 글 · 이미지와 겹치지 않게 만든다(`wedding-feed-generation.ts`).
   *
   * **저장은 하지 않는다.** 폼에 채워 두고 운영자가 읽고 고친 뒤 「저장」한다. 중간에
   * 실패하면 거기서 멈추고, 이미 채운 것과 원래 폼의 값은 그대로 둔다.
   */
  async function generateDraft() {
    setDraftError(null);

    if (!isWeddingFeedCategoryLabel(form.categoryLabel)) {
      setDraftError('카테고리를 먼저 선택해주세요.');
      return;
    }
    if (!data?.automation.manualReady) {
      setDraftError('Gemini 연결을 확인해주세요. 지금은 자동 작성을 사용할 수 없어요.');
      return;
    }

    const revision = formRevision.current;
    const requestedCategory = form.categoryLabel;
    const stale = () => formRevision.current !== revision;
    let step: AutoStep = 'text';
    setDraftGenerating(true);
    setAutoStep(step);
    try {
      const draft = (await apiFetch('/v1/admin/wedding-feed/draft', {
        method: 'POST',
        body: JSON.stringify({ categoryLabel: requestedCategory, avoidTitles: draftTitles.current.slice(-10) }),
      })) as { title: string; summary: string; body: string };

      if (stale()) return;
      draftTitles.current = [...draftTitles.current, draft.title];
      /*
       * 카테고리 칩은 자동 작성 중에 잠겨 있다(`disabled={draftGenerating}`). 그래도 늦게 온
       * 응답이 다른 카테고리 폼을 덮지 않게 한 번 더 본다.
       */
      setForm((current) =>
        current.categoryLabel === requestedCategory
          ? {
              ...current,
              title: draft.title,
              summary: draft.summary,
              body: draft.body,
              generated: true,
            }
          : current
      );

      for (const kind of ['thumbnail', 'body'] as const) {
        step = kind;
        setAutoStep(kind);
        const image = (await apiFetch('/v1/admin/wedding-feed/image/generate', {
          method: 'POST',
          body: JSON.stringify({
            kind,
            title: draft.title,
            summary: draft.summary,
            body: draft.body,
            categoryLabel: requestedCategory,
          }),
        })) as { storageKey: string; imageUrl: string };

        if (stale()) return;
        setForm((current) =>
          current.categoryLabel !== requestedCategory
            ? current
            : kind === 'thumbnail'
              ? { ...current, imageKey: image.storageKey, imageUrl: image.imageUrl }
              : { ...current, bodyImageKey: image.storageKey, bodyImageUrl: image.imageUrl }
        );
      }
    } catch (e) {
      if (!stale()) {
        const reason = readableAdminError(e, '잠시 후 다시 시도해주세요.');
        setDraftError(
          step === 'text'
            ? `자동 작성에 실패했어요. ${reason}`
            : `글은 채웠어요. ${withObject(AUTO_STEP_LABEL[step].name)} 만들지 못했어요 — ${reason} 「이미지 생성」으로 다시 만들 수 있어요.`
        );
      }
    } finally {
      setDraftGenerating(false);
      setAutoStep(null);
    }
  }

  /**
   * 관리자가 고른 그림을 올린다 — **같은 origin의 API로**(`PUT /v1/admin/wedding-feed/image/file`).
   *
   * 전에는 서명 URL로 저장소에 브라우저가 직접 `PUT`했는데, 운영 저장소(카카오 Object
   * Storage)가 그 요청을 CORS로 막는다(e66dec7e · `docs/deployment.md` 「파일 저장소」).
   * 1MB(운영 Nginx 기본 상한)를 넘으면 먼저 줄인다.
   */
  async function uploadFeedImage(kind: 'thumbnail' | 'body') {
    setDraftError(null);
    const revision = formRevision.current;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    const declared = (asset.mimeType ?? asset.file?.type ?? '').toLowerCase();

    if (!ADMIN_IMAGE_TYPES.has(declared)) {
      setDraftError('PNG · JPG · WebP 이미지만 올릴 수 있어요.');
      return;
    }

    setUploadingImage(kind);
    try {
      const original: Blob = asset.file ?? (await fetch(asset.uri).then((response) => response.blob()));
      const fitted = await fitImageForUpload(original, declared);

      if (fitted.blob.size > ADMIN_UPLOAD_MAX_BYTES) {
        throw new Error('이미지가 너무 커요. 1MB 안쪽으로 줄여 다시 골라주세요.');
      }

      const uploaded = (await apiFetch(`/v1/admin/wedding-feed/image/file?kind=${kind}`, {
        method: 'PUT',
        headers: { 'Content-Type': fitted.mimeType },
        body: fitted.blob,
      })) as { storageKey: string; imageUrl: string };
      if (formRevision.current !== revision) return;

      setForm((current) =>
        kind === 'thumbnail'
          ? { ...current, imageKey: uploaded.storageKey, imageUrl: uploaded.imageUrl }
          : { ...current, bodyImageKey: uploaded.storageKey, bodyImageUrl: uploaded.imageUrl }
      );
    } catch (e) {
      if (formRevision.current === revision) {
        setDraftError(readableAdminError(e, '이미지를 올리지 못했어요.'));
      }
    } finally {
      setUploadingImage(null);
    }
  }

  async function generateFeedImage(kind: 'thumbnail' | 'body') {
    setDraftError(null);
    if (!form.title.trim()) {
      setDraftError('이미지를 만들 제목을 먼저 입력해주세요.');
      return;
    }
    if (!data?.automation.manualReady) {
      setDraftError('Gemini 연결을 확인해주세요. 지금은 이미지를 만들 수 없어요.');
      return;
    }

    const revision = formRevision.current;
    setGeneratingImage(kind);
    try {
      const result = (await apiFetch('/v1/admin/wedding-feed/image/generate', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          title: form.title,
          summary: form.summary,
          body: form.body,
          ...(form.categoryLabel ? { categoryLabel: form.categoryLabel } : {}),
        }),
      })) as { storageKey: string; imageUrl: string };
      if (formRevision.current !== revision) return;
      setForm((current) => kind === 'thumbnail'
        ? { ...current, imageKey: result.storageKey, imageUrl: result.imageUrl }
        : { ...current, bodyImageKey: result.storageKey, bodyImageUrl: result.imageUrl });
    } catch (e) {
      if (formRevision.current === revision) {
        setDraftError(readableAdminError(e, '이미지를 만들지 못했어요.'));
      }
    } finally {
      setGeneratingImage(null);
    }
  }

  function clearFeedImage(kind: 'thumbnail' | 'body') {
    setForm((current) =>
      kind === 'thumbnail'
        ? { ...current, imageKey: null, imageUrl: null }
        : { ...current, bodyImageKey: null, bodyImageUrl: null }
    );
  }

  const rows: TableRow[] = posts.map((post) => ({
    key: post.id,
    cells: [
      { v: WEDDING_FEED_STATUS_LABEL[post.status], badge: STATUS_KIND[post.status] },
      { v: post.categoryLabel },
      {
        v:
          post.status === 'published'
            ? appChipText(post.categoryLabel)
            : isWeddingFeedCategoryLabel(post.categoryLabel)
              ? '안 보임'
              : '안 보임 · 목록 밖',
        badge: isWeddingFeedCategoryLabel(post.categoryLabel) ? undefined : 'warn',
      },
      { v: post.title, bold: true },
      { v: WEDDING_FEED_SOURCE_LABEL[post.source] },
      { v: String(post.sortOrder) },
      /* 앱 글 상세가 찍는 날짜와 같은 값·같은 꼴이다(`formatDateDot(publishedAt)`). */
      { v: post.publishedAt ? formatDateDot(post.publishedAt) : '—' },
      { v: formatDateTimeDot(post.updatedAt) },
      { v: '수정', kind: 'brand', write: true, onPress: () => openEdit(post) },
      { v: '삭제', kind: 'bad', write: true, onPress: () => setDeleting(post) },
    ],
  }));

  /*
   * 카테고리 표 — 고칠 수 없다. 목록과 칩 배정은 domain 상수(정본 my.js `cats`)라
   * 여기서 바꾸면 앱과 다시 갈라진다. 목록 밖 이름을 단 글이 있으면 끝에 따로 적는다.
   */
  const countOf = (label: string) => ({
    published: posts.filter((p) => p.categoryLabel === label && p.status === 'published').length,
    total: posts.filter((p) => p.categoryLabel === label).length,
  });
  const unlisted = [...new Set(posts.map((p) => p.categoryLabel))].filter(
    (label) => !isWeddingFeedCategoryLabel(label)
  );
  const categoryRows: TableRow[] = [
    ...WEDDING_FEED_CATEGORIES.map((category) => category.label),
    ...unlisted,
  ].map((label) => {
    const count = countOf(label);

    return {
      key: `category-${label}`,
      cells: [
        { v: label, bold: true },
        {
          v: appChipText(label),
          badge: isWeddingFeedCategoryLabel(label) ? undefined : ('warn' as const),
        },
        { v: `${count.published.toLocaleString('ko-KR')}편` },
        { v: `${count.total.toLocaleString('ko-KR')}편` },
      ],
    };
  });

  return (
    <Page
      embedded={embedded}
      title="웨딩피드 관리"
      sub="홈 아래쪽에 깔리는 읽을거리 — 새 글에서 카테고리를 고르면 Gemini가 초안을 채운다"
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <AdminFormModal
            visible={actionMsg !== null}
            title="처리 결과"
            onClose={() => setActionMsg(null)}
          >
            <Text style={styles.resultText}>{actionMsg}</Text>
          </AdminFormModal>

          <CardGrid>
            <Card title="글 목록" sub="등록 · 수정 · 삭제는 직접 한다" action={{ label: '+ 새 글', write: true, onPress: openNew, kind: 'brand' }} full>
              <DataTable cols={COLS} rows={rows} empty="등록된 글이 없어요" />
            </Card>

            <Card
              title="자동 작성 기록"
              sub={`${data.automation.manualReady ? '새 글 자동 작성 가능' : '서버 설정 필요'} · ${
                data.automation.scheduledEnabled ? '예약 작성 켜짐' : '예약 작성 꺼짐'
              } · 남은 주제 ${data.remainingTopics}개`}
              full
            >
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
              title="카테고리와 앱 칩"
              sub="글 작성에서 고르는 값과 앱 라운지 칩. 정본 칩이라 여기서 바꾸지 않는다"
              full
            >
              <DataTable cols={CATEGORY_COLS} rows={categoryRows} empty="등록된 카테고리가 없어요" />
            </Card>
          </CardGrid>

          <AdminFormModal
            visible={editing !== null && !previewing}
            title={editing === 'new' ? '새 글 작성' : '글 수정'}
            onClose={closePostEditor}
          >
            {editing ? (
              <View style={styles.form}>
                {/*
                  **자유 입력이 아니라 고르기다**(2026-09-16 대표 지시).
                  전에는 `TextInput`이라 「웨딩홀 」(뒤 공백)이나 「스튜디오/드레스」를
                  적을 수 있었고, 그 글은 어느 탭에도 안 뜨는데 오류도 안 나고 화면도
                  멀쩡해서 알아챌 방법이 없었다. 목록에서 고르면 그 문제가 뿌리에서 없어진다.
                */}
                <Text style={styles.fieldLabel}>카테고리</Text>
                <View style={styles.pickRow}>
                  {WEDDING_FEED_CATEGORIES.map((category) => (
                    <Pressable
                      key={category.key}
                      accessibilityRole="button"
                      accessibilityLabel={`카테고리 ${category.label}`}
                      accessibilityState={{ selected: form.categoryLabel === category.label, disabled: draftGenerating }}
                      disabled={draftGenerating}
                      onPress={() => {
                        setForm((f) => ({ ...f, categoryLabel: category.label }));
                        setDraftError(null);
                      }}
                      style={[
                        styles.statusChip,
                        form.categoryLabel === category.label && styles.statusChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipLabel,
                          form.categoryLabel === category.label && styles.statusChipLabelActive,
                        ]}
                      >
                        {category.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {!needsPick ? (
                  <Text style={styles.hint}>앱 라운지 칩: {appChipText(form.categoryLabel)}</Text>
                ) : null}
                {/*
                  **옛 글의 값이 목록에 없을 수 있다.** 목록이 생기기 전에 손으로 적은
                  값이거나 방금 꺼 둔 카테고리다. 지우지 않고 **그대로 보여준다** —
                  지우면 그 글에 무엇이 적혀 있었는지가 사라지고, 무엇이 잘못됐는지도
                  같이 사라진다. 대신 **저장하려면 골라야 한다**(아래 `needsPick`) —
                  보여주기만 하고 통과시키면 잘못된 값이 그대로 다시 저장된다.
                */}
                {needsPick && editing !== 'new' ? (
                  <Text style={styles.hint}>
                    지금 값 「{form.categoryLabel.trim() === '' ? '(비어 있음)' : form.categoryLabel}
                    」은 목록에 없어요. 위에서 하나 골라 주세요.
                  </Text>
                ) : null}

                {editing === 'new' ? (
                  <View style={styles.inlineActions}>
                    <WritePressable
                      accessibilityRole="button"
                      accessibilityLabel="글과 이미지 자동 작성"
                      style={[styles.btnPrimary, draftGenerating && styles.btnDisabled]}
                      onPress={() => void generateDraft()}
                      disabled={draftGenerating || uploadingImage !== null || generatingImage !== null}
                    >
                      {draftGenerating ? (
                        <ActivityIndicator color={C.onTint} />
                      ) : (
                        <Text style={styles.btnPrimaryLabel}>자동 작성</Text>
                      )}
                    </WritePressable>
                    <Text style={styles.hint} accessibilityLiveRegion="polite">
                      {autoStep
                        ? `${AUTO_STEP_LABEL[autoStep].progress} (${AUTO_STEP_LABEL[autoStep].order}/3)`
                        : '선택한 카테고리로 글과 썸네일 · 본문 이미지를 한 번에 채워요. 이전 글 · 이미지와 겹치지 않게 만들어요.'}
                    </Text>
                  </View>
                ) : null}
                {draftError ? <Text style={styles.error}>{draftError}</Text> : null}

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
                <Text style={styles.fieldLabel}>대표 썸네일</Text>
                <View style={styles.imageField}>
                  {form.imageUrl ? (
                    <Image source={{ uri: form.imageUrl }} style={styles.thumbnailPreview} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbnailPreview, styles.imageEmpty]}>
                      <Text style={styles.imageEmptyText}>등록된 썸네일 없음</Text>
                    </View>
                  )}
                  <View style={styles.inlineActions}>
                    <WritePressable
                      style={styles.btnGhost}
                      onPress={() => void uploadFeedImage('thumbnail')}
                      disabled={draftGenerating || uploadingImage !== null || generatingImage !== null}
                    >
                      {uploadingImage === 'thumbnail' ? (
                        <ActivityIndicator />
                      ) : (
                        <Text style={styles.btnGhostLabel}>{form.imageKey ? '썸네일 교체' : '썸네일 올리기'}</Text>
                      )}
                    </WritePressable>
                    <WritePressable
                      style={styles.btnGhost}
                      onPress={() => void generateFeedImage('thumbnail')}
                      disabled={draftGenerating || uploadingImage !== null || generatingImage !== null}
                    >
                      {generatingImage === 'thumbnail' ? <ActivityIndicator /> :
                        <Text style={styles.btnGhostLabel}>이미지 생성</Text>}
                    </WritePressable>
                    {form.imageKey ? (
                      <Pressable style={styles.btnGhost} onPress={() => clearFeedImage('thumbnail')} disabled={draftGenerating || uploadingImage !== null || generatingImage !== null}>
                        <Text style={styles.btnGhostLabel}>삭제</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

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

                <Text style={styles.fieldLabel}>본문 이미지</Text>
                <View style={styles.imageField}>
                  {form.bodyImageUrl ? (
                    <Image source={{ uri: form.bodyImageUrl }} style={styles.bodyImagePreview} resizeMode="cover" />
                  ) : (
                    <View style={[styles.bodyImagePreview, styles.imageEmpty]}>
                      <Text style={styles.imageEmptyText}>등록된 본문 이미지 없음</Text>
                    </View>
                  )}
                  <View style={styles.inlineActions}>
                    <WritePressable
                      style={styles.btnGhost}
                      onPress={() => void uploadFeedImage('body')}
                      disabled={draftGenerating || uploadingImage !== null || generatingImage !== null}
                    >
                      {uploadingImage === 'body' ? (
                        <ActivityIndicator />
                      ) : (
                        <Text style={styles.btnGhostLabel}>{form.bodyImageKey ? '본문 이미지 교체' : '본문 이미지 올리기'}</Text>
                      )}
                    </WritePressable>
                    <WritePressable
                      style={styles.btnGhost}
                      onPress={() => void generateFeedImage('body')}
                      disabled={draftGenerating || uploadingImage !== null || generatingImage !== null}
                    >
                      {generatingImage === 'body' ? <ActivityIndicator /> :
                        <Text style={styles.btnGhostLabel}>이미지 생성</Text>}
                    </WritePressable>
                    {form.bodyImageKey ? (
                      <Pressable style={styles.btnGhost} onPress={() => clearFeedImage('body')} disabled={draftGenerating || uploadingImage !== null || generatingImage !== null}>
                        <Text style={styles.btnGhostLabel}>삭제</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.fieldLabel}>노출 순서</Text>
                <TextInput
                  style={styles.input}
                  value={form.sortOrder}
                  onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
                  keyboardType="numeric"
                  editable={editing !== 'new'}
                />
                {editing === 'new' ? (
                  <Text style={styles.hint}>
                    현재 마지막 번호 다음 값이에요. 저장할 때 서버가 최신 번호를 다시 확인해 확정해요.
                  </Text>
                ) : null}
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
                  <Pressable
                    style={styles.btnGhost}
                    onPress={() => setPreviewing(true)}
                    disabled={saving}
                  >
                    <Text style={styles.btnGhostLabel}>미리보기</Text>
                  </Pressable>
                  <Pressable style={styles.btnGhost} onPress={closePostEditor} disabled={saving}>
                    <Text style={styles.btnGhostLabel}>취소</Text>
                  </Pressable>
                  <WritePressable
                    style={[styles.btnPrimary, (saving || needsPick) && styles.btnDisabled]}
                    onPress={() => void save()}
                    disabled={saving || needsPick}
                  >
                    <Text style={styles.btnPrimaryLabel}>{saving ? '저장 중…' : '저장'}</Text>
                  </WritePressable>
                </View>
              </View>
            ) : null}
          </AdminFormModal>

          <AdminFormModal
            visible={editing !== null && previewing}
            title="콘텐츠 미리보기"
            onClose={() => setPreviewing(false)}
          >
            {editing ? (
              <View style={styles.previewPhone}>
                {form.imageUrl ? (
                  <Image source={{ uri: form.imageUrl }} style={styles.previewHero} resizeMode="cover" />
                ) : (
                  <View style={[styles.previewHero, styles.imageEmpty]}>
                    <Text style={styles.imageEmptyText}>대표 썸네일</Text>
                  </View>
                )}
                <View style={styles.previewContent}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>
                      {form.categoryLabel || '카테고리'}
                    </Text>
                  </View>
                  <Text style={styles.previewTitle}>{form.title || '제목이 여기에 표시돼요.'}</Text>
                  {form.summary ? <Text style={styles.previewSummary}>{form.summary}</Text> : null}
                  {form.bodyImageUrl ? (
                    <Image source={{ uri: form.bodyImageUrl }} style={styles.previewBodyImage} resizeMode="cover" />
                  ) : null}
                  <Text style={styles.previewBody}>{form.body || '본문이 여기에 표시돼요.'}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.formActions}>
              <Pressable style={styles.btnGhost} onPress={() => setPreviewing(false)}>
                <Text style={styles.btnGhostLabel}>편집으로 돌아가기</Text>
              </Pressable>
            </View>
          </AdminFormModal>

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

export default function WeddingFeedScreen() {
  return <WeddingFeedPanel embedded={false} />;
}

const C = Colors.light;

const styles = StyleSheet.create({
  emptyRuns: { fontSize: FontSize.micro, color: C.textAssistive },
  resultText: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, color: C.text },
  form: { gap: Spacing.two },
  inlineActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  imageField: { gap: Spacing.two },
  thumbnailPreview: { width: '100%', height: 180, borderRadius: Radius.control, overflow: 'hidden' },
  bodyImagePreview: { width: '100%', height: 220, borderRadius: Radius.control, overflow: 'hidden' },
  imageEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.backgroundSelected },
  imageEmptyText: { fontSize: FontSize.tab, color: C.textAssistive },
  previewPhone: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: C.fieldBorder,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: C.background,
  },
  previewHero: { width: '100%', height: 210 },
  previewContent: { padding: Spacing.four, gap: Spacing.three },
  previewBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.control,
    backgroundColor: C.backgroundSelected,
  },
  previewBadgeText: { fontSize: FontSize.micro, fontWeight: '700', color: C.tint },
  previewTitle: { fontSize: FontSize.t3, lineHeight: LineHeight.t3, fontWeight: '700', color: C.text },
  previewSummary: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, color: C.textSecondary },
  previewBodyImage: { width: '100%', height: 190, borderRadius: Radius.control },
  previewBody: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, color: C.text },
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
