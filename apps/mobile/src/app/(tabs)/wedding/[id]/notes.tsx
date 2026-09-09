import type { CurrentUser, WeddingNote, WeddingNoteListResponse } from '@weddingpick/api-contract';
import { TERMS } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ApiError,
  addWeddingNote,
  getCurrentUser,
  listWeddingNotes,
  removeWeddingNote,
  updateWeddingNote,
} from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import {
  ActionButton,
  ErrorView,
  FilterChip,
  Layout,
  SkeletonView,
  Spacing,
  ThemedText,
  showAlert,
} from '@weddingpick/ui';
import {
  Avatar,
  Field,
  Hero,
  ListRow,
  NavBar,
  RowValue,
  Screen,
  Section,
  relativeTime,
} from '@/features/wedding/screen-kit';

type Filter = 'all' | 'vendor' | 'free';

/** `spec/strings.ko.json` `ourWedding.notes.*`. */
const S = {
  title: '메모',
  add: '메모 추가',
  edit: '메모 고치기',
  filterAll: '전체',
  filterVendor: '업체별',
  filterFree: '자유 메모',
  vendorGroup: '업체별',
  freeGroup: '자유 메모',
  emptyTitle: '첫 메모를 남겨보세요',
  emptyBody: '업체마다 의견을 남길 수 있어요',
  placeholder: '메모를 남겨보세요',
  vendorField: '업체 (선택)',
  byPartner: TERMS.spouse,
  byMe: '나',
  edited: '수정됨',
  deleteTitle: '이 메모를 삭제할까요?',
  deleteBody: '삭제하면 되돌릴 수 없어요.',
} as const;

function isVendorNote(note: WeddingNote): boolean {
  return note.vendorId !== null || note.vendorLabel !== null;
}

/**
 * 메모. WP-OUR-011 · 핸드오프 08-schedule-sub #5.
 *
 *   nav      «메모» · 오른쪽 «추가»(coral)
 *   hero     «{배우자}님과 메모 N개를 썼어요» — 혼자면 «메모 N개를 썼어요»
 *   칩 3     전체 · 업체별 · 자유 메모
 *   업체별    아바타 32(작성자) · 업체명 18/24 · 내용 14/19 2줄 · «3일 전» 16/22
 *   자유 메모  내용 18/24 · «작성자 · 수정됨» · 시간 · 끝에 «메모 추가» 텍스트 버튼
 *
 * 작성자와 수정 여부를 항상 남긴다(screens.json rule). 행을 누르면 고치는 시트가 열린다.
 * **동시 수정 충돌은 새로 만들지 않는다** — 서버가 version 불일치로 409를 주면
 * `wedding/[id]/conflict.tsx`로 보낸다. 결정한 업체(WP-OUR-003)에서 업체가 정해진 채로
 * 들어오면(`vendorId` · `vendorLabel`) 쓰기 시트를 연 채로 시작한다.
 */
