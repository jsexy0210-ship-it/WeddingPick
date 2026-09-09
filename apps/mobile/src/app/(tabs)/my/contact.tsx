import type { Inquiry } from '@weddingpick/api-contract';
import {
  FAQ_ITEMS,
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_RULES,
  INQUIRY_STATUS_LABEL,
  canSubmitInquiry,
  type InquiryCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createInquiry, listMyInquiries } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { formatDateDot } from '@/features/common/format-date';
import {
  Accordion,
  ActionButton,
  FilterChip,
  FontSize,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

function isCategory(value: string | undefined): value is InquiryCategory {
  return (INQUIRY_CATEGORIES as readonly string[]).includes(value ?? '');
}

/**
 * 문의 창구.
 *
 * 여러 화면이 "알려주세요"라고 말해왔다. 여기가 그 말을 받는 곳이다.
 *
 * 플래너 상세에서 노출 중단을 누르면 항목과 대상이 채워진 채로 열린다 — 이미 아는 것을
 * 다시 묻지 않는다.
 */
export default function ContactScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    category?: string;
    subjectKind?: 'planner' | 'vendor' | 'quote';
    subjectId?: string;
    subjectName?: string;
  }>();

  const [category, setCategory] = useState<InquiryCategory>(
    isCategory(params.category) ? params.category : 'other'
  );
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<string | null>(null);
  const [mine, setMine] = useState<Inquiry[]>([]);

  const subject =
    params.subjectKind && params.subjectId
      ? { kind: params.subjectKind, id: params.subjectId }
      : undefined;

  useEffect(() => {
    if (!isServerConfigured) return;

    listMyInquiries()
      .then((response) => setMine(response.inquiries))
      // 지난 문의를 못 불러와도 새로 보내는 것은 된다.
      .catch(() => undefined);
  }, [acknowledgement]);

  const rule = INQUIRY_CATEGORY_RULES[category];
  const ready = canSubmitInquiry({
    category,
    body,
    hasSubject: subject !== undefined,
    hasReplyRoute: true,
  });

  async function submit() {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);

    try {
      const received = await createInquiry({
        category,
        body: body.trim(),
        ...(subject && { subject }),
        ...(contact.trim() && { contact: contact.trim() }),
      });

      setAcknowledgement(received.acknowledgement);
      setBody('');
      setContact('');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (acknowledgement) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            <ThemedText type="subtitle">보냈어요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {acknowledgement}
            </ThemedText>
            <ActionButton
              variant="primary"
              label="확인"
              onPress={() => setAcknowledgement(null)}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">문의하기</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              사람이 직접 읽고 답해요. 이름이나 주소 없이 보낼 수 있어요.
            </ThemedText>
          </ThemedView>

          {/*
            FAQ를 문의 앞에 둔다. 핸드오프 20번.

            **문의를 줄이려는 것이 아니라, 답이 이미 있는 질문에 하루를 기다리지
            않게 하려는 것이다.** 그래서 답은 사람이 답할 말과 같아야 한다 —
            다르면 문의창구가 FAQ를 부정하는 자리가 된다.
          */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">자주 묻는 것</ThemedText>
            <Accordion
              items={FAQ_ITEMS.map((item) => ({
                key: item.key,
                title: item.question,
                body: item.answer,
              }))}
            />
          </ThemedView>

          {!isServerConfigured ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                이 빌드는 서버에 붙어 있지 않아 문의를 보낼 수 없어요.
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">어떤 이야기인가요</ThemedText>
            <ThemedView style={styles.chips}>
              {INQUIRY_CATEGORIES.map((item) => (
                <FilterChip
                  key={item}
                  role="radio"
                  label={INQUIRY_CATEGORY_RULES[item].label}
                  selected={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary">
              {rule.description}
            </ThemedText>
          </ThemedView>

          {/* 어디서 눌러 들어왔는지 보여준다. 무엇에 대한 문의인지 헷갈리지 않게. */}
          {params.subjectName ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                대상: {params.subjectName}
              </ThemedText>
            </ThemedView>
          ) : null}

          {rule.requiresSubject && !subject ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                이 항목은 어느 대상에 대한 것인지가 있어야 해요. 해당 화면에서 눌러
                들어와주세요.
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">내용</ThemedText>
            <TextInput
              style={[styles.input, styles.body, { color: theme.text, borderColor: theme.border }]}
              value={body}
              onChangeText={setBody}
              multiline
              placeholder="무엇이 잘못되었는지, 무엇을 원하시는지 적어주세요"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="문의 내용"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">답을 받을 곳 (선택)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              비워두시면 이 앱으로 알려드려요. 다른 곳으로 받고 싶으시면 적어주세요.
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={contact}
              onChangeText={setContact}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="이메일 또는 연락처"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="답을 받을 곳"
            />
          </ThemedView>

          {error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ActionButton
              variant="primary"
              label={busy ? '보내는 중…' : '보내기'}
              hint={
                ready
                  ? undefined
                  : rule.requiresSubject && !subject
                    ? '해당 화면에서 눌러 들어와주세요'
                    : '내용을 적어주세요'
              }
              disabled={busy || !ready || !isServerConfigured}
              onPress={submit}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>

          {mine.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">보낸 문의</ThemedText>
              {mine.map((inquiry) => (
                <ThemedView key={inquiry.id} type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">
                    {INQUIRY_CATEGORY_RULES[inquiry.category].label} ·{' '}
                    {INQUIRY_STATUS_LABEL[inquiry.status]}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDateDot(inquiry.receivedAt)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {inquiry.body}
                  </ThemedText>
                  {inquiry.resolution ? (
                    <ThemedText type="small">답변: {inquiry.resolution}</ThemedText>
                  ) : null}
                </ThemedView>
              ))}
            </ThemedView>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Layout.fieldPaddingX,
    paddingVertical: Spacing.two,
    /* 입력 칸 글자도 본문이다. 토큰 밖의 크기를 쓰지 않는다. */
    fontSize: FontSize.t6,
  },
  body: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
