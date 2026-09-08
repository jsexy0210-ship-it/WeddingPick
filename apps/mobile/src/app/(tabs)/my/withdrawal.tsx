import type { WithdrawalNotice } from '@weddingpick/api-contract';
import {
  WITHDRAWAL_ANONYMOUS_BADGE,
  WITHDRAWAL_CANCEL,
  WITHDRAWAL_CONSENT,
  WITHDRAWAL_DELETED_GROUP,
  WITHDRAWAL_DONE_BODY,
  WITHDRAWAL_DONE_GROUP,
  WITHDRAWAL_DONE_TITLE,
  WITHDRAWAL_HEADLINE,
  WITHDRAWAL_IRREVERSIBLE,
  WITHDRAWAL_SEPARATED_EMPTY,
  WITHDRAWAL_SEPARATED_GROUP,
  WITHDRAWAL_SEPARATED_NOTE,
  WITHDRAWAL_SHEET_BODY,
  WITHDRAWAL_SHEET_TITLE,
  WITHDRAWAL_SUBMIT,
  WITHDRAWAL_TITLE,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { getWithdrawalNotice, withdraw } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { wipeDevice } from '@/api/session';

/**
 * 회원탈퇴. 디자인 핸드오프 WP-MY-008.
 *
 * **지워지는 것과 분리되는 것을 나눠 적는다.** 탈퇴는 개인정보 삭제이지 서비스
 * 정보 삭제가 아니고, 그 차이를 누르기 전에 말하지 않으면 동의를 받은 것이 아니라
 * 오해를 받은 것이 된다.
 *
 * **개수를 화면이 짐작하지 않는다.** 줄은 서버가 세어 보낸다 — 문구가 이용약관
 * 제12조·개인정보처리방침과 같은 말을 해야 하는데, 화면마다 조립하면 갈라진다.
 *
 * 완료 화면에 성공 모션을 넣지 않는다. 축하할 일이 아니다.
 */
export default function WithdrawalScreen() {
  const theme = useTheme();
  const [notice, setNotice] = useState<WithdrawalNotice | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    void getWithdrawalNotice()
      .then(setNotice)
      .catch(() => setToast('탈퇴 안내를 불러오지 못했어요'));
  }, []);

  useEffect(load, [load]);

  function confirm() {
    // 되돌릴 수 없는 행동이라 한 번 더 묻는다. 버튼 위계를 뒤집지 않는다.
    confirmAlert(WITHDRAWAL_SHEET_TITLE, WITHDRAWAL_SHEET_BODY, [
      { text: '취소', style: 'cancel' },
      { text: WITHDRAWAL_SUBMIT, style: 'destructive', onPress: () => void submit() },
    ]);
  }

  async function submit() {
    setSending(true);

    await withdraw()
      .then(async (result) => {
        /*
         * 서버가 계정·세션을 지운 **그 자리에서** 기기도 비운다 — 「확인」을
         * 기다리지 않는다. 완료 화면에서 앱을 닫아도 토큰·기억된 계정·초안이
         * 남지 않는다. 다음에 열면 로그인부터 다시, 즉 다시 가입이다.
         */
        await wipeDevice();
        setDone(result.done);
      })
      .catch(() => setToast('탈퇴하지 못했어요. 잠시 뒤에 다시 시도해주세요'))
      .finally(() => setSending(false));
  }

  if (done) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="t2">{WITHDRAWAL_DONE_TITLE}</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {WITHDRAWAL_DONE_BODY}
            </ThemedText>

            <View style={[styles.card, { borderColor: theme.border }]}>
              <ThemedText type="t5">{WITHDRAWAL_DONE_GROUP}</ThemedText>
              {done.map((line) => (
                <ThemedText key={line} type="t6">
                  {line}
                </ThemedText>
              ))}
            </View>

            <View style={[styles.card, { borderColor: theme.border }]}>
              <ThemedText type="t5">문의가 필요하면</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                웨딩픽 웹사이트 고객지원으로 연락해주세요. 처리 내역을 확인해드려요.
              </ThemedText>
            </View>

            <ActionButton
              label="확인"
              onPress={() => {
                // 서버 세션도 기기도 이미 비었다. 로그인 화면으로 — 다시 가입해야 쓴다.
                router.replace('/login');
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">{WITHDRAWAL_HEADLINE}</ThemedText>
          {notice ? (
            <ThemedText type="t6" themeColor="textSecondary">
              {notice.lead}
            </ThemedText>
          ) : null}

          <View style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText type="t5">{WITHDRAWAL_DELETED_GROUP}</ThemedText>
            {notice?.deleted.map((row) => (
              <View key={row.label} style={styles.row}>
                <ThemedText type="t6">{row.label}</ThemedText>
                <ThemedText type="t6" themeColor={row.empty ? 'textAssistive' : 'text'}>
                  {row.value}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText type="t5">{WITHDRAWAL_SEPARATED_GROUP}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {WITHDRAWAL_SEPARATED_NOTE}
            </ThemedText>

            {notice && notice.separated.length === 0 ? (
              <ThemedText type="t6" themeColor="textSecondary">
                {WITHDRAWAL_SEPARATED_EMPTY}
              </ThemedText>
            ) : null}

            {notice?.separated.map((row) => (
              <View key={row.label} style={styles.keptRow}>
                <View style={styles.keptText}>
                  <ThemedText type="t6">{row.label}</ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary">
                    {row.note}
                  </ThemedText>
                </View>
                {row.anonymous ? (
                  <View style={[styles.badge, { borderColor: theme.border }]}>
                    <ThemedText type="t7" themeColor="textSecondary">
                      {WITHDRAWAL_ANONYMOUS_BADGE}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.notice}>
            <ThemedText type="t6">{WITHDRAWAL_TITLE}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {WITHDRAWAL_IRREVERSIBLE}
            </ThemedText>
          </View>

          {/*
            동의 없이는 누를 수 없다. 되돌릴 수 없는 행동에서 한 번 더 멈추게 하는
            자리이고, 그 문장을 읽었다는 표시이기도 하다.
          */}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            onPress={() => setAgreed((was) => !was)}
            style={styles.consent}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: agreed ? theme.tint : theme.border },
                agreed && { backgroundColor: theme.tint },
              ]}
            />
            <ThemedText type="t6">{WITHDRAWAL_CONSENT}</ThemedText>
          </Pressable>

          <ActionButton label={WITHDRAWAL_CANCEL} onPress={() => router.back()} />
          <ActionButton
            label={WITHDRAWAL_SUBMIT}
            variant="secondary"
            disabled={!agreed || !notice || sending}
            onPress={confirm}
          />
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    gap: Spacing.three,
    padding: Layout.gutter,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  keptRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  keptText: { flex: 1, gap: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  notice: { gap: 4 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderRadius: Radius.small },
});
