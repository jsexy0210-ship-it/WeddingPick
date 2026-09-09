import { router } from 'expo-router';
import { useState } from 'react';
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
import { createInquiry } from '@/api/client';
import { isServerConfigured } from '@/api/config';

/**
 * WP-BIZ-003: 업체 자료 제공 화면.
 *
 * 업체 관계자가 업체 정보를 추가하거나 잘못된 내용을 수정 요청한다.
 * `data_correction` 문의 카테고리로 접수한다.
 */
export default function BizDataScreen() {
  const theme = useTheme();
  const [vendorName, setVendorName] = useState('');
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<string | null>(null);

  const canSubmit = vendorName.trim().length > 0 && body.trim().length > 0;

  async function submit() {
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const received = await createInquiry({
        category: 'data_correction',
        body: `[업체: ${vendorName.trim()}]\n\n${body.trim()}`,
        ...(contact.trim() && { contact: contact.trim() }),
      });
      setAcknowledgement(received.acknowledgement);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '제출하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  const field = {
    backgroundColor: theme.backgroundSelected,
    color: theme.text,
    borderRadius: Radius.input,
  };

  if (acknowledgement) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            <ThemedText type="t2">접수했어요</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {acknowledgement}
            </ThemedText>
            <ActionButton variant="primary" label="확인" onPress={() => router.back()} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">자료 제공</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              업체 정보를 추가하거나 잘못된 내용을 알려주시면 사람이 직접 확인해요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              업체 이름
            </ThemedText>
            <TextInput
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="가온홀"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, field]}
              autoCorrect={false}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              제공할 내용
            </ThemedText>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="추가하거나 수정이 필요한 내용을 적어주세요"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, styles.body, field]}
              multiline
              textAlignVertical="top"
              maxLength={4000}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              답을 받을 곳 (선택)
            </ThemedText>
            <ThemedText type="t7" themeColor="textAssistive">
              비워두시면 앱으로 알려드려요.
            </ThemedText>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="이메일 또는 연락처"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, field]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </ThemedView>

          {!isServerConfigured ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" themeColor="textSecondary">
                이 빌드는 서버에 붙어 있지 않아 제출할 수 없어요.
              </ThemedText>
            </ThemedView>
          ) : null}

          {error ? (
            <ThemedText type="t6" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}

          <ActionButton
            variant="primary"
            label={busy ? '제출 중…' : '제출하기'}
            hint={canSubmit ? undefined : '업체 이름과 내용을 입력해주세요'}
            disabled={busy || !canSubmit || !isServerConfigured}
            onPress={() => void submit()}
          />
          <ActionButton label="돌아가기" onPress={() => router.back()} />
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
  header: {
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    paddingHorizontal: Layout.fieldPaddingX,
    paddingVertical: Spacing.three,
    fontSize: FontSize.t6,
    minHeight: Layout.rowMinHeight,
  },
  body: {
    minHeight: 140,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
});
