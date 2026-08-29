import {
  DISPLAY_NAME_HINT,
  MAX_DISPLAY_NAME_LENGTH,
  WEDDING_DATE_HINT,
  checkDisplayName,
  dDay,
  formatWeddingDate,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completeSetup } from '@/api/client';
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

/**
 * 이름·예식일 등록. 디자인 핸드오프 2번 — **스킵할 수 없다.**
 *
 * 뒤로가기도 건너뛰기도 탭바도 없다. 이 둘이 없으면 홈의 D-Day도 웨딩 스케줄의
 * 상태 판정도 만들 수 없어서다.
 *
 * 두 값이 **모두 유효해야** 완료가 열린다. 하나씩 저장하면 이름만 넣고 나간
 * 사람의 홈이 이름은 부르는데 D-Day가 없는 반쪽이 된다.
 */
export default function SetupScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  /** 시트에서 고르는 중인 값. 취소하면 버린다. */
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameCheck = checkDisplayName(name);
  const ready = nameCheck.ok && date !== null;

  async function submit() {
    if (!ready || date === null) return;

    setSending(true);
    setError(null);

    try {
      await completeSetup(name.trim(), date);
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '등록하지 못했습니다.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* 빈 네비게이션바. 뒤로가기가 없다는 것이 이 화면의 규칙이다. */}
        <ThemedView style={styles.navBar} />

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.headline}>
            <ThemedText type="t2">어떻게 불러드릴까요?</ThemedText>
          </ThemedView>

          <ThemedView>
            <ThemedText type="t6" themeColor="textSecondary">
              이름과 예식일을 알려주시면
            </ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              예식일까지의 준비 일정을 맞춰드려요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.field}>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={name}
              onChangeText={setName}
              // 초과 입력을 막는다. 지우게 하는 것보다 못 넣게 하는 편이 낫다.
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              placeholder="이름"
              placeholderTextColor={theme.textAssistive}
              accessibilityLabel="이름"
            />
            <ThemedText
              type="t7"
              themeColor={name.length > 0 && !nameCheck.ok ? 'negative' : 'textAssistive'}>
              {name.length > 0 && !nameCheck.ok ? nameCheck.reason : DISPLAY_NAME_HINT}
            </ThemedText>
          </ThemedView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="예식일 선택"
            onPress={() => {
              setPending(date);
              setCalendarOpen(true);
            }}>
            <ThemedView
              style={[styles.dateCard, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="t6" themeColor={date ? 'text' : 'textAssistive'}>
                {date ? formatWeddingDate(date) : '예식일을 선택해주세요'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          {date ? (
            <ThemedText type="t7" themeColor="tint">
              {dDay(date).text}
            </ThemedText>
          ) : null}

          <ThemedText type="t7" themeColor="textAssistive">
            입력한 정보는 언제든 설정에서 바꿀 수 있어요
          </ThemedText>

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            label={sending ? '등록하는 중…' : '완료'}
            disabled={!ready || sending}
            onPress={() => void submit()}
          />
        </ThemedView>
      </SafeAreaView>

      <Modal visible={calendarOpen} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="t4">예식일 선택</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {/* 고르기 전에는 규칙을, 고른 뒤에는 남은 날을 말한다. */}
              {pending ? dDay(pending).text : WEDDING_DATE_HINT}
            </ThemedText>

            <WeddingCalendar value={pending} onChange={setPending} />

            <ThemedView style={styles.sheetActions}>
              <ActionButton label="취소" onPress={() => setCalendarOpen(false)} />
              <ActionButton
                variant="primary"
                label="선택 완료"
                disabled={pending === null}
                onPress={() => {
                  setDate(pending);
                  setCalendarOpen(false);
                }}
              />
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
  navBar: { height: Layout.navBar },
  content: { paddingHorizontal: Layout.gutter, gap: Spacing.three, paddingBottom: Spacing.four },
  headline: { gap: 0 },
  field: { gap: Spacing.one },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  dateCard: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
