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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FontSize, LineHeight } from '@weddingpick/ui';
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

export function OgCardPanel() {
  const [kind, setKind] = useState<Kind>('app');
  const [data, setData] = useState<AdminView | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
        setDraft({
          ogTitle: view.overrides.ogTitle ?? '',
          ogDescription: view.overrides.ogDescription ?? '',
          ogImageUrl: view.overrides.ogImageUrl ?? '',
          ogImageAlt: view.overrides.ogImageAlt ?? '',
        });
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

  async function persist(): Promise<AdminView> {
    const saved = (await apiFetch(`/v1/admin/site-meta?kind=${kind}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    })) as AdminView;

    setData(saved);

    return saved;
  }

  /**
   * 그림을 골라 저장소에 올린 뒤 키를 저장한다.
   * 정적 사이트에는 별도 사이트 배포 후 반영된다.
   */
  async function uploadImage(): Promise<void> {
    setNotice(null);

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    const mimeType = asset.mimeType ?? 'image/png';

    setUploading(true);
    try {
      const blob = await fetch(asset.uri).then((response) => response.blob());

      const target = (await apiFetch(`/v1/admin/site-meta/og-image/upload-target?kind=${kind}`, {
        method: 'POST',
        body: JSON.stringify({ mimeType }),
      })) as { storageKey: string; uploadUrl: string };

      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': mimeType },
        body: blob,
      });

      if (!put.ok) throw new Error(`그림을 올리지 못했어요 (${put.status})`);

      const saved = (await apiFetch(`/v1/admin/site-meta/og-image?kind=${kind}`, {
        method: 'PUT',
        body: JSON.stringify({ storageKey: target.storageKey }),
      })) as AdminView;

      setData(saved);
      setDraft((prev) => ({ ...prev, ogImageUrl: '' }));
      setNotice('그림을 저장했어요. 사이트에는 별도 배포 후 반영돼요.');
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : '그림을 올리지 못했어요.');
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(): Promise<void> {
    setNotice(null);
    setUploading(true);
    try {
      const saved = (await apiFetch(`/v1/admin/site-meta/og-image?kind=${kind}`, {
        method: 'DELETE',
      })) as AdminView;

      setData(saved);
      setNotice('올린 그림을 치웠어요. 기본 그림으로 돌아가요.');
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : '그림을 치우지 못했어요.');
    } finally {
      setUploading(false);
    }
  }

  async function save(): Promise<void> {
    setSaving(true);
    setNotice(null);
    try {
      await persist();
      setNotice('설정을 저장했어요. 사이트에는 별도 배포 후 반영돼요.');
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : '저장하지 못했어요.');
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
            disabled={saving || uploading}
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
        <WritePressable style={[styles.button, styles.buttonPrimary]} onPress={() => setEditing(true)}>
          <Text style={styles.buttonPrimaryText}>{`${current.label} 미리보기 수정`}</Text>
        </WritePressable>
      </View>

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
              <View style={styles.previewImage}>
                <Text style={styles.previewImageText}>기본 그림</Text>
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

      <AdminFormModal visible={editing} title={`${current.label} 미리보기 수정`} onClose={() => setEditing(false)}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>카드 그림</Text>
          <View style={styles.imageActions}>
          <WritePressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => void uploadImage()}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>그림 올리기</Text>
            )}
          </WritePressable>
          {data.ogImageSource === 'upload' ? (
            <WritePressable style={styles.button} onPress={() => void removeImage()} disabled={uploading}>
              <Text style={styles.buttonText}>올린 그림 치우기</Text>
            </WritePressable>
          ) : null}
          <Text style={styles.fieldHint}>
            {data.ogImageSource === 'upload'
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
            onChangeText={(text) => setDraft((prev) => ({ ...prev, [field.key]: text }))}
            placeholder={data.defaults[field.key] ?? ''}
            placeholderTextColor="#adb1ba"
            multiline={field.multiline}
          />
          <Text style={styles.fieldHint}>{field.hint}</Text>
        </View>
      ))}

      <Text style={styles.resetHint}>칸을 비우면 기본 문구로 돌아가요.</Text>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => setEditing(false)} disabled={saving || uploading}>
            <Text style={styles.buttonText}>취소</Text>
          </Pressable>
          <WritePressable style={[styles.button, styles.buttonPrimary]} onPress={save} disabled={saving}>
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
  previewImage: {
    height: 150,
    backgroundColor: '#ff6f61',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageText: { color: '#fff', fontSize: FontSize.t7, fontWeight: '700' },
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
