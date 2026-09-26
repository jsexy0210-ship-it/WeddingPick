import type { Inquiry } from '@weddingpick/api-contract';
import { INQUIRY_CATEGORY_RULES } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorView, Border, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { getInquiry } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { notifyRefreshFailed, usePullRefresh } from '@/features/refresh/use-pull-refresh';
import { INQUIRY_STATUS_TEXT, inquiryBadgeTone, inquiryMonthDay } from '@/features/settings/inquiry-status';
import { NoteBox, Section, SubScreen, SubScreenStatus } from '@/features/settings/my-kit';

const S = {
  title: '문의 내역',
  mine: '내가 쓴 내용',
  evidence: '함께 보낸 주소',
  answer: '답변',
  waiting: '답변을 준비하고 있어요',
  closed: '처리가 끝난 문의예요',
  loadFailed: '문의를 불러오지 못했어요',
} as const;

/**
 * 지난 문의 상세 — `/my/contact`(WP-MY-008) «지난 문의» 행을 누르면 온다.
 *
 * 2026-09-25 대표 지시 「지난 문의 상세 화면이 없다」. **정본 React_Native에 이 프레임이 없다**
 * (`my.jsx` frame-007 · `my.js` `pastInquiries`는 행까지만 그린다) — DESIGN_SOURCE_NOT_VERIFIED.
 * 같은 파일의 공통 규격만 쓴다: 헤더 56 + 뒤로가기(SubScreen) · 좌우 24(Section) · 상태 배지 badgeS
 * (4 9 · radius 4 · 12/700) · listCard(radius 10 · 1 테두리) · noteBox.
 *
 * 서버(`GET /v1/inquiries/:id`)는 본인 문의만 준다 — 남의 것은 403이다. 답변은 관리자가 적는
 * `resolution` 칸이다.
 */
export default function InquiryDetailScreen() {
  const theme = useTheme();
  const { inquiryId: raw } = useLocalSearchParams<{ inquiryId?: string | string[] }>();
  const inquiryId = Array.isArray(raw) ? raw[0] : raw;
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** `keep` — 당겨서 새로 고침. 보이던 문의는 두고 실패는 토스트로만 알린다. */
  const load = useCallback((keep?: boolean) => {
    if (!inquiryId) return;
    getInquiry(inquiryId)
      .then(setInquiry)
      .catch((caught: Error) => {
        if (keep === true) notifyRefreshFailed();
        else setError(caught.message || S.loadFailed);
      });
  }, [inquiryId]);

  useEffect(() => load(), [load]);
  const pull = usePullRefresh(useCallback(() => load(true), [load]));

  const retry = () => {
    setError(null);
    load();
  };

  if (!inquiryId) return <SubScreenStatus title={S.title}><ErrorView message={S.loadFailed} /></SubScreenStatus>;
  if (error) return <SubScreenStatus title={S.title}><ErrorView message={error} onRetry={retry} /></SubScreenStatus>;
  if (inquiry === null) return <SubScreenStatus title={S.title}><DelayedLoadingView /></SubScreenStatus>;

  const tone = inquiryBadgeTone(theme, inquiry.status);
  const pending = inquiry.status === 'received' || inquiry.status === 'in_review';

  return (
    <SubScreen title={S.title} refreshControl={pull.refreshControl}>
      {/* 유형 · 상태 배지 · 보낸 날짜. */}
      <Section>
        <View style={styles.headRow}>
          <ThemedText type="f18" numberOfLines={1} style={[styles.bold, styles.grow]}>
            {INQUIRY_CATEGORY_RULES[inquiry.category].label}
          </ThemedText>
          <View style={[styles.stateBadge, { backgroundColor: tone.background }]}>
            <ThemedText type="f12" style={[styles.bold, { color: tone.text }]}>
              {INQUIRY_STATUS_TEXT[inquiry.status]}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="f13" themeColor="textAssistive" numeric>
          {`${inquiryMonthDay(inquiry.receivedAt)} 보냄`}
        </ThemedText>
      </Section>

      <Section title={S.mine}>
        <View style={[styles.listCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ThemedText type="f15">{inquiry.body}</ThemedText>
        </View>
      </Section>

      {inquiry.evidenceUrl ? (
        <Section title={S.evidence}>
          <ThemedText type="f14" themeColor="textSecondary" selectable>
            {inquiry.evidenceUrl}
          </ThemedText>
        </Section>
      ) : null}

      <Section title={S.answer}>
        {inquiry.resolution ? (
          <NoteBox
            title={inquiry.resolution}
            body={inquiry.decidedAt ? `${inquiryMonthDay(inquiry.decidedAt)} 답변` : undefined}
          />
        ) : (
          <NoteBox title={pending ? S.waiting : S.closed} />
        )}
      </Section>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap },
  grow: { flex: 1, minWidth: 0 },
  bold: { fontWeight: 700 },
  /* 정본 badgeS — 4 9 · radius 4 · 12/700(지난 문의 행과 같다). */
  stateBadge: { paddingHorizontal: 9, paddingVertical: Spacing.one, borderRadius: Radius.badge },
  /* 정본 listCard — radius 10 · 1 테두리 · 안쪽 16. */
  listCard: { borderWidth: Border.hairline, borderRadius: Radius.medium, padding: Spacing.three },
});
