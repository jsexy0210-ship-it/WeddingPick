import type { VisitNoteListResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { addVisitNote, listVisitNotes, removeVisitNote } from '@/api/client';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';
import { formatDateDot } from '@/features/common/format-date';
import {
  ActionButton,
  ErrorView,
  Layout,
  SkeletonView,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingCalendar,
  showAlert,
} from '@weddingpick/ui';
import { DateChip, Field, Hero, ListRow, NavBar, NoteCard, RowValue, Screen, Section } from '@/features/wedding/screen-kit';

/**
 * 방문노트. 상담을 다녀온 날 들은 금액과 느낌을 적는 자리.
 *
 *   nav     «방문노트» · 오른쪽 «추가»(coral)
 *   hero    «N곳을 다녀왔어요»
 *   행      날짜칩 52 · 업체명 18/24 · 메모 14/19 · 제안 금액 16/22 700
 *   note    제안 금액은 계약가가 아니다(`page.caveat`)
 *
 * **제안금액은 계약가가 아니라 그 자리에서 들은 값이다.** 그래서 가격 통계 어디에도
 * 들어가지 않는다 — 들은 말이 남의 화면에 기준금액으로 나가면 들은 말을 사실로 파는 것이 된다.
 */
export default function VisitNotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<VisitNoteListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [vendor, setVendor] = useState('');
  const [visitedOn, setVisitedOn] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const load = useCallback(() => {
    listVisitNotes(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const ready = vendor.trim().length > 0 && visitedOn !== null;

  async function save() {
    if (!ready || visitedOn === null) return;

    /* 화면은 만원 단위로 받는다. 서버에는 원 단위로 보낸다. */
    const inTenThousand = Number(amount.replace(/[^\d]/g, ''));

    try {
      await addVisitNote(id, {
        vendorLabel: vendor.trim(),
        visitedOn,
        ...(Number.isFinite(inTenThousand) && inTenThousand > 0 ? { quotedAmount: inTenThousand * 10_000 } : {}),
        ...(memo.trim() ? { memo: memo.trim() } : {}),
      });

      setFormOpen(false);
      setVendor('');
      setVisitedOn(null);
      setAmount('');
      setMemo('');
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '적지 못했어요.');
    }
  }

  function remove(noteId: string, label: string) {
    showAlert(`${label} 방문 기록을 삭제할까요?`, '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          removeVisitNote(id, noteId)
            .then(load)
            .catch((caught: Error) => setError(caught.message ?? '삭제하지 못했어요.')),
      },
    ]);
  }

  const count = page.notes.length;

  return (
    <Screen>
      <NavBar title="방문노트" right={{ label: '추가', brand: true, onPress: () => setFormOpen(true) }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero
          title={count > 0 ? `${count}곳을 다녀왔어요` : '아직 다녀온 곳이 없어요'}
          sub={count > 0 ? null : '상담을 다녀오면 그날 들은 금액과 느낌을 적어두세요'}
        />

        {count > 0 ? (
          <Section>
            {page.notes.map((note) => (
              <ListRow
                key={note.id}
                left={<DateChip date={note.visitedOn} />}
                title={note.vendorLabel}
                sub={note.memo ?? formatDateDot(note.visitedOn)}
                right={
                  note.quotedAmount !== null ? (
                    <RowValue color="text" bold>
                      {manwon(note.quotedAmount)}
                    </RowValue>
                  ) : null
                }
                onPress={() => remove(note.id, note.vendorLabel)}
                accessibilityLabel={`${note.vendorLabel} 방문 기록 · 길게 누르지 않아도 삭제를 물어요`}
              />
            ))}
          </Section>
        ) : (
          <View style={styles.emptyAction}>
            <ActionButton variant="ghost" size="large" label="방문 적어두기" onPress={() => setFormOpen(true)} />
          </View>
        )}

        {/* 제안가가 무엇인지 늘 함께 적는다. 계약가로 읽히면 안 된다. */}
        <View style={styles.noteWrap}>
          <NoteCard title="제안 금액은 들은 값이에요" body={page.caveat} />
        </View>
      </ScrollView>

      <BottomSheet dismissible={false} visible={formOpen} onRequestClose={() => setFormOpen(false)}>
        <ScrollView style={SHEET_PANEL} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.sheetBody}>
            <ThemedText type="t3">방문 적어두기</ThemedText>
            <Field label="업체" value={vendor} onChangeText={setVendor} placeholder="업체 이름" maxLength={60} />
            <View style={styles.field}>
              <ThemedText type="t7" themeColor="textSecondary">
                방문일
              </ThemedText>
              {/* 이미 다녀온 날을 적는 자리라 지난 날을 고를 수 있어야 한다. */}
              <WeddingCalendar value={visitedOn} onChange={setVisitedOn} allowPast />
            </View>
            <Field
              label="제안 금액 (만원)"
              value={amount}
              onChangeText={(text) =>
                setAmount(text.replace(/[^0-9]/g, '').slice(0, 7).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
              }
              keyboardType="number-pad"
              placeholder="예: 2,800"
              maxLength={9}
            />
            <Field
              label="메모"
              value={memo}
              onChangeText={setMemo}
              multiline
              placeholder="그날 느낌이나 확인할 것"
              maxLength={1000}
            />
            <View style={styles.sheetActions}>
              <View style={styles.sheetButton}>
                <ActionButton size="xlarge" label="취소" onPress={() => setFormOpen(false)} />
              </View>
              <View style={styles.sheetButton}>
                <ActionButton size="xlarge" variant="primary" label="적어두기" disabled={!ready} onPress={() => void save()} />
              </View>
            </View>
          </ThemedView>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.two },
  emptyAction: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  sheet: { padding: Layout.gutter },
  sheetBody: { gap: Spacing.three },
  field: { gap: Spacing.one + Spacing.half },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
  sheetButton: { flex: 1 },
});
