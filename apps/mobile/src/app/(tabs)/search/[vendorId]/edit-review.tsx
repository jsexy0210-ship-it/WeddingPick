import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { updateReview } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import {
  ActionButton,
  Radius,
  RatingPicker,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import ReviewsScreen from './reviews';

/**
 * 후기 수정 딥링크도 별도 전체 화면을 만들지 않고 후기 목록 + DLG-D 시트로 연결한다.
 */
export default function EditReviewRoute() {
  const {
    vendorId,
    reviewId,
    overall: overallParam,
    title: titleParam,
    body: bodyParam,
    pros: prosParam,
    cons: consParam,
  } = useLocalSearchParams<{
    vendorId: string;
    reviewId: string;
    overall: string;
    title: string;
    body: string;
    pros: string;
    cons: string;
  }>();
  const theme = useTheme();

  const initialOverall = overallParam ? parseInt(overallParam, 10) : null;
  const initialTitle = titleParam ?? '';
  const initialBody = bodyParam ?? '';
  const initialPros = prosParam ?? '';
  const initialCons = consParam ?? '';

  const [overall, setOverall] = useState<number | null>(initialOverall);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [pros, setPros] = useState(initialPros);
  const [cons, setCons] = useState(initialCons);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = overall !== null && title.trim().length > 0 && body.trim().length >= 20;
  const dirty =
    overall !== initialOverall ||
    title !== initialTitle ||
    body !== initialBody ||
    pros !== initialPros ||
    cons !== initialCons;

  function closeSheet() {
    dismissToOrReplace(`/search/${vendorId}/reviews`);
  }

  function requestClose() {
    if (sending) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function submit() {
    if (overall === null || !ready || sending) return;

    setSending(true);
    setError(null);
    try {
      await updateReview(reviewId, {
        overall,
        title: title.trim(),
        body: body.trim(),
        ...(pros.trim() ? { pros: pros.trim() } : {}),
        ...(cons.trim() ? { cons: cons.trim() } : {}),
      });
      showResultToast('후기를 수정했어요');
      closeSheet();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '고치지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <View style={styles.host}>
      <ReviewsScreen />

      <BottomSheet visible onRequestClose={requestClose} testID="review-edit-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <ThemedText type="t4">내 후기 고치기</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              후기 목록을 남겨둔 채 내용만 고쳐요.
            </ThemedText>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">이용한 사람들의 경험</ThemedText>
              <RatingPicker
                label="이용한 사람들의 경험"
                value={overall}
                onChange={setOverall}
              />
            </ThemedView>

            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">제목</ThemedText>
              <TextInput
                style={inputStyle}
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
              />
            </ThemedView>

            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">후기</ThemedText>
              <TextInput
                style={[inputStyle, styles.bodyInput]}
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                placeholderTextColor={theme.textSecondary}
              />
            </ThemedView>

            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">좋은 점 (선택)</ThemedText>
              <TextInput
                style={inputStyle}
                value={pros}
                onChangeText={setPros}
                placeholderTextColor={theme.textSecondary}
              />
            </ThemedView>

            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">아쉬운 점 (선택)</ThemedText>
              <TextInput
                style={inputStyle}
                value={cons}
                onChangeText={setCons}
                placeholderTextColor={theme.textSecondary}
              />
            </ThemedView>

            <ThemedText type="small" themeColor="textSecondary">
              직원분 실명처럼 다른 분을 알아볼 수 있는 내용은 적지 말아주세요.
            </ThemedText>

            {error ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {error}
                </ThemedText>
              </ThemedView>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <ActionButton label="취소" disabled={sending} onPress={requestClose} />
            <ActionButton
              variant="primary"
              label={sending ? '저장 중…' : '저장하기'}
              disabled={!ready || sending}
              onPress={() => void submit()}
            />
          </View>
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHead: { gap: Spacing.one },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: Spacing.four },
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Radius.input, padding: Spacing.three },
  bodyInput: { minHeight: 140, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
