import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { updateReview } from '@/api/client';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  RatingPicker,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 내 후기 고치기.
 *
 * 역할·체크리스트·측면 점수는 바꿀 수 없다(서비스 정책). 글과 별점만 고친다.
 * 수정 규칙이 위험정보를 찾아 가린 글도 고치면 재심사로 되살아난다 — 그래야
 * "지우고 다시 올려주세요"가 지킬 수 있는 말이 된다.
 */
export default function EditReviewScreen() {
  const { reviewId, overall: overallParam, title: titleParam, body: bodyParam, pros: prosParam, cons: consParam } =
    useLocalSearchParams<{
      vendorId: string;
      reviewId: string;
      overall: string;
      title: string;
      body: string;
      pros: string;
      cons: string;
    }>();
  const theme = useTheme();

  const [overall, setOverall] = useState<number | null>(
    overallParam ? parseInt(overallParam, 10) : null
  );
  const [title, setTitle] = useState(titleParam ?? '');
  const [body, setBody] = useState(bodyParam ?? '');
  const [pros, setPros] = useState(prosParam ?? '');
  const [cons, setCons] = useState(consParam ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready = overall !== null && title.trim().length > 0 && body.trim().length >= 20;

  async function submit() {
    if (overall === null) return;
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
      setDone(true);
    } catch (err) {
      setError((err as Error).message ?? '고치지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            <ThemedText type="subtitle">후기를 고쳤어요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              수정된 내용은 심사 후 반영돼요.
            </ThemedText>
            <ActionButton label="후기 목록으로" onPress={() => router.back()} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">내 후기 고치기</ThemedText>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">이용한 사람들의 경험</ThemedText>
            <RatingPicker label="이용한 사람들의 경험" value={overall} onChange={setOverall} />
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

          {error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">{error}</ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary">
              직원분 실명처럼 다른 분을 알아볼 수 있는 내용은 적지 말아주세요.
            </ThemedText>
            <ActionButton
              variant="primary"
              label={sending ? '저장 중…' : '저장하기'}
              disabled={!ready || sending}
              onPress={() => void submit()}
            />
            <ActionButton label="그만두기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Radius.input, padding: Spacing.three },
  bodyInput: { minHeight: 140, textAlignVertical: 'top' },
});
