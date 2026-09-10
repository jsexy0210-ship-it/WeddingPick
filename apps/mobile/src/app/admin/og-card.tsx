/**
 * 링크 미리보기(OG 카드) 관리
 *
 * 카카오톡·슬랙에 주소를 붙이면 뜨는 카드의 제목·설명·그림을 고친다.
 *
 * **저장과 반영은 다른 일이다.** 웹은 정적 HTML이라 저장만으로는 바뀌지 않고 다시
 * 빌드해야 한다. 그래서 단추가 둘이고, 화면은 「지금 사이트에 나가 있는 제목」을
 * 실제로 읽어와 보여준다 — 저장 시각과 배포 시각을 비교해 「반영됨」이라고 말하면
 * 실패한 배포까지 반영된 것으로 보인다.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

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
    hint: '비워두면 저장소에 든 기본 그림을 써요. https로 시작하는 주소여야 해요.',
  },
  { key: 'ogImageAlt', label: '그림 설명', hint: '그림을 못 보는 사람에게 읽히는 글이에요.' },
];

function formatWhen(value: string | null): string {
  if (!value) return '없음';

  const at = new Date(value);

  return `${at.getFullYear()}. ${at.getMonth() + 1}. ${at.getDate()}. ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

export default function OgCardScreen() {
  const [data, setData] = useState<AdminView | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/site-meta')
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
  }, [rev]);

  /** 칸이 비어 있으면 기본값이 무엇인지 보여준다. 저장하면 그 값이 다시 이긴다. */
  function shown(key: keyof Meta): string {
    const typed = draft[key]?.trim();

    if (typed) return typed;

    return data?.defaults[key] ?? '';
  }

  async function persist(): Promise<AdminView> {
    const saved = (await apiFetch('/v1/admin/site-meta', {
      method: 'PUT',
      body: JSON.stringify(draft),
    })) as AdminView;

    setData(saved);

    return saved;
  }

  async function save(): Promise<void> {
    setSaving(true);
    setNotice(null);
    try {
      await persist();
      setNotice('저장했어요. 사이트에 내보내려면 「저장 후 반영하기」를 눌러주세요.');
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * **먼저 저장하고 배포를 건다.** 단추 이름이 「저장 후 반영하기」인데 배포만 걸면,
   * 고쳐 놓고 저장을 안 누른 사람은 옛 문구가 그대로 나간 것을 「반영했는데 안 바뀐다」로
   * 읽는다. 저장이 실패하면 배포를 걸지 않는다 — 걸어봐야 옛 문구가 다시 나갈 뿐이다.
   */
  async function publish(): Promise<void> {
    setPublishing(true);
    setNotice(null);
    try {
      await persist();
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : '저장하지 못해서 반영하지 않았어요.');
      setPublishing(false);

      return;
    }

    try {
      await apiFetch('/v1/admin/site-meta/publish', { method: 'POST' });
      setNotice('저장하고 사이트를 다시 만들고 있어요. 2~4분 뒤에 「지금 사이트에 나간 제목」으로 확인해주세요.');
      setRev((n) => n + 1);
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : '저장은 됐지만 반영하지 못했어요.');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <DelayedLoader active size={40} style={styles.centered} />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!data) return null;

  const live = data.liveOgTitle;
  const matched = live !== null && live === shown('ogTitle');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>링크 미리보기</Text>
      <Text style={styles.lead}>
        카카오톡이나 슬랙에 주소를 붙이면 뜨는 카드예요. 저장한 뒤 「반영하기」를 눌러야 사이트에 나가요.
      </Text>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>미리보기</Text>
          <View style={styles.preview}>
            <View style={styles.previewImage}>
              <Text style={styles.previewImageText}>
                {shown('ogImageUrl') ? '올린 그림' : '기본 그림'}
              </Text>
            </View>
            <View style={styles.previewBody}>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {shown('ogTitle')}
              </Text>
              <Text style={styles.previewDesc} numberOfLines={2}>
                {shown('ogDescription')}
              </Text>
              <Text style={styles.previewHost}>weddingpick-web.onrender.com</Text>
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
                {matched ? '지금 저장된 제목과 같아요.' : '저장한 제목과 달라요. 「반영하기」를 눌러주세요.'}
              </Text>
            </>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>마지막 저장 {formatWhen(data.updatedAt)}</Text>
            <Text style={styles.metaText}>마지막 반영 요청 {formatWhen(data.publishRequestedAt)}</Text>
          </View>
        </View>
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
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>저장</Text>}
        </Pressable>
        <Pressable style={styles.button} onPress={publish} disabled={publishing}>
          {publishing ? <ActivityIndicator /> : <Text style={styles.buttonText}>저장 후 반영하기</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 32, gap: 20, maxWidth: 1120 },
  h1: { fontSize: FontSize.t3, fontWeight: '700', color: '#212124' },
  lead: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: '#4d5159' },
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
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
