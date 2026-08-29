import type { VisitNoteListResponse } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addVisitNote, listVisitNotes, removeVisitNote } from '@/api/client';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingCalendar,
  useTheme,
} from '@weddingpick/ui';
import { won } from '@/features/quotes/quote-result-view';

/**
 * 방문노트. 디자인 핸드오프 16번.
 *
 * **제안금액은 계약가가 아니라 그 자리에서 들은 값이다.** 그래서 가격 통계 어디에도
 * 들어가지 않는다 — 문서도 결제도 아니고, 들은 말이 남의 화면에 중앙값으로 나가면
 * 우리는 들은 말을 사실로 파는 것이 된다.
 */
export default function VisitNotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
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
    return (
      <Frame>
        <ThemedText type="t4">불러오지 못했습니다</ThemedText>
        <ThemedText type="t7" themeColor="textSecondary">
          {error}
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  if (!page) {
    return (
      <Frame>
        <ActivityIndicator color={theme.tint} />
      </Frame>
    );
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
        ...(Number.isFinite(inTenThousand) && inTenThousand > 0
          ? { quotedAmount: inTenThousand * 10_000 }
          : {}),
        ...(memo.trim() ? { memo: memo.trim() } : {}),
      });

      setFormOpen(false);
      setVendor('');
      setVisitedOn(null);
      setAmount('');
      setMemo('');
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '적지 못했습니다.');
    }
  }

  async function remove(noteId: string) {
    try {
      await removeVisitNote(id, noteId);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '지우지 못했습니다.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">방문노트</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              전체 {page.notes.length}개
            </ThemedText>
          </ThemedView>

          {page.notes.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                아직 적어두신 방문이 없습니다. 상담을 다녀오시면 그날 들은 금액과 느낌을
                적어두세요.
              </ThemedText>
            </ThemedView>
          ) : (
            page.notes.map((note) => (
              <ThemedView key={note.id} type="backgroundElement" style={styles.card}>
                <ThemedText type="t5">{note.vendorLabel}</ThemedText>
                <ThemedText type="t7" themeColor="textSecondary">
                  {note.visitedOn}
                </ThemedText>
                {note.quotedAmount !== null ? (
                  <ThemedText type="t5" numeric>
                    제안 {won(note.quotedAmount)}
                  </ThemedText>
                ) : null}
                {note.memo ? <ThemedText type="t6">{note.memo}</ThemedText> : null}
                <ActionButton label="빼기" onPress={() => void remove(note.id)} />
              </ThemedView>
            ))
          )}

          {/* 제안가가 무엇인지 늘 함께 적는다. 계약가로 읽히면 안 된다. */}
          <ThemedText type="t7" themeColor="textAssistive">
            {page.caveat}
          </ThemedText>

          <ActionButton variant="primary" label="방문 적어두기" onPress={() => setFormOpen(true)} />
          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={formOpen} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ScrollView contentContainerStyle={styles.sheet}>
            <ThemedText type="t4">방문 적어두기</ThemedText>

            <ThemedText type="t7" themeColor="textSecondary">
              업체
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={vendor}
              onChangeText={setVendor}
              placeholder="예: 가온예식홀"
              placeholderTextColor={theme.textAssistive}
              accessibilityLabel="업체"
            />

            <ThemedText type="t7" themeColor="textSecondary">
              방문일
            </ThemedText>
            {/* 이미 다녀온 날을 적는 자리라 지난 날을 고를 수 있어야 한다. */}
            <WeddingCalendar
              value={visitedOn}
              onChange={setVisitedOn}
              today={new Date(1970, 0, 1)}
            />

            <ThemedText type="t7" themeColor="textSecondary">
              제안금액 (만원)
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="예: 2800"
              placeholderTextColor={theme.textAssistive}
              accessibilityLabel="제안금액"
            />

            <ThemedText type="t7" themeColor="textSecondary">
              메모
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.memo,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
              value={memo}
              onChangeText={setMemo}
              multiline
              placeholder="특이사항을 적어주세요"
              placeholderTextColor={theme.textAssistive}
              accessibilityLabel="메모"
            />

            <ThemedView style={styles.sheetActions}>
              <ActionButton label="취소" onPress={() => setFormOpen(false)} />
              <ActionButton
                variant="primary"
                label="적어두기"
                disabled={!ready}
                onPress={() => void save()}
              />
            </ThemedView>
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </SafeAreaView>
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
    gap: Spacing.two,
  },
  section: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: Layout.gutter, gap: Spacing.two },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  input: {
    minHeight: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  memo: { minHeight: 100, textAlignVertical: 'top', paddingTop: Spacing.three },
});