export default function WeddingNotesScreen() {
  const {
    id,
    vendorId: paramVendorId,
    vendorLabel: paramVendorLabel,
  } = useLocalSearchParams<{ id: string; vendorId?: string; vendorLabel?: string }>();
  const [page, setPage] = useState<WeddingNoteListResponse | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(paramVendorId ? 'vendor' : 'all');
  const [now, setNow] = useState<number | null>(null);

  // effect가 아니라 초깃값으로 두는 이유 — 마운트 뒤 한 틱 늦게 열리면 깜빡인다.
  const [sheetOpen, setSheetOpen] = useState(() => Boolean(paramVendorId));
  const [editing, setEditing] = useState<WeddingNote | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [draftVendorLabel, setDraftVendorLabel] = useState(() => paramVendorLabel ?? '');

  useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
    getCurrentUser()
      .then(setMe)
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    listWeddingNotes(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  const vendorNotes = useMemo(() => (page ? page.notes.filter(isVendorNote) : []), [page]);
  const freeNotes = useMemo(() => (page ? page.notes.filter((note) => !isVendorNote(note)) : []), [page]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page || now === null) {
    return <SkeletonView />;
  }

  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? TERMS.spouse) : null;
  const myInitial = (me?.displayName ?? S.byMe).slice(0, 1);
  const partnerInitial = (partner ?? TERMS.spouse).slice(0, 1);
  const total = page.notes.length;
  const heroTitle =
    total === 0 ? S.emptyTitle : partner ? `${partner}님과 메모 ${total}개를 썼어요` : `메모 ${total}개를 썼어요`;

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
    setDraftBody('');
    setDraftVendorLabel('');
  }

  function openAdd() {
    setEditing(null);
    setDraftBody('');
    setDraftVendorLabel(paramVendorLabel ?? '');
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
          params: { id, kind: 'memo', label: editing?.body.slice(0, 40) ?? '', conflictMessage: caught.message },
        });
        return;
      }

      showAlert('저장하지 못했어요', caught instanceof Error ? caught.message : '다시 시도해주세요.');
    }
  }

  function remove(note: WeddingNote) {
    showAlert(S.deleteTitle, S.deleteBody, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          removeWeddingNote(id, note.id)
            .then(() => {
              closeSheet();
              load();
            })
            .catch((caught: unknown) =>
              setError(caught instanceof Error && caught.message ? caught.message : '삭제하지 못했어요.')
            ),
      },
    ]);
  }

  const author = (note: WeddingNote) => (note.authoredByPartner ? (partner ?? S.byPartner) : S.byMe);
  const avatar = (note: WeddingNote) => (
    <Avatar
      initial={note.authoredByPartner ? partnerInitial : myInitial}
      tone={note.authoredByPartner ? 'partner' : 'me'}
    />
  );

  const showVendor = filter !== 'free' && vendorNotes.length > 0;
  const showFree = filter !== 'vendor' && freeNotes.length > 0;

  return (
    <Screen>
      <NavBar title={S.title} right={{ label: '추가', brand: true, onPress: openAdd }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={heroTitle} sub={total === 0 ? S.emptyBody : null} />

        {total > 0 ? (
          <View style={styles.chips}>
            <FilterChip label={S.filterAll} selected={filter === 'all'} role="radio" onPress={() => setFilter('all')} />
            <FilterChip
              label={S.filterVendor}
              selected={filter === 'vendor'}
              role="radio"
              onPress={() => setFilter('vendor')}
            />
            <FilterChip label={S.filterFree} selected={filter === 'free'} role="radio" onPress={() => setFilter('free')} />
          </View>
        ) : null}

        {showVendor ? (
          <Section label={S.vendorGroup}>
            {vendorNotes.map((note) => (
              <ListRow
                key={note.id}
                left={avatar(note)}
                title={note.vendorLabel ?? '업체'}
                sub={`${note.body}${note.edited ? ` · ${S.edited}` : ''}`}
                right={<RowValue>{relativeTime(note.updatedAt, now)}</RowValue>}
                onPress={() => openEdit(note)}
                accessibilityLabel={`${note.vendorLabel ?? '업체'} 메모 · ${author(note)}`}
              />
            ))}
          </Section>
        ) : null}

        {showFree || (filter !== 'vendor' && total > 0) ? (
          <Section label={S.freeGroup}>
            {freeNotes.map((note) => (
              <ListRow
                key={note.id}
                left={avatar(note)}
                title={note.body}
                sub={`${author(note)}${note.edited ? ` · ${S.edited}` : ''}`}
                subLines={1}
                right={<RowValue>{relativeTime(note.updatedAt, now)}</RowValue>}
                onPress={() => openEdit(note)}
                accessibilityLabel={`메모 · ${author(note)}`}
              />
            ))}
            {/* «메모 추가» — 시안: 목록 끝 텍스트 버튼 16/22 700 coral · padding 10 0. */}
            <Pressable accessibilityRole="button" onPress={openAdd} style={styles.addRow}>
              <ThemedText type="t6" themeColor="tint" style={styles.bold}>
                {S.add}
              </ThemedText>
            </Pressable>
          </Section>
        ) : null}

        {total === 0 ? (
          <View style={styles.emptyAction}>
            <ActionButton variant="ghost" size="large" label={S.add} onPress={openAdd} />
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet dismissible={false} visible={sheetOpen} onRequestClose={closeSheet}>
        <SheetPanel grabber={false} style={styles.sheet}>
          <ThemedText type="t3">{editing ? S.edit : S.add}</ThemedText>

          {!editing ? (
            <Field
              label={S.vendorField}
              value={draftVendorLabel}
              onChangeText={setDraftVendorLabel}
              editable={!paramVendorId}
              placeholder="업체 이름"
              maxLength={60}
            />
          ) : null}

          <Field
            label={S.title}
            value={draftBody}
            onChangeText={setDraftBody}
            placeholder={S.placeholder}
            multiline
            maxLength={1000}
          />

          {editing ? (
            <ThemedText type="t7" themeColor="textAssistive">
              {author(editing)} · {relativeTime(editing.updatedAt, now)}
              {editing.edited ? ` · ${S.edited}` : ''}
            </ThemedText>
          ) : null}

          <View style={styles.sheetActions}>
            {editing ? (
              <View style={styles.sheetButton}>
                <ActionButton size="xlarge" label="삭제" onPress={() => remove(editing)} />
              </View>
            ) : (
              <View style={styles.sheetButton}>
                <ActionButton size="xlarge" label="취소" onPress={closeSheet} />
              </View>
            )}
            <View style={styles.sheetButton}>
              <ActionButton size="xlarge" variant="primary" label="저장" onPress={() => void submit()} />
            </View>
          </View>
          {editing ? (
            <Pressable accessibilityRole="button" onPress={closeSheet} style={styles.cancelRow}>
              <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                취소
              </ThemedText>
            </Pressable>
          ) : null}
        </SheetPanel>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.two },
  /* 칩 줄 — padding 0 24 20 · gap 8. */
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gapHeadlineGrid,
  },
  addRow: { paddingVertical: Layout.cardGap, minHeight: Layout.touchTarget, justifyContent: 'center' },
  emptyAction: { paddingHorizontal: Layout.gutter },
  sheet: { gap: Spacing.three },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
  sheetButton: { flex: 1 },
  cancelRow: { alignSelf: 'center', paddingVertical: Spacing.two },
  bold: { fontWeight: 700 },
});
