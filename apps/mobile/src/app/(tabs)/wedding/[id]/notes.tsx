import type { WeddingNote, WeddingNoteListResponse } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  addWeddingNote,
  listWeddingNotes,
  removeWeddingNote,
  updateWeddingNote,
} from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Fab,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  showAlert,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';

type Filter = 'all' | 'vendor' | 'free';

function formatWhen(iso: string): string {
  const d = new Date(iso);

  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

/** 업체별 메모를 업체 하나로 묶는 키. vendorId가 없으면 이름으로 묶는다. */
function groupKey(note: WeddingNote): string {
  return note.vendorId ?? note.vendorLabel ?? '';
}

/**
 * 메모. WP-OUR-011. `wedding/index.tsx`에서 들어오고, 결정한 업체(WP-OUR-003)에서
 * 업체가 정해진 채로 들어올 수도 있다(`vendorId`·`vendorLabel` 쿼리 파라미터).
 *
 * **동시 수정 충돌은 새로 만들지 않는다.** 이미 있는 conflict 화면
 * (`wedding/[id]/conflict.tsx`)을 그대로 쓴다 — 서버가 version 불일치로 409를
 * 돌려주면 여기서 잡아 그 화면으로 보낸다.
 */
export default function WeddingNotesScreen() {
  const { id, vendorId: paramVendorId, vendorLabel: paramVendorLabel } = useLocalSearchParams<{
    id: string;
    vendorId?: string;
    vendorLabel?: string;
  }>();
  const theme = useTheme();
  const [page, setPage] = useState<WeddingNoteListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(paramVendorId ? 'vendor' : 'all');

  // 결정한 업체에서 "메모 남기기"로 들어왔으면 바로 쓰기 시트를 연 채로 시작한다.
  // effect가 아니라 초깃값으로 두는 이유 — 마운트 뒤 한 틱 늦게 열리면 깜빡인다.
  const [sheetOpen, setSheetOpen] = useState(() => Boolean(paramVendorId));
  const [editing, setEditing] = useState<WeddingNote | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [draftVendorLabel, setDraftVendorLabel] = useState(() => paramVendorLabel ?? '');

  const load = useCallback(() => {
    listWeddingNotes(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  const vendorGroups = useMemo(() => {
    if (!page) return [];

    const vendorNotes = page.notes.filter((note) => note.vendorId !== null || note.vendorLabel !== null);
    const groups = new Map<string, WeddingNote[]>();

    for (const note of vendorNotes) {
      const key = groupKey(note);
      const bucket = groups.get(key) ?? [];

      bucket.push(note);
      groups.set(key, bucket);
    }

    return [...groups.entries()].map(([key, notes]) => ({
      key,
      label: notes[0]!.vendorLabel ?? '업체',
      notes,
    }));
  }, [page]);

  const freeNotes = useMemo(
    () => (page ? page.notes.filter((note) => note.vendorId === null && note.vendorLabel === null) : []),
    [page]
  );

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const isEmpty = page.notes.length === 0;
  const showVendorGroup = filter !== 'free';
  const showFreeGroup = filter !== 'vendor';

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
    setDraftBody('');
    setDraftVendorLabel('');
  }

  function openAdd() {
    setEditing(null);
    setDraftBody('');
    setDraftVendorLabel('');
    setSheetOpen(true);
  }

  function openEdit(note: WeddingNote) {
    setEditing(note);
    setDraftBody(note.body);
    setDraftVendorLabel(note.vendorLabel ?? '');
    setSheetOpen(true);
  }

  async function submit() {
    const body = draftBody.trim();

    if (!body) {
      showAlert('메모를 적어주세요');
      return;
    }

    try {
      if (editing) {
        await updateWeddingNote(id, editing.id, { body, version: editing.version });
      } else {
        const vendorLabel = draftVendorLabel.trim();

        await addWeddingNote(id, {
          ...(paramVendorId ? { vendorId: paramVendorId } : {}),
          ...(vendorLabel ? { vendorLabel } : {}),
          body,
        });
      }

      closeSheet();
      load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'conflict') {
        closeSheet();
        router.push({
          pathname: '/wedding/[id]/conflict' as never,
          params: {
            id,
            kind: 'memo',
            label: editing?.body.slice(0, 40) ?? '',
            conflictMessage: caught.message,
          },
        });
        return;
      }

      showAlert('저장하지 못했어요', caught instanceof Error ? caught.message : '다시 시도해주세요.');
    }
  }

  function remove(note: WeddingNote) {
    showAlert('삭제할까요?', '이 메모를 삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          removeWeddingNote(id, note.id)
            .then(load)
            .catch((caught: unknown) =>
              setError(caught instanceof Error && caught.message ? caught.message : '지울 수 없어요.')
            ),
      },
    ]);
  }

  function NoteRow({ note, showAvatar }: { note: WeddingNote; showAvatar: boolean }) {
    return (
      <View style={styles.noteRow}>
        {showAvatar ? (
          <View style={[styles.avatar, { backgroundColor: theme.tintSubtle }]}>
            <ThemedText type="badge" themeColor="tint">
              {(note.vendorLabel ?? '업').slice(0, 1)}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.noteBody}>
          <ThemedText type="t6">{note.body}</ThemedText>
          <ThemedText type="t7" themeColor="textAssistive" numeric>
            {note.authoredByPartner ? '배우자' : '나'} · {formatWhen(note.updatedAt)}
            {note.edited ? ' · 수정됨' : ''}
          </ThemedText>
          <View style={styles.noteActions}>
            <Pressable accessibilityRole="button" onPress={() => openEdit(note)}>
              <ThemedText type="t7" themeColor="tint">
                고치기
              </ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => remove(note)}>
              <ThemedText type="t7" themeColor="textAssistive">
                삭제
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <ThemedText type="t2">메모</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              업체마다 의견을 남길 수 있어요
            </ThemedText>
          </View>

          <View style={styles.chips}>
            <FilterChip label="전체" selected={filter === 'all'} role="radio" onPress={() => setFilter('all')} />
            <FilterChip
              label="업체별"
              selected={filter === 'vendor'}
              role="radio"
              onPress={() => setFilter('vendor')}
            />
            <FilterChip
              label="자유메모"
              selected={filter === 'free'}
              role="radio"
              onPress={() => setFilter('free')}
            />
          </View>

          {isEmpty ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t5">아직 메모가 없어요</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                업체마다 의견을 남기면 배우자와 함께 볼 수 있어요
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {showVendorGroup &&
                vendorGroups.map((group) => (
                  <ThemedView key={group.key} type="backgroundElement" style={styles.card}>
                    <ThemedText type="t5">{group.label}</ThemedText>
                    {group.notes.map((note, idx) => (
                      <View key={note.id}>
                        <NoteRow note={note} showAvatar />
                        {idx < group.notes.length - 1 && (
                          <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        )}
                      </View>
                    ))}
                  </ThemedView>
                ))}

              {showFreeGroup && freeNotes.length > 0 ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="t5">자유 메모</ThemedText>
                  {freeNotes.map((note, idx) => (
                    <View key={note.id}>
                      <NoteRow note={note} showAvatar={false} />
                      {idx < freeNotes.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  ))}
                </ThemedView>
              ) : null}
            </>
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>

      <Fab label="메모 추가" glyph="+" onPress={openAdd} />

      <Modal visible={sheetOpen} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="t4">{editing ? '메모 고치기' : '메모 추가'}</ThemedText>

            {!editing ? (
              <>
                <ThemedText type="t7" themeColor="textSecondary">
                  업체 이름 (선택)
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundSelected },
                  ]}
                  value={draftVendorLabel}
                  onChangeText={setDraftVendorLabel}
                  editable={!paramVendorId}
                  placeholder="예: 가온예식홀"
                  placeholderTextColor={theme.textAssistive}
                />
              </>
            ) : null}

            <ThemedText type="t7" themeColor="textSecondary">
              메모
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
              value={draftBody}
              onChangeText={setDraftBody}
              placeholder="메모를 남겨보세요"
              placeholderTextColor={theme.textAssistive}
              multiline
              maxLength={1000}
            />

            <ThemedView style={styles.sheetActions}>
              <ActionButton label="취소" onPress={closeSheet} />
              <ActionButton variant="primary" label="저장하기" onPress={() => void submit()} />
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  hero: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.two },
  noteRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noteBody: { flex: 1, minWidth: 0, gap: Spacing.half },
  noteActions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.half },
  divider: { height: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  input: {
    minHeight: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
});
