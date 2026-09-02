import type { CreatePriceReportRequest } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPriceReport } from '@/api/client';
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

/**
 * 가격 제보. 문서 없이 금액과 조건만 제보한다.
 *
 * 결제 인증(인증 등급 L2 이상)이 아니라 참고용 가격 데이터이므로,
 * 응답의 `caveat`를 제보 완료 화면에서 그대로 보여준다.
 */
export default function PriceReportScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const theme = useTheme();

  const [productName, setProductName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [contractedOn, setContractedOn] = useState('');
  const [guaranteedGuests, setGuaranteedGuests] = useState('');
  const [mealPrice, setMealPrice] = useState('');
  const [includedNote, setIncludedNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [caveat, setCaveat] = useState<string | null>(null);

  async function submit() {
    const trimName = productName.trim();
    const amount = parseInt(totalAmount.replace(/[^0-9]/g, ''), 10);
    const month = contractedOn.trim();

    if (!trimName) {
      Alert.alert('상품명을 적어주세요');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('금액을 숫자로 적어주세요');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      Alert.alert('계약 연월을 YYYY-MM 형식으로 적어주세요', '예: 2025-03');
      return;
    }

    const body: CreatePriceReportRequest = {
      vendorId,
      productName: trimName,
      totalAmount: amount,
      contractedOn: month,
      ...(guaranteedGuests ? { guaranteedGuests: parseInt(guaranteedGuests, 10) } : {}),
      ...(mealPrice ? { mealPricePerPerson: parseInt(mealPrice.replace(/[^0-9]/g, ''), 10) } : {}),
      ...(includedNote.trim() ? { includedNote: includedNote.trim() } : {}),
    };

    setSubmitting(true);
    try {
      const res = await createPriceReport(body);
      setCaveat(res.caveat);
    } catch (err) {
      Alert.alert('제보 실패', (err as Error).message ?? '다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }];

  if (caveat) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="t2">제보 완료</ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="tint">
                알려드릴 사항
              </ThemedText>
              <ThemedText type="t6">{caveat}</ThemedText>
            </ThemedView>
            <ActionButton variant="primary" label="돌아가기" onPress={() => router.back()} />
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.section}>
            <ThemedText type="t2">가격 제보</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              문서 없이 금액과 조건을 알려주시면 같은 업체를 비교하는 분들에게 참고가 돼요.
              제보는 가격 통계에 별도로 표시되며 Pick 인증과는 달라요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">상품명 *</ThemedText>
            <TextInput
              style={inputStyle}
              value={productName}
              onChangeText={setProductName}
              placeholder="예: 본식 스냅 A 패키지"
              placeholderTextColor={theme.textAssistive}
              returnKeyType="next"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">총 금액 (원) *</ThemedText>
            <TextInput
              style={inputStyle}
              value={totalAmount}
              onChangeText={setTotalAmount}
              placeholder="예: 1500000"
              placeholderTextColor={theme.textAssistive}
              keyboardType="numeric"
              returnKeyType="next"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">계약 연월 * (YYYY-MM)</ThemedText>
            <TextInput
              style={inputStyle}
              value={contractedOn}
              onChangeText={setContractedOn}
              placeholder="예: 2025-03"
              placeholderTextColor={theme.textAssistive}
              returnKeyType="next"
              maxLength={7}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">보장 인원 (선택)</ThemedText>
            <TextInput
              style={inputStyle}
              value={guaranteedGuests}
              onChangeText={setGuaranteedGuests}
              placeholder="예: 200"
              placeholderTextColor={theme.textAssistive}
              keyboardType="numeric"
              returnKeyType="next"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">1인 식대 (선택, 원)</ThemedText>
            <TextInput
              style={inputStyle}
              value={mealPrice}
              onChangeText={setMealPrice}
              placeholder="예: 65000"
              placeholderTextColor={theme.textAssistive}
              keyboardType="numeric"
              returnKeyType="next"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">포함 사항 메모 (선택)</ThemedText>
            <TextInput
              style={[inputStyle, styles.textarea]}
              value={includedNote}
              onChangeText={setIncludedNote}
              placeholder="예: 드레스 1회 대여 포함"
              placeholderTextColor={theme.textAssistive}
              multiline
              numberOfLines={3}
            />
          </ThemedView>

          <ThemedView style={styles.actions}>
            <ActionButton label="취소" onPress={() => router.back()} />
            <ActionButton
              variant="primary"
              label={submitting ? '제보 중...' : '제보하기'}
              disabled={submitting}
              onPress={() => void submit()}
            />
          </ThemedView>
        </ScrollView>
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
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  section: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.four, gap: Spacing.two },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.t6,
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.two,
  },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
