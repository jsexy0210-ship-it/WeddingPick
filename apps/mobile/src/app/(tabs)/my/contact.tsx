import type { Inquiry } from '@weddingpick/api-contract';
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_RULES,
  INQUIRY_STATUS_LABEL,
  canSubmitInquiry,
  type InquiryCategory,
  type InquiryStatus,
} from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createInquiry, listMyInquiries } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { useDepthBack } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { Dock, Hero, NoteBox, Section, SubScreen } from '@/features/settings/my-kit';
import { BackBar } from '@/components/back-bar';
import {
  ActionButton,
  type BadgeKind,
  Border,
  FontSize,
  LineHeight,
  ProductSymbol,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 사용자가 고르는 문의 유형. 플래너 등록·노출 중단 두 가지는 뺀다 — 정본
 * `my.js` `inquiryTypes`(my.jsx frame-007)에 없고, v3.29가 플래너 개념을 화면에서 지웠다.
 * 서버·관리자는 과거 문의를 읽어야 하므로 도메인 목록(`INQUIRY_CATEGORIES`)은 그대로 둔다.
 */
const USER_INQUIRY_CATEGORIES = INQUIRY_CATEGORIES.filter(
  (item) => item !== 'planner_delisting' && item !== 'planner_listing',
);

function isCategory(value: string | undefined): value is InquiryCategory {
  return (USER_INQUIRY_CATEGORIES as readonly string[]).includes(value ?? '');
}

/** 지난 문의 배지 색 — 시안 `p.badge`는 색을 정하지 않는다. 진행/완료/종료를 일반 규칙으로 매핑한다. */
/** 정본 pastInquiries state «답변 완료» — 사용자 화면 문구. 도메인 라벨(관리자 공용)은 그대로 둔다. */
const STATUS_LABEL: Record<InquiryStatus, string> = {
  received: INQUIRY_STATUS_LABEL.received,
  in_review: INQUIRY_STATUS_LABEL.in_review,
  answered: '답변 완료',
  closed: INQUIRY_STATUS_LABEL.closed,
};

const INQUIRY_BADGE_KIND: Record<InquiryStatus, BadgeKind> = {
  received: 'wait',
  in_review: 'wait',
  answered: 'ok',
  closed: 'none',
};

/**
 * 문의 창구.
 *
 * 여러 화면이 "알려주세요"라고 말해왔다. 여기가 그 말을 받는 곳이다.
 *
 * 플래너 상세에서 노출 중단을 누르면 항목과 대상이 채워진 채로 열린다 — 이미 아는 것을
 * 다시 묻지 않는다.
 */
export default function ContactScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    category?: string;
    subjectKind?: 'planner' | 'vendor' | 'quote';
    subjectId?: string;
    subjectName?: string;
  }>();

  const [category, setCategory] = useState<InquiryCategory>(
    isCategory(params.category) ? params.category : 'other'
  );
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<string | null>(null);
  const [mine, setMine] = useState<Inquiry[]>([]);
  // 완료 화면의 「돌아가기」도 Depth Back이다 — 알림·링크로 곧장 들어와도 MY로 올라간다.
  const depthBack = useDepthBack();

  const subject =
    params.subjectKind && params.subjectId
      ? { kind: params.subjectKind, id: params.subjectId }
      : undefined;

  useEffect(() => {
    if (!isServerConfigured) return;

    listMyInquiries()
      .then((response) => setMine(response.inquiries))
      // 지난 문의를 못 불러와도 새로 보내는 것은 된다.
      .catch(() => undefined);
  }, [acknowledgement]);

  const rule = INQUIRY_CATEGORY_RULES[category];
  const ready = canSubmitInquiry({
    category,
    body,
    hasSubject: subject !== undefined,
    hasReplyRoute: true,
  });

  async function submit() {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);

    try {
      const received = await createInquiry({
        category,
        body: body.trim(),
        ...(subject && { subject }),
      });

      setAcknowledgement(received.acknowledgement);
      setBody('');
      showResultToast('문의를 보냈어요');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (acknowledgement) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <BackBar title="문의하기" onBack={depthBack} />
          <ThemedView style={styles.content}>
            <ThemedText type="subtitle">보냈어요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {acknowledgement}
            </ThemedText>
            <ActionButton
              variant="primary"
              label="문의 내역 보기"
              onPress={() => setAcknowledgement(null)}
            />
            <ActionButton label="문의 마치기" onPress={depthBack} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <SubScreen
      title="문의하기"
      onBack={depthBack}
      dock={
        <Dock
          primary={{
            label: busy ? '보내는 중…' : '문의 보내기',
            disabled: busy || !ready || !isServerConfigured,
            onPress: () => void submit(),
          }}
        />
      }>
      {/* 정본 sec «지난 문의 N건» — listCard 안 64 행(질문 15 · 날짜 · 상태 12 muted + 상태 배지 + 꺾쇠). */}
      {mine.length > 0 ? (
        <Section title={`지난 문의 ${mine.length}건`}>
          <View style={[styles.listCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {mine.map((inquiry, index) => (
              <View key={inquiry.id}>
                <View
                  style={[
                    styles.pastRow,
                    index < mine.length - 1 ? { borderBottomWidth: Border.hairline, borderBottomColor: theme.border } : null,
                  ]}>
                  <View style={styles.pastCol}>
                    <ThemedText type="f15" numberOfLines={1}>
                      {inquiry.body}
                    </ThemedText>
                    <ThemedText type="f12" themeColor="textAssistive" numeric numberOfLines={1}>
                      {`${monthDay(inquiry.receivedAt)} · ${STATUS_LABEL[inquiry.status]}`}
                    </ThemedText>
                  </View>
                  {/* 정본 badgeS — 4 9 · radius 4 · 12/700. 공용 Badge(22 · 14)보다 작다. */}
                  <View style={[styles.stateBadge, { backgroundColor: badgeTone(theme, INQUIRY_BADGE_KIND[inquiry.status]).background }]}>
                    <ThemedText type="f12" style={[styles.bold, { color: badgeTone(theme, INQUIRY_BADGE_KIND[inquiry.status]).text }]}>
                      {STATUS_LABEL[inquiry.status]}
                    </ThemedText>
                  </View>
                  <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} />
                </View>
                {/* 정본엔 없는 줄이다 — 답을 보여줄 상세 화면이 아직 없어 여기서 보여준다. */}
                {inquiry.resolution ? (
                  <ThemedText type="f13" themeColor="textAssistive" style={styles.resolution}>
                    답변: {inquiry.resolution}
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* 정본 divider — 8px 회색 띠. */}
      {mine.length > 0 ? <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} /> : null}

      {/* 정본 qBlock — 26/35 700 두 줄. 서브 문구는 없다. */}
      <Hero lines={['어떤 점이', '궁금하세요?']} />

      {!isServerConfigured ? (
        <Section>
          <NoteBox title="지금은 문의를 보낼 수 없어요. 잠시 후 다시 시도해 주세요." />
        </Section>
      ) : null}

      {/* 정본 inquiryTypes — listCard 안 52 행 · 라디오 22 + 라벨 15. */}
      <Section>
        <View style={[styles.listCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {USER_INQUIRY_CATEGORIES.map((item, index) => {
            const on = category === item;

            return (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={INQUIRY_CATEGORY_RULES[item].label}
                onPress={() => setCategory(item)}
                style={[
                  styles.typeRow,
                  index < USER_INQUIRY_CATEGORIES.length - 1
                    ? { borderBottomWidth: Border.hairline, borderBottomColor: theme.border }
                    : null,
                ]}>
                {on ? (
                  <View style={[styles.radio, { backgroundColor: theme.tint }]}>
                    <ProductSymbol name="check" size={14} color={theme.onTint} />
                  </View>
                ) : (
                  <View style={[styles.radio, styles.radioOff, { borderColor: theme.track }]} />
                )}
                <ThemedText type="f15" numberOfLines={1} style={styles.grow}>
                  {INQUIRY_CATEGORY_RULES[item].label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* 어디서 눌러 들어왔는지 보여준다. 무엇에 대한 문의인지 헷갈리지 않게. */}
      {params.subjectName ? (
        <Section>
          <NoteBox title={`대상: ${params.subjectName}`} />
        </Section>
      ) : null}

      {rule.requiresSubject && !subject ? (
        <Section>
          <NoteBox title="이 항목은 어느 대상에 대한 것인지가 있어야 해요. 해당 화면에서 눌러 들어와주세요." />
        </Section>
      ) : null}

      <Section title="내용">
        <TextInput
          style={[styles.textarea, { color: theme.text, borderColor: theme.fieldBorder }]}
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="무엇이 잘못되었는지, 무엇을 원하시는지 적어주세요"
          placeholderTextColor={theme.textAssistive}
          accessibilityLabel="문의 내용"
        />
      </Section>

      {error ? (
        <Section>
          <NoteBox title={error} />
        </Section>
      ) : null}

      {/* 정본 noteBox «답변 시간을 미리 적습니다». */}
      <Section>
        <NoteBox
          title="평일 오전 10시부터 오후 6시까지 답변드려요"
          body="주말과 공휴일에 남긴 문의는 다음 영업일에 처리해요."
        />
      </Section>
    </SubScreen>
  );
}

/** 정본 badgeS 색 — ok 초록 · warn 주황 · 그 밖 회색. */
function badgeTone(theme: ReturnType<typeof useTheme>, kind: BadgeKind): { background: string; text: string } {
  if (kind === 'ok') return { background: theme.positiveBackground, text: theme.positive };
  if (kind === 'wait') return { background: theme.cautionaryBackground, text: theme.cautionary };
  return { background: theme.backgroundSelected, text: theme.textAssistive };
}

/** «8월 12일» — 정본 pastInquiries date. */
function monthDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
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
    width: '100%',
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  grow: { flex: 1, minWidth: 0 },
  /* 정본 listCard — radius 10 · 1 테두리. */
  listCard: { borderWidth: Border.hairline, borderRadius: Radius.medium, overflow: 'hidden' },
  /* 정본 pastInquiries rowStyle — 최소 64 · 0 16 · gap 12. */
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
  },
  pastCol: { flex: 1, minWidth: 0, gap: Layout.cardNameGap },
  bold: { fontWeight: 700 },
  stateBadge: { paddingHorizontal: 9, paddingVertical: Spacing.one, borderRadius: Radius.badge },
  resolution: { paddingHorizontal: Spacing.three, paddingBottom: Layout.rowPaddingY },
  /* 정본 divider — flex 0 0 8px · 회색 띠. */
  band: { height: Spacing.two },
  /* 정본 ROW — 최소 52 · 0 20 · gap 12. */
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 52,
    paddingHorizontal: Layout.listGap,
  },
  /* 정본 RADIO 22 — 켜짐 코랄 + 흰 체크 14 · 꺼짐 1.5 테두리. */
  radio: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioOff: { borderWidth: 1.5 },
  /* 정본 textarea — 최소 120 · radius 6 · 1 #d1d3d8 · 14 · 15/23. */
  textarea: {
    minHeight: 120,
    borderWidth: Border.hairline,
    borderRadius: Radius.control,
    padding: Layout.fieldPaddingX,
    fontSize: FontSize.f15,
    lineHeight: LineHeight.lh23,
    textAlignVertical: 'top',
  },
});
