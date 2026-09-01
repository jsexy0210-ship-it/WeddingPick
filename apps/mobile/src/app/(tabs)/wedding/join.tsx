import type { InvitePreviewResponse } from '@weddingpick/api-contract';
import { inviteCodeFromLink } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptWeddingInvite, previewWeddingInvite } from '@/api/client';
import {
  ActionButton,
  FontSize,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * A-18 초대 받아들이기.
 *
 * 연결의 나머지 한쪽 동의다. **받아들이기 전에 무엇에 동의하는지 먼저 보여준다** —
 * 동의는 무엇에 동의하는지 알 때만 동의다. 그래서 코드를 넣으면 바로 연결되지 않고
 * 공유 범위를 한 번 거친다.
 */
export default function JoinScreen() {
  const theme = useTheme();
  /*
   * 링크로 들어온 경우 코드가 여기 실려 온다 (weddingpick://join?code=...).
   *
   * 채워만 두고 자동으로 연결하지는 않는다. 링크를 눌렀다는 것이 공유 범위에
   * 동의했다는 뜻은 아니다 — 무엇에 동의하는지 보여주는 단계는 그대로 거친다.
   */
  const params = useLocalSearchParams<{ code?: string }>();
  /*
   * 손으로 넣은 값. 아직 아무것도 넣지 않았으면 null이고, 그때는 링크로 실려 온
   * 코드를 쓴다. state를 링크에 맞춰 되돌리는 대신 이렇게 두면, 화면이 떠 있는
   * 동안 다른 링크로 다시 들어와도 알아서 따라간다.
   */
  const [typed, setTyped] = useState<string | null>(null);
  const code = typed ?? params.code?.trim() ?? '';
  const [preview, setPreview] = useState<InvitePreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function check() {
    if (busy || code.trim().length === 0) return;
    setBusy(true);
    setError(null);

    try {
      setPreview(await previewWeddingInvite(code.trim()));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await acceptWeddingInvite(code.trim());
      setJoined(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return (
      <Frame>
        <ThemedText type="subtitle">연결했습니다</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          이제 두 분이 같은 자료와 비교 결과를 봅니다.
        </ThemedText>
        <ActionButton variant="primary" label="내 웨딩 보기" onPress={() => router.push('/wedding')} />
      </Frame>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">초대 코드 넣기</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              배우자에게 받은 코드를 넣어주세요. 무엇이 공유되는지 보고 나서 결정하실 수
              있습니다.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={code}
              onChangeText={(text) => {
                // 링크를 통째로 붙여넣는 사람이 많다. 그럴 때 "코드가 아닙니다"라고
                // 되돌려주는 대신 코드를 꺼내 쓴다.
                setTyped(inviteCodeFromLink(text.trim()) ?? text);
                setPreview(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="초대 코드"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="초대 코드"
            />
            <ActionButton
              label={busy ? '확인 중…' : '확인하기'}
              disabled={busy || code.trim().length === 0}
              onPress={check}
            />
          </ThemedView>

          {preview && !preview.usable ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {preview.message}
              </ThemedText>
            </ThemedView>
          ) : null}

          {preview?.usable ? (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">함께 보게 되는 것</ThemedText>
                {preview.shared.map((item) => (
                  <ThemedView key={item} type="backgroundElement" style={styles.card}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item}
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>

              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">공유하지 않는 것</ThemedText>
                {preview.notShared.map((item) => (
                  <ThemedView key={item} type="backgroundElement" style={styles.card}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item}
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>

              <ActionButton
                variant="primary"
                label={busy ? '연결 중…' : '이대로 연결하기'}
                hint="연결한 뒤에도 어느 쪽이든 끊을 수 있습니다"
                disabled={busy}
                onPress={join}
              />
            </>
          ) : null}

          {error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
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
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    /* 입력 칸 글자도 본문이다. 토큰 밖의 크기를 쓰지 않는다. */
    fontSize: FontSize.t6,
  },
});
