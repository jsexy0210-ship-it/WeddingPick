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
import { formatDateDot } from '@/features/common/format-date';
import { BackBar } from '@/components/back-bar';

/**
 * WP-BIZ-004: 업체 혜택 등록 화면.
 *
 * 웨딩픽 이용자에게 제공하는 할인·혜택을 등록한다.
 * 서비스 담당자가 확인 후 게재한다 — 접수 즉시 노출되지 않는다.
 */
export default function BizBenefitScreen() {
  const theme = useTheme();
  const [vendorName, setVendorName] = useState('');
  const [benefitTitle, setBenefitTitle] = useState('');
  const [benefitDetail, setBenefitDetail] = useState('');
  const [period, setPeriod] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<string | null>(null);

  const canSubmit =
    vendorName.trim().length > 0 &&
    benefitTitle.trim().length > 0 &&
    benefitDetail.trim().length > 0;

  async function submit() {
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);

    const bodyText = [
      `[업체: ${vendorName.trim()}]`,
      `[혜택명: ${benefitTitle.trim()}]`,
      benefitDetail.trim(),
      period.trim() ? `[제공 기간: ${period.trim()}]` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const received = await createInquiry({
        category: 'other',
        body: bodyText,
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
          <BackBar />
          <ThemedView style={styles.content}>
            <ThemedText type="t2">접수했어요</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {acknowledgement}
            </ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              담당자 확인 후 게재 여부를 알려드려요.
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
        <BackBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">혜택 등록</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              웨딩픽 사용자를 위한 할인·혜택을 등록해드려요. 담당자가 확인 후
              게재해요.
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.notice}>
            <ThemedText type="t6">
              담당자가 확인한 뒤 게재 여부를 연락드려요.
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
              혜택 제목
            </ThemedText>
            <TextInput
              value={benefitTitle}
              onChangeText={setBenefitTitle}
              placeholder="웨딩픽 사용자 10% 할인"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, field]}
              maxLength={60}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              혜택 상세
            </ThemedText>
            <TextInput
              value={benefitDetail}
              onChangeText={setBenefitDetail}
              placeholder="웨딩픽에서 예약 문의 시 10% 추가 할인, 웨딩픽 앱 캡처 화면 제시 필요"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, styles.bodyInput, field]}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              제공 기간 (선택)
            </ThemedText>
            <TextInput
              value={period}
              onChangeText={setPeriod}
              placeholder={`${formatDateDot('2026-12-31')}까지`}
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, field]}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              연락처 (선택)
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
            label={busy ? '제출 중…' : '등록 요청하기'}
            hint={canSubmit ? undefined : '업체 이름, 혜택 제목, 혜택 상세를 입력해주세요'}
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
    fontSize: FontSize.t6,
    minHeight: Layout.rowMinHeight,
  },
  bodyInput: {
    minHeight: 100,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
});
