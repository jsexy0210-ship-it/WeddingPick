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
import { ScrollView, StyleSheet, View } from 'react-native';

import { createVerificationRequest, getQuote } from '@/api/client';
import { formatMonthDayDot } from '@/features/common/format-date';
import { ErrorView, FilterChip, Layout, Radius, Spacing, ThemedText, VerificationBadge, useTheme } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  Dock,
  DockButton,
  Hero,
  InfoCard,
  ListRow,
  NavBar,
  NoteCard,
  RadioDot,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/** 화면에 내보낼 문서 이름. 식별자를 그대로 보여주지 않는다. */
function documentLabel(document: QuoteDocument, index: number): string {
  return `${index + 1}번째 문서 · ${formatMonthDayDot(document.uploadedAt)} 올림 · ${document.pageCount}장`;
}

/**
 * 자료 확인 신청. 견적서 정리 결과의 확인 단계를 올리는 흐름.
 *
 *   nav     «자료 확인 신청»
 *   hero    «어느 단계를 신청할까요?» · 현재 단계 배지
 *   단계     라디오 24 · 단계 배지 · 조건 · 필요한 자료
 *   자료     문서마다 칩으로 어떤 자료인지 고른다
 *   dock    «신청하기»
 *
 * 접수만 한다. 단계는 사람이 증빙을 확인한 뒤에야 오른다 — 이 화면은 어떤 경우에도
 * «인증되었습니다»라고 말하지 않는다.
 */
export default function VerifyRequestScreen() {
  const { quoteId } = useLocalSearchParams<{ quoteId: string }>();
  const theme = useTheme();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLevel, setTargetLevel] = useState<RequestableLevel | null>(null);
  const [evidence, setEvidence] = useState<Record<string, VerificationEvidenceKind>>({});
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState<{ at: string; requestId: string | null } | null>(null);

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

    const items: CreateVerificationRequest['evidence'] = Object.entries(evidence).map(([rawDocumentId, kind]) => ({
      rawDocumentId,
      kind,
    }));

    try {
      const result = await createVerificationRequest(quote.id, { targetLevel, evidence: items });

      setReceived({ at: result.receivedAt, requestId: result.requestId });
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
    return <DelayedLoadingView />;
  }

  if (received) {
    return (
      <Screen>
        <NavBar title="자료 확인 신청" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero title="접수했어요" sub="올려주신 자료를 사람이 직접 확인해요. 확인이 끝나면 알려드려요." />
          <View style={styles.cards}>
            <InfoCard label="지금" value="확인 전까지 이 문서의 단계는 그대로예요" />
            <InfoCard label="다음" value="확인이 끝나면 알림으로 알려드려요" />
          </View>
        </ScrollView>
        <Dock>
          {received.requestId ? (
            <DockButton
              label="진행 상황 보기"
              onPress={() => router.push(`/capture/verify-status/${received.requestId}` as never)}
            />
          ) : null}
          <DockButton variant="primary" label="결과로 돌아가기" onPress={() => router.back()} />
        </Dock>
      </Screen>
    );
  }

  const levels = requestableLevels(quote.verificationLevel);
  const required = targetLevel ? REQUIRED_EVIDENCE_KIND[targetLevel] : null;
  const chosen = Object.values(evidence);
  const ready = Boolean(targetLevel) && required !== null && chosen.includes(required);
  const blocked = !quote.confirmedAt
    ? '금액과 계약일을 먼저 확인해주세요. 확인이 끝나야 신청할 수 있어요.'
    : levels.length === 0
      ? '더 신청할 단계가 없어요. 이미 가장 높은 단계예요.'
      : null;

  return (
    <Screen>
      <NavBar title="자료 확인 신청" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title="어느 단계를 신청할까요?" sub="확인을 마친 자료만 다른 분들의 가격 비교에 쓰여요">
          <View style={styles.badgeRow}>
            <VerificationBadge level={quote.verificationLevel} />
          </View>
        </Hero>

        {blocked ? (
          <View style={styles.noteWrap}>
            <NoteCard title="지금은 신청할 수 없어요" body={blocked} />
          </View>
        ) : (
          <>
            <Section label="신청할 단계">
              {levels.map((level) => {
                const rule = VERIFICATION_LEVEL_RULES[level];

                return (
                  <ListRow
                    key={level}
                    left={<RadioDot on={level === targetLevel} />}
                    title={rule.label}
                    titleBold={level === targetLevel}
                    sub={`${rule.condition} · ${withSubject(VERIFICATION_EVIDENCE_RULES[REQUIRED_EVIDENCE_KIND[level]].label)} 있어야 해요`}
                    onPress={() => setTargetLevel(level)}
                    accessibilityLabel={`${rule.label} ${level === targetLevel ? '선택됨' : ''}`}
                  />
                );
              })}
            </Section>

            <Section label="어떤 자료인가요">
              {quote.documents.length === 0 ? (
                <ListRow title="올려둔 원본이 없어요" titleColor="textAssistive" sub="증빙으로 낼 문서를 먼저 촬영해주세요" />
              ) : (
                quote.documents.map((document, index) => (
                  <View key={document.rawDocumentId} style={[styles.docCard, { borderColor: theme.track }]}>
                    <ThemedText type="t6">{documentLabel(document, index)}</ThemedText>
                    <View style={styles.chips}>
                      {(Object.keys(VERIFICATION_EVIDENCE_RULES) as VerificationEvidenceKind[]).map((kind) => (
                        <FilterChip
                          key={kind}
                          role="radio"
                          label={VERIFICATION_EVIDENCE_RULES[kind].label}
                          selected={evidence[document.rawDocumentId] === kind}
                          onPress={() =>
                            setEvidence((current) => {
                              const next = { ...current };

                              if (next[document.rawDocumentId] === kind) delete next[document.rawDocumentId];
                              else next[document.rawDocumentId] = kind;

                              return next;
                            })
                          }
                        />
                      ))}
                    </View>
                  </View>
                ))
              )}
            </Section>

            {required ? (
              <View style={styles.noteWrap}>
                <NoteCard title="필요한 자료" body={`${VERIFICATION_EVIDENCE_RULES[required].description}. 해당하는 문서를 골라주세요.`} />
              </View>
            ) : null}
          </>
        )}

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <Dock
        note={
          !blocked && !ready && required
            ? `${withInstrument(VERIFICATION_EVIDENCE_RULES[required].label)} 표시한 문서가 한 건 있어야 해요`
            : null
        }>
        {blocked ? (
          <DockButton variant="primary" label="결과로 돌아가기" onPress={() => router.back()} />
        ) : (
          <DockButton
            variant="primary"
            label={busy ? '보내는 중…' : '신청하기'}
            disabled={busy || !ready}
            onPress={() => void submit()}
          />
        )}
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  badgeRow: { flexDirection: 'row', paddingTop: Spacing.one },
  cards: { paddingHorizontal: Layout.gutter, gap: Layout.rowPaddingY },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  /* 문서 카드 — radius 10 · 테두리 1 · padding 18 20 · gap 10. 칩 줄에 배경 상자를 또 두지 않는다. */
  docCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingVertical: Layout.cardPadding - Spacing.half,
    paddingHorizontal: Layout.cardPadding,
    gap: Layout.cardGap,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
});
