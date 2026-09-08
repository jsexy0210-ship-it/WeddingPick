import type { CreateVerificationRequest, Quote, QuoteDocument } from '@weddingpick/api-contract';
import {
  REQUIRED_EVIDENCE_KIND,
  VERIFICATION_EVIDENCE_RULES,
  VERIFICATION_LEVEL_RULES,
  requestableLevels,
  withInstrument,
  withSubject,
  type RequestableLevel,
  type VerificationEvidenceKind,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createVerificationRequest, getQuote } from '@/api/client';
import { ActionButton, ErrorView, FilterChip, LoadingView, MaxContentWidth, Spacing, ThemedText, ThemedView, VerificationBadge, useTheme } from '@weddingpick/ui';

/** 화면에 내보낼 문서 이름. 식별자를 그대로 보여주지 않는다. */
function documentLabel(document: QuoteDocument, index: number): string {
  const uploaded = new Date(document.uploadedAt);

  return `${index + 1}번째 문서 · ${uploaded.getMonth() + 1}월 ${uploaded.getDate()}일 올림 · ${document.pageCount}장`;
}

/**
 * A-13 인증 신청.
 *
 * 접수만 한다. 등급은 사람이 증빙을 확인한 뒤에야 오른다(서비스정책서 7번) — 이 화면은
 * 어떤 경우에도 "인증되었습니다"라고 말하지 않는다.
 */
export default function VerifyRequestScreen() {
  const { quoteId } = useLocalSearchParams<{ quoteId: string }>();
  const theme = useTheme();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLevel, setTargetLevel] = useState<RequestableLevel | null>(null);
  const [evidence, setEvidence] = useState<Record<string, VerificationEvidenceKind>>({});
  const [busy, setBusy] = useState(false);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [receivedRequestId, setReceivedRequestId] = useState<string | null>(null);

  useEffect(() => {
    getQuote(quoteId)
      .then((loaded) => {
        setQuote(loaded);
        setTargetLevel(requestableLevels(loaded.verificationLevel)[0] ?? null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [quoteId]);

  async function submit() {
    if (busy || !quote || !targetLevel) return;
    setBusy(true);
    setError(null);

    const items: CreateVerificationRequest['evidence'] = Object.entries(evidence).map(
      ([rawDocumentId, kind]) => ({ rawDocumentId, kind })
    );

    try {
      const received = await createVerificationRequest(quote.id, { targetLevel, evidence: items });
      setReceivedAt(received.receivedAt);
      setReceivedRequestId(received.requestId);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !quote) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!quote) {
    return <LoadingView />;
  }

  if (receivedAt) {
    return (
      <Frame>
        <ThemedText type="subtitle">접수했어요</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          올려주신 자료를 사람이 직접 확인해요. 확인이 끝나면 알려드려요. 확인 전까지
          이 문서의 단계는 그대로예요.
        </ThemedText>
        {receivedRequestId ? (
          <ActionButton
            label="진행 상황 보기"
            hint="접수·심사 중·결과를 확인해요"
            onPress={() => router.push(`/capture/verify-status/${receivedRequestId}` as never)}
          />
        ) : null}
        <ActionButton variant="primary" label="결과로 돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  const levels = requestableLevels(quote.verificationLevel);
  const required = targetLevel ? REQUIRED_EVIDENCE_KIND[targetLevel] : null;
  const chosen = Object.values(evidence);
  const ready = Boolean(targetLevel) && required !== null && chosen.includes(required);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">자료 확인 신청</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              올려주신 자료를 사람이 직접 확인해요. 확인을 마친 자료만 다른 분들의 가격
              비교에 쓰여요.
            </ThemedText>
            <VerificationBadge level={quote.verificationLevel} />
          </ThemedView>

          {!quote.confirmedAt ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                금액과 계약일을 먼저 확인해주세요. 확인이 끝나야 신청할 수 있어요.
              </ThemedText>
              <ActionButton label="결과로 돌아가기" onPress={() => router.back()} />
            </ThemedView>
          ) : levels.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                더 신청할 단계가 없어요. 이미 가장 높은 단계예요.
              </ThemedText>
              <ActionButton label="돌아가기" onPress={() => router.back()} />
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">어느 단계를 신청할까요</ThemedText>
                {levels.map((level) => {
                  const rule = VERIFICATION_LEVEL_RULES[level];
                  const selected = level === targetLevel;

                  return (
                    <Pressable
                      key={level}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setTargetLevel(level)}>
                      <ThemedView
                        type="backgroundElement"
                        style={[
                          styles.card,
                          selected && { borderColor: theme.tint, borderWidth: 2 },
                        ]}>
                        <VerificationBadge level={level} />
                        <ThemedText type="small" themeColor="textSecondary">
                          {rule.condition}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {withSubject(
                            VERIFICATION_EVIDENCE_RULES[REQUIRED_EVIDENCE_KIND[level]].label
                          )}{' '}
                          있어야 해요
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>

              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">어떤 자료인가요</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {required
                    ? `${VERIFICATION_EVIDENCE_RULES[required].description}. 해당하는 문서를 골라주세요.`
                    : ''}
                </ThemedText>

                {quote.documents.length === 0 ? (
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="small" themeColor="textSecondary">
                      올려둔 원본이 없어요. 증빙으로 낼 문서를 먼저 촬영해주세요.
                    </ThemedText>
                  </ThemedView>
                ) : null}

                {quote.documents.map((document, index) => (
                  <ThemedView
                    key={document.rawDocumentId}
                    type="backgroundElement"
                    style={styles.card}>
                    <ThemedText type="small">{documentLabel(document, index)}</ThemedText>

                    {/* 카드 안의 칩 줄 — 배경 상자를 또 두지 않는다(이중 컨테이너 금지). */}
                    <View style={styles.kindRow}>
                      {(
                        Object.keys(VERIFICATION_EVIDENCE_RULES) as VerificationEvidenceKind[]
                      ).map((kind) => (
                        <FilterChip
                          key={kind}
                          role="radio"
                          label={VERIFICATION_EVIDENCE_RULES[kind].label}
                          selected={evidence[document.rawDocumentId] === kind}
                          onPress={() =>
                            setEvidence((current) => {
                              const next = { ...current };

                              if (next[document.rawDocumentId] === kind) {
                                delete next[document.rawDocumentId];
                              } else {
                                next[document.rawDocumentId] = kind;
                              }

                              return next;
                            })
                          }
                        />
                      ))}
                    </View>
                  </ThemedView>
                ))}
              </ThemedView>

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
                  label={busy ? '보내는 중…' : '신청하기'}
                  hint={
                    ready
                      ? '사람이 확인한 뒤에 단계가 올라가요'
                      : required
                        ? `${withInstrument(VERIFICATION_EVIDENCE_RULES[required].label)} 표시한 문서가 한 건 있어야 해요`
                        : undefined
                  }
                  disabled={busy || !ready}
                  onPress={submit}
                />
                <ActionButton label="돌아가기" onPress={() => router.back()} />
              </ThemedView>
            </>
          )}
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
    gap: Spacing.two,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
