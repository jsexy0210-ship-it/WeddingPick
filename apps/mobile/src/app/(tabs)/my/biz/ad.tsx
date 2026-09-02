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
 * WP-BIZ-005: 광고 문의 화면.
 *
 * 검색 결과 상단 노출 및 광고 게재를 문의한다.
 * 일반 문의(`other` 카테고리)로 접수하며 담당자가 연락한다.
 */
export default function BizAdScreen() {
  const theme = useTheme();
  const [vendorName, setVendorName] = useState('');
  const [adGoal, setAdGoal] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<string | null>(null);

  const canSubmit =
    vendorName.trim().length > 0 && adGoal.trim().length > 0 && contact.trim().length > 0;

  async function submit() {
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);

    const bodyText = [
      `[업체: ${vendorName.trim()}]`,
      `[광고 목적: ${adGoal.trim()}]`,
      websiteUrl.trim() ? `[웹사이트: ${websiteUrl.trim()}]` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const received = await createInquiry({
        category: 'other',
        body: bodyText,
        contact: contact.trim(),
        ...(websiteUrl.trim() ? { evidenceUrl: websiteUrl.trim() } : {}),
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
            <ThemedText type="t6" themeColor="textSecondary">
              담당자가 입력하신 연락처로 연락드려요.
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
            <ThemedText type="t2">광고 문의</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              검색 결과 상단 노출 및 배너 광고를 문의해요. 담당자가 조건을
              안내드려요.
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.notice}>
            <ThemedText type="t6">
              광고 노출은 접수 후 담당자 검토를 거쳐요. 업체 정보와 연락처를 정확히
              입력해주세요.
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
              광고 목적
            </ThemedText>
            <TextInput
              value={adGoal}
              onChangeText={setAdGoal}
              placeholder="상반기 예약 고객 유치, 신규 출점 홍보 등"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, styles.bodyInput, field]}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              웹사이트 (선택)
            </ThemedText>
            <TextInput
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              placeholder="https://www.gaon.co.kr"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, field]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              연락처
            </ThemedText>
            <ThemedText type="t7" themeColor="textAssistive">
              담당자가 이곳으로 연락드려요.
            </ThemedText>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="이메일 또는 전화번호"
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
            label={busy ? '제출 중…' : '문의하기'}
            hint={
              canSubmit
                ? undefined
                : '업체 이름, 광고 목적, 연락처를 입력해주세요'
            }
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
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  notice: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: FontSize.t6,
    minHeight: Layout.rowMinHeight,
  },
  bodyInput: {
    minHeight: 80,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
});
