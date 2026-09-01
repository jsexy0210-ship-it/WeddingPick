import { WEDDING_DATE_HINT, dDay, formatWeddingDate, manwon } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completeSetup, listVendorRegions } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import {
  ActionButton,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingCalendar,
  useTheme,
} from '@weddingpick/ui';
import { saveWeddingDraft } from '@/features/onboarding/wedding-draft';

/** 예산 입력은 만원 단위로 받는다. 0을 여덟 개 세는 화면을 만들지 않는다. */
const MANWON = 10_000;

/**
 * 최소 온보딩. 통합정책 v3.10 §3.
 *
 * 받는 것은 **예식일과 지역** 둘이다. 이름은 받지 않는다 — v3.10이 닉네임을 최초
 * 필수입력에서 뺐다. 총예산은 선택이고 `아직 모르겠어요`를 고를 수 있다.
 *
 * **로그인을 요구하지 않는다.** 로그인 전이면 기기에 적어두고 홈으로 보낸다. 첫
 * Pick에서 로그인할 때 그 값이 서버로 올라간다(지연 로그인). 예식일과 지역은
 * 로그인 여부와 상관없이 필요한 값이라, 물어보는 순서를 로그인에 맞추지 않는다.
 */
export default function SetupScreen() {
  const theme = useTheme();
  const [date, setDate] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  /*
   * `null`은 아직 모르는 상태고 `[]`는 없는 상태다. 서버 주소가 없으면 물어볼 곳도
   * 없으니 처음부터 빈 목록으로 시작한다 — 효과 안에서 다시 정하면 첫 그림이
   * 한 번 더 그려진다.
   */
  const [regions, setRegions] = useState<string[] | null>(isServerConfigured ? null : []);
  /** 예산 입력 칸. 빈 칸은 "안 적음"이고, 그것은 `아직 모르겠어요`와 같은 뜻이다. */
  const [budget, setBudget] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  /** 시트에서 고르는 중인 값. 취소하면 버린다. */
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isServerConfigured) {
      return;
    }

    /*
     * 지역 목록은 **업체가 실제로 있는 시도**만 내려온다. 전국 목록을 박아두면
     * 고른 순간부터 빈 화면이 되는 지역이 생긴다.
     */
    listVendorRegions()
      .then((response) => setRegions(response.regions.map((item) => item.name)))
      .catch(() => setRegions([]));
  }, []);

  const budgetAmount = budget.trim() === '' ? null : Number(budget.trim()) * MANWON;
  const budgetValid = budgetAmount === null || (Number.isInteger(budgetAmount) && budgetAmount > 0);
  const ready = date !== null && region !== null && budgetValid;

  async function submit() {
    if (!ready || date === null || region === null) return;

    setSending(true);
    setError(null);

    try {
      const draft = { weddingDate: date, region, budgetAmount };

      /*
       * 로그인 전이면 기기에 적어둔다. 여기서 로그인을 요구하면 최초 실행에
       * 로그인을 강제하는 것이 되고, 그건 v3.10이 없앤 흐름이다.
       */
      if (isServerConfigured && (await loadToken())) {
        await completeSetup(draft);
      } else {
        await saveWeddingDraft(draft);
      }

      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했어요.');
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
            <ThemedText type="t2">언제, 어디서</ThemedText>
            <ThemedText type="t2">결혼하세요?</ThemedText>
          </ThemedView>

          <ThemedView>
            <ThemedText type="t6" themeColor="textSecondary">
              예식일과 지역을 알려주시면
            </ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              그 지역의 확인된 정보로 맞춰드려요.
            </ThemedText>
          </ThemedView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="예식일 선택"
            onPress={() => {
              setPending(date);
              setCalendarOpen(true);
            }}>
            <ThemedView style={[styles.dateCard, { backgroundColor: theme.backgroundSelected }]}>
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

          <ThemedView style={styles.field}>
            <ThemedText type="t6">준비하는 지역</ThemedText>
            {regions === null ? (
              <ThemedText type="t7" themeColor="textAssistive">
                지역을 불러오는 중이에요
              </ThemedText>
            ) : regions.length === 0 ? (
              <ThemedText type="t7" themeColor="textAssistive">
                지금은 지역을 불러올 수 없어요
              </ThemedText>
            ) : (
              <ThemedView style={styles.chips}>
                {regions.map((name) => (
                  <FilterChip
                    key={name}
                    label={name}
                    selected={region === name}
                    onPress={() => setRegion(region === name ? null : name)}
                  />
                ))}
              </ThemedView>
            )}
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t6">총예산</ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
              value={budget}
              onChangeText={(text) => setBudget(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="예: 5000"
              placeholderTextColor={theme.textAssistive}
              accessibilityLabel="총예산 만원"
            />
            <ThemedText type="t7" themeColor={budgetValid ? 'textAssistive' : 'negative'}>
              {/* 안 적어도 넘어간다. 정책이 선택이라고 정했다. */}
              {budgetAmount === null
                ? '만원 단위로 적어요. 아직 모르겠으면 비워둬도 돼요'
                : budgetValid
                  ? manwon(budgetAmount)
                  : '1만원부터 적을 수 있어요. 아직 모르겠으면 비워둬도 돼요'}
            </ThemedText>
          </ThemedView>

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
            label={sending ? '저장하는 중…' : '완료'}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
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
  sheetActions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },
});
