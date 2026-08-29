import type { MyRewardsResponse } from '@weddingpick/api-contract';
import {
  PROMOTION_NOTICE,
  REFERRAL_NOTICE,
  REWARDS,
  REWARD_PAYOUT_NOTICE,
  checkPromotionUrl,
} from '@weddingpick/domain';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { getMyRewards, redeemReferral, submitPromotion } from '@/api/client';

const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

/**
 * 친구초대와 홍보인증. 최종통합정책 v2.0 I장.
 *
 * **금액보다 조건을 먼저 적는다.** 금액부터 보이면 조건이 안 읽히고, 그러면
 * "가입만 하면 3,000원"으로 기억된다 — v2.0 K-7이 폐기한 바로 그 규칙이다.
 *
 * 지급 시점도 약속하지 않는다. 지킬 수 있는 날짜가 정해져 있지 않다.
 */
export default function MyRewardsScreen() {
  const theme = useTheme();
  const [data, setData] = useState<MyRewardsResponse | null>(null);
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    void getMyRewards()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(load, [load]);

  async function shareCode() {
    if (!data) return;

    try {
      /*
       * 공유되는 건 코드와 안내뿐이다. 내 견적·계약 정보는 들어가지 않는다 —
       * 사업계획서 12번.
       */
      await Share.share({
        message: `웨딩픽 초대 코드 ${data.referralCode}\n${REFERRAL_NOTICE}`,
      });
    } catch {
      // 공유 시트를 닫은 경우가 대부분이라 따로 알리지 않는다.
    }
  }

  async function sendCode() {
    setSending(true);
    setMessage(null);

    try {
      await redeemReferral(code.trim().toUpperCase());
      setCode('');
      setMessage('초대 코드를 넣었어요');
      load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '넣지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  async function sendUrl() {
    const check = checkPromotionUrl(url);

    if (!check.ok) {
      setMessage(check.message);
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      await submitPromotion(url.trim());
      setUrl('');
      setMessage('글 주소를 보냈어요. 담당자가 확인한 뒤에 지급 대상이 돼요');
      load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '보내지 못했어요.');
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
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">친구초대</ThemedText>

          {/* 조건이 먼저다. 금액부터 보이면 조건이 안 읽힌다. */}
          <ThemedView style={[styles.notice, { backgroundColor: theme.tintSubtle }]}>
            <ThemedText type="t6" themeColor="tint">
              {REFERRAL_NOTICE}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t7" themeColor="textSecondary">
              내 초대 코드
            </ThemedText>
            <ThemedText type="t2" numeric>
              {data?.referralCode ?? '······'}
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              초대한 분 {data?.invitedCount ?? 0}명 · 조건을 채운 분{' '}
              {data?.qualifiedCount ?? 0}명
            </ThemedText>
          </ThemedView>

          {/*
            카드 안에 두면 카드와 같은 바탕이라 눌리는 것으로 안 보인다.
            렌더해보고 옮겼다.
           */}
          <ActionButton label="코드 공유하기" onPress={() => void shareCode()} />

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              받은 초대 코드가 있으신가요
            </ThemedText>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="ABC234"
              placeholderTextColor={theme.textAssistive}
              autoCapitalize="characters"
              maxLength={6}
              style={[styles.input, field]}
            />
            <ActionButton
              label="코드 넣기"
              disabled={sending || code.trim().length === 0}
              onPress={() => void sendCode()}
            />
          </ThemedView>

          <ThemedText type="t2">홍보인증</ThemedText>

          <ThemedView style={[styles.notice, { backgroundColor: theme.tintSubtle }]}>
            <ThemedText type="t6" themeColor="tint">
              {PROMOTION_NOTICE}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              글 주소
            </ThemedText>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://blog.example.com/..."
              placeholderTextColor={theme.textAssistive}
              autoCapitalize="none"
              keyboardType="url"
              maxLength={500}
              style={[styles.input, field]}
            />
            <ActionButton
              label="글 주소 보내기"
              disabled={sending || url.trim().length === 0}
              onPress={() => void sendUrl()}
            />
          </ThemedView>

          {message ? (
            <ThemedText type="t6" themeColor="tint">
              {message}
            </ThemedText>
          ) : null}

          <ThemedText type="t2">내 보상</ThemedText>

          {data && data.grants.length === 0 ? (
            <ThemedText type="t6" themeColor="textSecondary">
              아직 받으실 보상이 없어요. 친구초대는 {won(REWARDS.referral.amountKrw)}, 홍보인증은{' '}
              {won(REWARDS.promotion.amountKrw)}이에요
            </ThemedText>
          ) : null}

          {(data?.grants ?? []).map((grant) => (
            <ThemedView key={grant.id} type="backgroundElement" style={styles.card}>
              <ThemedView type="backgroundElement" style={styles.cardHead}>
                <ThemedText type="t5">
                  {grant.kindLabel} {won(grant.amountKrw)}
                </ThemedText>
                <ThemedText
                  type="badge"
                  themeColor={grant.status === 'paid' ? 'positive' : 'textAssistive'}>
                  {grant.statusLabel}
                </ThemedText>
              </ThemedView>

              <ThemedText type="t7" themeColor="textSecondary">
                {grant.statusNote}
              </ThemedText>

              {/* 사유는 지급하지 않기로 했을 때만 보여준다. */}
              {grant.status === 'blocked' && grant.decisionNote ? (
                <ThemedText type="t7" themeColor="negative">
                  {grant.decisionNote}
                </ThemedText>
              ) : null}
            </ThemedView>
          ))}

          <ThemedText type="t7" themeColor="textAssistive">
            {REWARD_PAYOUT_NOTICE}
          </ThemedText>
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
  notice: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 15,
    minHeight: Layout.rowMinHeight,
  },
});
