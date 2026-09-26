import { Redirect } from 'expo-router';
/**
 * 링크 미리보기(OG 카드) 관리.
 * 설정 저장과 정적 사이트 반영은 별개다. 이 화면에서는 배포를 요청하지 않는다.
 *
 * 세 벌을 따로 관리한다(2026-09-25 대표 지시 · 0436) — 앱용 · 초대용 · 웹사이트용.
 * 관리자 정본(`docs/design/html/웨딩픽 관리자*.dc.html`)에 이 화면이 없어 기존 구조를
 * 그대로 두고 맨 위에 벌을 고르는 칸만 더했다.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';

import {
  FontSize,
  LineHeight,
  MARK_CHECK_PATH,
  MARK_HEART_PATH,
  MARK_STROKE,
  MARK_VIEWBOX,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { WritePressable } from './_role';
import { AdminFormModal } from './_ui';

type Kind = 'app' | 'invite' | 'website';

/** 벌마다 카드가 실리는 주소와 반영되는 빌드. */
const KINDS: readonly { key: Kind; label: string; path: string; lead: string }[] = [
  {
    key: 'app',
    label: '앱용',
    path: '',
    lead: '앱 주소(로그인 · 앱 화면 링크)를 붙이면 뜨는 카드예요. 앱 화면 배포 때 함께 반영돼요.',
  },
  {
    key: 'invite',
    label: '초대용',
    path: '/invite',
    lead: '「카카오로 초대하기」가 보내는 초대 안내 주소의 카드예요. 초대 코드는 카드에 담기지 않아요. 앱 화면 배포 때 함께 반영돼요.',
  },
  {
    key: 'website',
    label: '웹사이트용',
    path: '/website.html',
    lead: '웹사이트(소개 · 하위 페이지) 주소를 붙이면 뜨는 카드예요. 웹사이트 배포 때 반영돼요.',
  },
];

type Meta = {
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
};

type AdminView = {
  effective: Meta;
  defaults: Meta;
  overrides: Partial<Record<keyof Meta, string | null>>;
  updatedAt: string | null;
  publishRequestedAt: string | null;
  liveOgTitle: string | null;
  /** 지금 카드 그림의 출처. 올린 그림 · 적어 둔 주소 · 기본 그림. */
  ogImageSource: 'upload' | 'url' | 'default';
};

type Field = { key: keyof Meta; label: string; hint: string; multiline?: boolean };

const FIELDS: Field[] = [
  { key: 'ogTitle', label: '제목', hint: '카드에서 가장 크게 보여요. 40자 안쪽이 잘리지 않아요.' },
  {
    key: 'ogDescription',
    label: '설명',
    hint: '제목 아래 두 줄. 80자를 넘으면 뒤가 잘려요.',
    multiline: true,
  },
  {
    key: 'ogImageUrl',
    label: '그림 주소',
    hint: '다른 곳에 올려 둔 그림을 쓸 때만 적어요. 적으면 올린 그림 대신 이 주소를 써요.',
  },
  { key: 'ogImageAlt', label: '그림 설명', hint: '그림을 못 보는 사람에게 읽히는 글이에요.' },
];

