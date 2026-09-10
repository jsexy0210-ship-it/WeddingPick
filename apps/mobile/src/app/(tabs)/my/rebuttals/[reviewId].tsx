import type { MyRebuttal } from '@weddingpick/api-contract';
import {
  REBUTTAL_BODY_HINT,
  REBUTTAL_HEADLINE,
  REBUTTAL_REVIEW_NOTICE,
  REBUTTAL_ROLE_HINT,
  checkRebuttal,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  FontSize,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { createRebuttal, listMyRebuttals, updateRebuttal } from '@/api/client';
import { BackBar } from '@/components/back-bar';

/**
 * 업체 반론 등록. 디자인 핸드오프 20번.
 *
 * 이미 낸 반론이 있으면 그것을 고친다. 화면을 둘로 나누지 않는 이유는, 한 후기에
 * 반론이 하나뿐이라 **쓰기와 고치기가 사실상 같은 일**이기 때문이다.
 */
export default function WriteRebuttalScreen() {
  const { reviewId } = useLocalSearchParams<{ reviewId: string }>();
  const theme = useTheme();
  const [existing, setExisting] = useState<MyRebuttal | null>(null);
  const [claimedRole, setClaimedRole] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    void listMyRebuttals()
      .then((response) => {
        const mine = response.rebuttals.find((row) => row.review.id === reviewId) ?? null;

        setExisting(mine);

        if (mine) {
          setClaimedRole(mine.claimedRole);
          setBody(mine.body);
        }
      })
      .catch(() => undefined);
  }, [reviewId]);

  useEffect(load, [load]);

  async function send() {
    const check = checkRebuttal({ claimedRole, body });

    if (!check.ok) {
      setMessage(check.message);
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      if (existing) {
        await updateRebuttal(existing.id, { claimedRole: claimedRole.trim(), body: body.trim() });
      } else {
        await createRebuttal({ reviewId, claimedRole: claimedRole.trim(), body: body.trim() });
      }

      router.replace('/my/rebuttals');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '등록하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  const field = {
    backgroundColor: theme.backgroundSelected,
    color: theme.text,
    borderRadius: Radius.input,
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">{REBUTTAL_HEADLINE}</ThemedText>

          {/*
            * 넣자마자 붙는 줄 알고 기다리면, 안 붙은 것이 고장으로 보인다.
            * 그래서 보내기 전에 먼저 말한다.
            */}
          <ThemedView style={[styles.notice, { backgroundColor: theme.tintSubtle }]}>
            <ThemedText type="t6" themeColor="tint">
              {REBUTTAL_REVIEW_NOTICE}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              업체와 어떤 관계인가요
            </ThemedText>
            <TextInput
              value={claimedRole}
              onChangeText={setClaimedRole}
              placeholder={REBUTTAL_ROLE_HINT}
              placeholderTextColor={theme.textAssistive}
              maxLength={60}
              style={[styles.input, field]}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              어떤 부분이 사실과 다른가요
            </ThemedText>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={REBUTTAL_BODY_HINT}
              placeholderTextColor={theme.textAssistive}
              multiline
              style={[styles.input, styles.multiline, field]}
            />
          </ThemedView>

          {message ? (
            <ThemedText type="t6" themeColor="negative">
              {message}
            </ThemedText>
          ) : null}

          <ActionButton
            variant="primary"
            label={existing ? '수정한 내용 보내기' : '반론 보내기'}
            disabled={sending}
            onPress={send}
          />
          <ActionButton label="그만두기" onPress={() => router.back()} />
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
    gap: Spacing.three,
  },
  notice: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    paddingHorizontal: Layout.fieldPaddingX,
    paddingVertical: Spacing.three,
    /* 입력 칸 글자도 본문이다. 토큰 밖의 크기를 쓰지 않는다. */
    fontSize: FontSize.t6,
    minHeight: Layout.rowMinHeight,
  },
  multiline: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
});
