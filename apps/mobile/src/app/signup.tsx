import type { SignupState } from '@weddingpick/api-contract';
import { CONSENT_INTRO, MINIMUM_AGE } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completeSignup, getCurrentUser, getSignupState } from '@/api/client';
import { completeAfterSignIn } from '@/features/auth/after-sign-in';
import { nextAfterSignIn } from '@/features/auth/finish-sign-in';
import {
  ActionButton,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 가입 완료. 통합정책 v3.13 §N.
 *
 * 로그인 다음에 오는 화면이다. 소셜 로그인이 성공해도 여기를 지나기 전에는 계정이
 * 살아 있지 않고, 서버가 다른 경로를 전부 막는다.
 *
 * **선택 항목을 미리 켜두지 않는다**(§N-2). 켜둔 채로 내려보내면 사용자가 끄는
 * 것을 잊는 쪽에 걸어두는 것이고, 그렇게 받은 동의는 사용자가 한 것이 아니다.
 * 그래서 `전체 동의` 단추도 두지 않았다 — 그 단추는 선택 항목을 필수와 함께
 * 삼키는 가장 흔한 방법이다.
 *
 * 생년월일은 서버가 나이를 세는 데만 쓰고 저장하지 않는다. 화면도 그 사실을 적는다.
 */
export default function SignupScreen() {
  const theme = useTheme();
  const [state, setState] = useState<SignupState | null>(null);
  const [birth, setBirth] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSignupState()
      .then((loaded) => {
        if (loaded.activated) {
          router.replace('/');

          return;
        }

        setState(loaded);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : '가입 상태를 불러오지 못했어요.');
      });
  }, []);

  function toggle(item: string) {
    setChecked((current) =>
      current.includes(item) ? current.filter((one) => one !== item) : [...current, item]
    );
  }

  const missing = (state?.items ?? []).filter(
    (item) => item.required && !checked.includes(item.item)
  );
  const ready = (state?.birthDateVerified || birth.length === 10) && missing.length === 0;

  async function submit() {
    if (busy || !ready) return;

    setBusy(true);
    setError(null);

    try {
      await completeSignup({
        birthDate: state?.birthDateVerified ? undefined : birth,
        consents: checked,
      });

      /*
       * 가입이 끝나야 기기에 적어둔 예식일과 멈춰둔 Pick이 올라간다. 그 전에는
       * 서버가 막아서 실패하고, 실패하면 적어둔 값이 못 올린 값으로 보인다.
       */
      const after = await completeAfterSignIn();
      const me = await getCurrentUser().catch(() => null);

      /*
       * 여기서 `'/'`로 굳어 있었다. 그래서 가입을 마치면 온보딩을 건너뛰고 홈으로
       * 갔고, 예식일·지역·예산·분위기를 한 번도 묻지 않았다. 로그인 경로와 같은
       * 결정을 쓴다(`nextAfterSignIn`).
       */
      router.replace(nextAfterSignIn({ setupComplete: me?.setupComplete, savedWedding: after.savedWedding }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '가입을 마치지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="title">가입 마무리</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {CONSENT_INTRO}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">생년월일</ThemedText>
            {!state?.birthDateVerified ? (
              <TextInput
                value={birth}
                onChangeText={setBirth}
                placeholder="2000-01-01"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {state?.birthDateVerified
                ? '네이버에서 확인한 정보라 다시 입력하지 않아도 돼요'
                : `만 ${MINIMUM_AGE}세부터 이용할 수 있어요. 나이를 확인하는 데만 써요`}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">필수 동의</ThemedText>
            {(state?.items ?? [])
              .filter((item) => item.required)
              .map((item) => (
                <ConsentRow
                  key={item.item}
                  label={item.label}
                  on={checked.includes(item.item)}
                  onPress={() => toggle(item.item)}
                />
              ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">선택 동의</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              동의하지 않아도 가입할 수 있어요
            </ThemedText>
            {(state?.items ?? [])
              .filter((item) => !item.required)
              .map((item) => (
                <ConsentRow
                  key={item.item}
                  label={item.label}
                  on={checked.includes(item.item)}
                  onPress={() => toggle(item.item)}
                />
              ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            {error ? (
              <ThemedText type="small" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}
            <ActionButton
              variant="primary"
              label="가입 마치기"
              disabled={!ready || busy}
              onPress={submit}
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * 동의 한 줄.
 *
 * 필수와 선택이 같은 모양이다. 필수만 눈에 띄게 만들면 선택은 딸려오는 것처럼
 * 보이고, 그러면 무엇을 고른 것인지 흐려진다. 갈라놓는 것은 모양이 아니라 자리다.
 */
function ConsentRow({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={[styles.row, { borderColor: on ? theme.tint : theme.border }]}>
      <ThemedView
        style={[
          styles.box,
          { borderColor: on ? theme.tint : theme.border },
          on && { backgroundColor: theme.tint },
        ]}
      />
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  /*
   * 네모다. `Radius.small`(10)을 18px 상자에 주면 동그라미가 되고, 동그라미는
   * 하나만 고르는 자리로 읽힌다. 여기는 여러 개를 고르는 자리다.
   */
  box: { width: 18, height: 18, borderWidth: 2, borderRadius: Spacing.one },
});