function formatWhen(value: string | null): string {
  if (!value) return '없음';

  const at = new Date(value);

  return `${at.getFullYear()}. ${at.getMonth() + 1}. ${at.getDate()}. ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** 서버가 받는 그림 형식(`apps/api/src/routes/site-meta.ts` `OG_IMAGE_TYPES`와 같다). */
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * 한 장을 이 크기 안으로 보낸다. 운영 Nginx의 요청 본문 기본 상한이 1MB라서, 그보다
 * 크면 서버에 닿기도 전에 막힌다. 1200×630 카드 그림은 JPG로 이 안에 충분히 들어간다.
 */
export const OG_UPLOAD_MAX_BYTES = 950 * 1024;

/** 카드 그림 너비. 이보다 넓은 그림은 줄여서 보낸다. */
const OG_IMAGE_WIDTH = 1200;

export type PendingImage = { blob: Blob; mimeType: string; previewUri: string };

/**
 * 너무 큰 그림을 웹에서 줄인다 — 너비 1200 · JPG. 줄여도 크면 그대로 돌려주고,
 * 크기 판정은 부르는 쪽이 한다.
 */
async function fitForUpload(blob: Blob, mimeType: string): Promise<{ blob: Blob; mimeType: string }> {
  if (blob.size <= OG_UPLOAD_MAX_BYTES) return { blob, mimeType };
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { blob, mimeType };
  }

  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, OG_IMAGE_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return { blob, mimeType };
  /* JPG에는 투명이 없다 — 투명한 자리가 검게 나가지 않게 흰 바탕을 먼저 깐다. */
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (out && out.size <= OG_UPLOAD_MAX_BYTES) return { blob: out, mimeType: 'image/jpeg' };
  }

  return { blob, mimeType };
}

/**
 * 화면에 적을 오류 문장. 브라우저가 던지는 영문(`Failed to fetch`)과 상태 코드만 든
 * 기본 문장(`API … → 413`)은 그대로 보여주지 않는다 — 운영자가 무엇을 해야 할지 모른다.
 */
function readableError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) return '서버에 닿지 못했어요. 연결을 확인하고 다시 저장해주세요.';
  /* 요청 본문 상한(운영 Nginx 기본 1MB · 서버 `OG_IMAGE_MAX_BYTES`)에 걸렸다. 본문이 HTML이라 문장이 없다. */
  if (error instanceof Error && / → 413$/.test(error.message)) {
    return '그림이 너무 커요. 1MB 안쪽으로 줄여 다시 골라주세요.';
  }
  if (error instanceof Error && error.message && !/^API \//.test(error.message)) return error.message;
  return fallback;
}

/**
 * 기본 카드 그림 — 정본 `docs/design/React_Native/OG카드.svg`(2026-09-26 대표님 업로드).
 * 1200×630 · 코랄 `#FF6F61` 바탕 · 흰 Pick Mark(확정 두 path)를 x456 · y160에 한 변 288로 얹는다.
 * 숫자를 바꾸지 않는다 — 정본 SVG의 좌표를 그대로 옮긴 것이다.
 */
export const OG_CARD = {
  width: 1200,
  height: 630,
  background: '#FF6F61',
  mark: '#FFFFFF',
  markX: 456,
  markY: 160,
  markSize: 288,
} as const;

/**
 * 올린 그림도 적어 둔 주소도 없을 때 미리보기에 그리는 그림. 예전에는 코랄 칸에 「기본 그림」
 * 글자만 있어서 정본 카드(마크만 있는 코랄 카드)와 달랐다.
 */
function DefaultCardImage() {
  const scale = OG_CARD.markSize / MARK_VIEWBOX;
  const stroke = {
    stroke: OG_CARD.mark,
    strokeWidth: MARK_STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${OG_CARD.width} ${OG_CARD.height}`}>
      <Rect x={0} y={0} width={OG_CARD.width} height={OG_CARD.height} fill={OG_CARD.background} />
      <G transform={`translate(${OG_CARD.markX} ${OG_CARD.markY}) scale(${scale})`}>
        <Path d={MARK_HEART_PATH} {...stroke} />
        <Path d={MARK_CHECK_PATH} {...stroke} />
      </G>
    </Svg>
  );
}

function draftFrom(view: AdminView): Record<string, string> {
  return {
    ogTitle: view.overrides.ogTitle ?? '',
    ogDescription: view.overrides.ogDescription ?? '',
    ogImageUrl: view.overrides.ogImageUrl ?? '',
    ogImageAlt: view.overrides.ogImageAlt ?? '',
  };
}

export function OgCardPanel() {
  const [kind, setKind] = useState<Kind>('app');
  const [data, setData] = useState<AdminView | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 화면(모달 밖)에 남기는 결과 한 줄. 저장이 끝나 모달을 닫은 뒤에 보인다. */
  const [notice, setNotice] = useState<string | null>(null);
  /** 모달 안의 안내 · 오류. 실패하면 모달을 닫지 않고 여기에 적는다. */
  const [modalMessage, setModalMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  /** 골라 두었지만 아직 올리지 않은 그림. 「저장」을 눌러야 올라간다. */
  const [pending, setPending] = useState<PendingImage | null>(null);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setNotice(null);
    apiFetch(`/v1/admin/site-meta?kind=${kind}`)
      .then((value) => {
        if (cancelled) return;
        const view = value as AdminView;
        setData(view);
        setDraft(draftFrom(view));
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
  }, [kind]);

  /** 칸이 비어 있으면 기본값이 무엇인지 보여준다. 저장하면 그 값이 다시 이긴다. */
  function shown(key: keyof Meta): string {
    const typed = draft[key]?.trim();

    if (typed) return typed;

    return data?.defaults[key] ?? '';
  }

  function openEditor(): void {
    if (data) setDraft(draftFrom(data));
    setPending(null);
    setModalMessage(null);
    setNotice(null);
    setEditing(true);
  }

  /** 닫으면 저장하지 않은 것은 버린다 — 바깥 미리보기가 저장 안 된 값을 그리지 않게. */
  function closeEditor(): void {
    if (saving) return;
    if (data) setDraft(draftFrom(data));
    setPending(null);
    setModalMessage(null);
    setEditing(false);
  }

  /**
   * 그림을 고른다. **여기서는 올리지 않는다** — 「저장」이 올리고, 저장하고, 모달을 닫는다.
   * 고른 그림은 모달 안에서 바로 보여준다.
   */
  async function pickImage(): Promise<void> {
    setModalMessage(null);

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    const declared = (asset.mimeType ?? asset.file?.type ?? '').toLowerCase();

    if (!IMAGE_TYPES.has(declared)) {
      setModalMessage({ tone: 'error', text: 'PNG · JPG · WebP 그림만 올릴 수 있어요.' });
      return;
    }

    try {
      const original: Blob = asset.file ?? (await fetch(asset.uri).then((response) => response.blob()));
      const fitted = await fitForUpload(original, declared);

      if (fitted.blob.size > OG_UPLOAD_MAX_BYTES) {
        setModalMessage({ tone: 'error', text: '그림이 너무 커요. 1MB 안쪽으로 줄여 다시 골라주세요.' });
        return;
      }

      setPending({ blob: fitted.blob, mimeType: fitted.mimeType, previewUri: asset.uri });
      /* 그림의 출처는 하나뿐이다 — 고른 그림을 쓰려면 적어 둔 주소를 비운다(서버 `save()`와 같은 규칙). */
      setDraft((prev) => ({ ...prev, ogImageUrl: '' }));
      setModalMessage({ tone: 'info', text: '고른 그림은 「저장」을 누르면 올라가요.' });
    } catch {
      setModalMessage({ tone: 'error', text: '그림을 읽지 못했어요. 다른 파일로 다시 골라주세요.' });
    }
  }

  async function removeImage(): Promise<void> {
    setModalMessage(null);
    setRemoving(true);
    try {
      const saved = (await apiFetch(`/v1/admin/site-meta/og-image?kind=${kind}`, {
        method: 'DELETE',
      })) as AdminView;

      setData(saved);
      setModalMessage({ tone: 'info', text: '올린 그림을 치웠어요. 기본 그림으로 돌아가요.' });
    } catch (e: unknown) {
      setModalMessage({ tone: 'error', text: readableError(e, '그림을 치우지 못했어요.') });
    } finally {
      setRemoving(false);
    }
  }

  /**
   * 저장 = 고른 그림 올리기 → 문구 저장 → 다시 읽기 → 모달 닫기.
   *
   * 그림은 같은 origin의 API로 보낸다(`PUT /v1/admin/site-meta/og-image/file`). 예전에는
   * 서명 URL로 저장소에 바로 올렸는데, 운영 저장소가 브라우저의 그 요청을 CORS로 막아
   * `Failed to fetch`로 끝났다. 실패하면 모달을 닫지 않고 무엇이 안 됐는지 적는다.
   */
  async function save(): Promise<void> {
    setSaving(true);
    setModalMessage(null);
    setNotice(null);
    let uploaded = false;
    try {
      let body = draft;

      if (pending) {
        let attached: AdminView;
        try {
          attached = (await apiFetch(`/v1/admin/site-meta/og-image/file?kind=${kind}`, {
            method: 'PUT',
            headers: { 'Content-Type': pending.mimeType },
            body: pending.blob,
          })) as AdminView;
        } catch (e: unknown) {
          throw new Error(readableError(e, '그림을 올리지 못했어요. 다시 저장해주세요.'));
        }
        /*
         * 올라갔다. 서버가 이미 이 그림을 카드 그림으로 삼았으니 바깥 미리보기도 바로 바꾼다 —
         * 뒤의 문구 저장이 실패해도 화면이 서버와 어긋나지 않게. 다시 누르더라도 같은 그림을
         * 두 번 올리지 않는다.
         */
        uploaded = true;
        setData(attached);
        setPending(null);
        body = { ...draft, ogImageUrl: '' };
      }

      let view: AdminView;
      try {
        view = (await apiFetch(`/v1/admin/site-meta?kind=${kind}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })) as AdminView;
      } catch (e: unknown) {
        /* 그림은 이미 저장됐다. 무엇이 되고 무엇이 안 됐는지를 나눠 적는다. */
        if (uploaded) throw new Error(`그림은 올렸어요. ${readableError(e, '문구를 저장하지 못했어요. 다시 저장해주세요.')}`);
        throw e;
      }

      /* 저장한 것을 다시 읽어 그린다 — 화면이 보여주는 그림이 서버가 실제로 가진 그림이게. */
      try {
        view = (await apiFetch(`/v1/admin/site-meta?kind=${kind}`)) as AdminView;
      } catch {
        /* 다시 읽기만 실패했다. 저장 응답도 서버가 준 값이니 그것으로 그린다. */
      }

      setData(view);
      setDraft(draftFrom(view));
      setEditing(false);
      setNotice('저장했어요. 사이트에는 별도 배포 후 반영돼요.');
    } catch (e: unknown) {
      setModalMessage({ tone: 'error', text: readableError(e, '저장하지 못했어요. 다시 시도해주세요.') });
    } finally {
      setSaving(false);
    }
  }

  const current = KINDS.find((item) => item.key === kind) ?? KINDS[0]!;
  const kindTabs = (
    <View style={styles.kindRow} accessibilityRole="tablist">
      {KINDS.map((item) => {
        const selected = item.key === kind;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => setKind(item.key)}
            disabled={saving || removing}
            style={[styles.kindBtn, selected && styles.kindBtnActive]}
          >
            <Text style={[styles.kindBtnText, selected && styles.kindBtnTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>링크 미리보기</Text>
        {kindTabs}
        <DelayedLoader active size={40} style={styles.centered} />
      </ScrollView>
    );
  }
  if (error) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>링크 미리보기</Text>
        {kindTabs}
        <Text style={styles.error}>{error}</Text>
      </ScrollView>
    );
  }
  if (!data) return null;

  const live = data.liveOgTitle;
  const matched = live !== null && live === shown('ogTitle');
  /*
   * 미리보기가 실제로 받아 그리는 주소. 초안에 적어 둔 주소가 있으면 그것을 먼저
   * 보여준다 — 저장 전에도 맞는 그림인지 눈으로 확인할 수 있게.
   */
  const imageUrl = draft['ogImageUrl']?.trim() || data.effective.ogImageUrl;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>링크 미리보기</Text>
      {kindTabs}
      <Text style={styles.lead}>
        {current.lead} 설정은 저장할 수 있고, 사이트에는 별도 배포 후 반영돼요.
      </Text>
      <View style={styles.actions}>
        <WritePressable style={[styles.button, styles.buttonPrimary]} onPress={openEditor}>
          <Text style={styles.buttonPrimaryText}>{`${current.label} 미리보기 수정`}</Text>
        </WritePressable>
      </View>
      {notice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>미리보기</Text>
          <View style={styles.preview}>
            {/*
              * **그림을 글자로 대신하지 않는다.** 예전에는 「올린 그림」이라고만 적혀
              * 있어서, 주소를 잘못 넣었거나 파일이 덜 올라간 것을 여기서는 알 수
              * 없었다 — 카카오톡에 붙여 보고서야 알았다.
              */}
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.previewImage} accessible accessibilityRole="image" accessibilityLabel="기본 그림">
                <DefaultCardImage />
              </View>
            )}
            <View style={styles.previewBody}>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {shown('ogTitle')}
              </Text>
              <Text style={styles.previewDesc} numberOfLines={2}>
                {shown('ogDescription')}
              </Text>
              <Text style={styles.previewHost}>{`210.109.82.212${current.path}`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>지금 사이트에 나간 제목</Text>
          {live === null ? (
            <>
              <Text style={styles.stateUnknown}>확인하지 못했어요</Text>
              <Text style={styles.stateHint}>
                사이트가 응답하지 않았어요. 바뀌지 않았다는 뜻은 아니에요 — 잠시 뒤 새로고침해주세요.
              </Text>
            </>
          ) : (
            <>
              <Text style={matched ? styles.stateOk : styles.statePending}>{live}</Text>
              <Text style={styles.stateHint}>
                {matched ? '지금 저장된 제목과 같아요.' : '저장한 제목과 달라요. 사이트 배포 후 다시 확인해주세요.'}
              </Text>
            </>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>마지막 저장 {formatWhen(data.updatedAt)}</Text>
            <Text style={styles.metaText}>이전 반영 요청 {formatWhen(data.publishRequestedAt)}</Text>
          </View>
        </View>
      </View>

      <AdminFormModal visible={editing} title={`${current.label} 미리보기 수정`} onClose={closeEditor}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>카드 그림</Text>
          {pending ? (
            <Image
              source={{ uri: pending.previewUri }}
              style={styles.pendingImage}
              resizeMode="cover"
              accessibilityLabel="고른 카드 그림"
            />
          ) : null}
          <View style={styles.imageActions}>
            <WritePressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => void pickImage()}
              disabled={saving || removing}
            >
              <Text style={styles.buttonPrimaryText}>그림 올리기</Text>
            </WritePressable>
            {data.ogImageSource === 'upload' && !pending ? (
              <WritePressable style={styles.button} onPress={() => void removeImage()} disabled={saving || removing}>
                {removing ? <ActivityIndicator color="#212124" /> : <Text style={styles.buttonText}>올린 그림 치우기</Text>}
              </WritePressable>
            ) : null}
            <Text style={styles.fieldHint}>
              {pending
                ? '고른 그림이 있어요. 저장하면 이 그림으로 바뀌어요.'
                : data.ogImageSource === 'upload'
                  ? '올린 그림을 쓰고 있어요.'
                  : data.ogImageSource === 'url'
                    ? '아래 「그림 주소」에 적어 둔 그림을 쓰고 있어요.'
                    : '저장소에 든 기본 그림을 쓰고 있어요.'}
            </Text>
          </View>
          <Text style={styles.fieldHint}>
            PNG · JPG · WebP. 카드에서 잘리지 않는 크기는 1200×630이에요.
          </Text>
        </View>

        {FIELDS.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={[styles.input, field.multiline && styles.inputMultiline]}
              value={draft[field.key] ?? ''}
              onChangeText={(text) => {
                setDraft((prev) => ({ ...prev, [field.key]: text }));
                /* 주소를 적으면 그 주소가 그림이다 — 골라 둔 그림은 내려놓는다(출처는 하나뿐). */
                if (field.key === 'ogImageUrl' && text.trim()) setPending(null);
              }}
              placeholder={data.defaults[field.key] ?? ''}
              placeholderTextColor="#adb1ba"
              multiline={field.multiline}
            />
            <Text style={styles.fieldHint}>{field.hint}</Text>
          </View>
        ))}

        <Text style={styles.resetHint}>칸을 비우면 기본 문구로 돌아가요.</Text>

        {modalMessage ? (
          <Text
            style={modalMessage.tone === 'error' ? styles.modalError : styles.notice}
            accessibilityLiveRegion="polite"
          >
            {modalMessage.text}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={closeEditor} disabled={saving}>
            <Text style={styles.buttonText}>취소</Text>
          </Pressable>
          <WritePressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => void save()}
            disabled={saving || removing}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>저장</Text>}
          </WritePressable>
        </View>
      </AdminFormModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 32, gap: 20, maxWidth: 1120 },
  h1: { fontSize: FontSize.t3, fontWeight: '700', color: '#212124' },
  lead: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: '#4d5159' },
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  kindRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kindBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  kindBtnActive: { backgroundColor: '#212124', borderColor: '#212124' },
  kindBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#4d5159' },
  kindBtnTextActive: { color: '#fff' },
  imageActions: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  card: {
    flex: 1,
    minWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 10,
  },
  cardLabel: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94' },
  preview: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden' },
  /* 카드 그림 비율 그대로(1200×630) — 잘린 채로 보여주면 카카오톡에서 잘리는지 여기서 알 수 없다. */
  previewImage: {
    width: '100%',
    aspectRatio: OG_CARD.width / OG_CARD.height,
    backgroundColor: '#f2f3f6',
  },
  previewBody: { padding: 14, gap: 4 },
  previewTitle: { fontSize: FontSize.t6, fontWeight: '700', color: '#212124' },
  previewDesc: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: '#4d5159' },
  previewHost: { fontSize: FontSize.tab, color: '#868b94', marginTop: 4 },
  stateOk: { fontSize: FontSize.t6, fontWeight: '700', color: '#0f8a4f' },
  statePending: { fontSize: FontSize.t6, fontWeight: '700', color: '#b45309' },
  stateUnknown: { fontSize: FontSize.t6, fontWeight: '700', color: '#868b94' },
  stateHint: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: '#4d5159' },
  metaRow: { gap: 2, marginTop: 6 },
  metaText: { fontSize: FontSize.tab, color: '#868b94', fontVariant: ['tabular-nums'] },
  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#212124' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSize.t7,
    color: '#212124',
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  fieldHint: { fontSize: FontSize.tab, color: '#868b94' },
  resetHint: { fontSize: FontSize.tab, color: '#868b94' },
  notice: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: '#212124' },
  modalError: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: '#d92d20' },
  pendingImage: { width: 240, height: 126, borderRadius: 8, backgroundColor: '#f2f3f6' },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 132,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: '#ff6f61', borderColor: '#ff6f61' },
  buttonText: { fontSize: FontSize.t7, fontWeight: '700', color: '#212124' },
  buttonPrimaryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { padding: 32, fontSize: FontSize.t7, color: '#d92d20' },
});

/**
 * 옛 주소는 저장된 링크·딥링크가 있을 수 있어 남긴다. 실제 화면은 `/admin/faq`(사이트·기록)의 링크 미리보기 탭에 있다 —
 * `OgCardPanel`이 이 파일의 본체다.
 */
export default function OgCardRedirect() {
  return <Redirect href="/admin/faq?tab=og-card" />;
}
