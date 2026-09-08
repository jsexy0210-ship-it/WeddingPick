import type { WeddingDetail, WeddingInvite } from '@weddingpick/api-contract';
import {
  PARTNER_NOT_SHARED,
  PARTNER_SHARED,
  PARTNER_UNLINK_EFFECTS,
  inviteShareMessage,
} from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createWeddingInvite,
  ensureWedding,
  getWedding,
  getWeddingInvite,
  revokeWeddingInvite,
  unlinkPartner,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { shareOrCopy } from '@/components/share-or-copy';
import { formatMonthDayTimeDot } from '@/features/common/format-date';
import { ActionButton, ErrorView, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';

/**
 * A-18 배우자 초대·연결.
 *
 * 연결은 양쪽이 각각 동의해야 이뤄진다. 이 화면은 그중 한쪽 — 초대하는 쪽이다.
 * 무엇이 공유되고 무엇이 안 되는지 초대를 만들기 전에 보여준다.
 */
export default function PartnerScreen() {
  const [wedding, setWedding] = useState<WeddingDetail | null>(null);
  const [invite, setInvite] = useState<WeddingInvite | null>(null);
  /** 방금 만든 코드. 서버는 다시 보여줄 수 없어 이 화면을 떠나면 사라진다. */
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!isServerConfigured) return;

    // await 뒤에 setState가 오게 둔다 — 효과 안에서 곧바로 상태를 바꾸지 않는다.
    try {
      const weddingId = await ensureWedding();
      const [detail, current] = await Promise.all([
        getWedding(weddingId),
        getWeddingInvite(weddingId),
      ]);

      setWedding(detail);
      setInvite(current.invite);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  // 초대를 받아들이고 돌아왔을 수도 있다. 화면이 다시 보일 때마다 확인한다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function makeInvite() {
    if (busy || !wedding) return;
    setBusy(true);
    setError(null);

    try {
      const created = await createWeddingInvite(wedding.id);

      setCode(created.code);
      setInvite({
        inviteId: created.inviteId,
        expiresAt: created.expiresAt,
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!code) return;

    // 링크와 코드를 함께 보낸다. 앱이 깔린 사람은 한 번에 열리고, 아닌 사람은
    // 코드를 손으로 넣는다. 공유 시트가 없는 환경(주로 데스크톱 웹)에서는
    // 클립보드 복사로 대신한다.
    const result = await shareOrCopy(inviteShareMessage(code));
    if (result.copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function revoke() {
    if (busy || !wedding || !invite) return;
    setBusy(true);

    try {
      await revokeWeddingInvite(wedding.id, invite.inviteId);
      setInvite(null);
      setCode(null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (busy || !wedding) return;
    setBusy(true);

    try {
      await unlinkPartner(wedding.id);
      setConfirmingUnlink(false);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!isServerConfigured) {
    return (
      <ErrorView
        title="배우자와 함께 보기"
        message="이 빌드는 서버에 붙어 있지 않아 연결할 수 없어요."
        onBack={() => router.back()}
      />
    );
  }

  if (!wedding) {
    if (error) {
      return <ErrorView message={error} onBack={() => router.back()} />;
    }

    return <DelayedLoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">배우자와 함께 보기</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              자료와 비교 결과를 함께 보며 결정할 수 있어요. 연결은 양쪽이 각각
              동의해야 이뤄져요.
            </ThemedText>
          </ThemedView>

          {wedding.partnerLinked ? (
            <>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">연결되어 있어요</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  두 분이 같은 자료와 비교 결과를 보고 있어요.
                </ThemedText>
              </ThemedView>

              {confirmingUnlink ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">연결을 끊으면</ThemedText>
                  {PARTNER_UNLINK_EFFECTS.map((effect) => (
                    <ThemedText key={effect} type="small" themeColor="textSecondary">
                      · {effect}
                    </ThemedText>
                  ))}
                  <ActionButton
                    variant="primary"
                    label={busy ? '끊는 중…' : '끊을게요'}
                    disabled={busy}
                    onPress={unlink}
                  />
                  <ActionButton label="그만두기" onPress={() => setConfirmingUnlink(false)} />
                </ThemedView>
              ) : (
                <ActionButton
                  label="연결 끊기"
                  hint="어느 쪽이든 끊을 수 있어요"
                  onPress={() => setConfirmingUnlink(true)}
                />
              )}
            </>
          ) : (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">함께 보게 되는 것</ThemedText>
                {PARTNER_SHARED.map((item) => (
                  <ThemedView key={item} type="backgroundElement" style={styles.card}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item}
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>

              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">공유하지 않는 것</ThemedText>
                {PARTNER_NOT_SHARED.map((item) => (
                  <ThemedView key={item} type="backgroundElement" style={styles.card}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item}
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>

              {code ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">초대 코드</ThemedText>
                  <ThemedText type="default" style={styles.code}>
                    {code}
                  </ThemedText>
                  {/* 서버는 해시만 들고 있어 이 코드를 다시 보여줄 수 없다. */}
                  <ThemedText type="small" themeColor="textSecondary">
                    이 화면을 떠나면 다시 볼 수 없어요. 지금 보내주세요.
                  </ThemedText>
                  {invite ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatMonthDayTimeDot(invite.expiresAt)}까지 쓸 수 있어요.
                    </ThemedText>
                  ) : null}
                  <ActionButton variant="primary" label="배우자에게 보내기" onPress={share} />
                  {copied ? (
                    <ThemedText type="small" themeColor="tint">
                      코드를 복사했어요
                    </ThemedText>
                  ) : null}
                </ThemedView>
              ) : invite ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">보낸 초대가 있어요</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatMonthDayTimeDot(invite.expiresAt)}까지 쓸 수 있어요. 코드는 다시 보여드릴
                    수 없어, 잃어버리셨으면 새로 만들어주세요.
                  </ThemedText>
                </ThemedView>
              ) : null}

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
                  label={busy ? '만드는 중…' : invite ? '새 초대 만들기' : '초대 만들기'}
                  hint={invite ? '새로 만들면 먼저 보낸 초대는 쓸 수 없게 돼요' : undefined}
                  disabled={busy}
                  onPress={makeInvite}
                />
                {invite ? (
                  <ActionButton label="초대 취소하기" disabled={busy} onPress={revoke} />
                ) : null}
                <ActionButton
                  label="초대 코드를 받았어요"
                  onPress={() => router.push('/wedding/join')}
                />
              </ThemedView>
            </>
          )}

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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  code: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
