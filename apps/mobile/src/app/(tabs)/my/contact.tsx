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
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createInquiry, listMyInquiries } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { formatDateDot } from '@/features/common/format-date';
import { useDepthBack } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { OptionRow } from '@/features/onboarding/option-row';
import { Row, Rows } from '@/features/settings/my-kit';
import { BackBar } from '@/components/back-bar';
import {
  ActionButton,
  type BadgeKind,
  FontSize,
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
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar title="문의하기" onBack={depthBack} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {mine.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">지난 문의 {mine.length}건</ThemedText>
              <Rows>
                {mine.map((inquiry) => (
                  <View key={inquiry.id}>
                    <Row
                      name={inquiry.body}
                      meta={formatDateDot(inquiry.receivedAt)}
                      tail={INQUIRY_STATUS_LABEL[inquiry.status]}
                      tailBadge={INQUIRY_BADGE_KIND[inquiry.status]}
                    />
                    {/* 시안(WP-MY-008)엔 없는 줄이다 — 답을 보여줄 상세 화면이 아직 없어 여기서 보여준다. */}
                    {inquiry.resolution ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.resolution}>
                        답변: {inquiry.resolution}
                      </ThemedText>
                    ) : null}
                  </View>
                ))}
              </Rows>
            </ThemedView>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">{'어떤 점이\n궁금하세요?'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              사람이 직접 읽고 답해요. 이름이나 주소 없이 보낼 수 있어요.
            </ThemedText>
          </ThemedView>

          {!isServerConfigured ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                지금은 문의를 보낼 수 없어요. 잠시 후 다시 시도해 주세요.
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <View style={styles.optionList}>
              {USER_INQUIRY_CATEGORIES.map((item) => (
                <OptionRow
                  key={item}
                  role="radio"
                  label={INQUIRY_CATEGORY_RULES[item].label}
                  selected={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {rule.description}
            </ThemedText>
          </ThemedView>

          {/* 어디서 눌러 들어왔는지 보여준다. 무엇에 대한 문의인지 헷갈리지 않게. */}
          {params.subjectName ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                대상: {params.subjectName}
              </ThemedText>
            </ThemedView>
          ) : null}

          {rule.requiresSubject && !subject ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                이 항목은 어느 대상에 대한 것인지가 있어야 해요. 해당 화면에서 눌러
                들어와주세요.
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">내용</ThemedText>
            <TextInput
              style={[styles.input, styles.body, { color: theme.text, borderColor: theme.border }]}
              value={body}
              onChangeText={setBody}
              multiline
              placeholder="무엇이 잘못되었는지, 무엇을 원하시는지 적어주세요"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="문의 내용"
            />
          </ThemedView>

          {error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </ThemedView>
          ) : null}

          {/* 시안 7(WP-MY-008) «답변 시간을 미리 적습니다» — 보내기 전에 언제 답이 오는지 말한다. */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">평일 오전 10시부터 오후 6시까지 답변드려요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              주말과 공휴일에 남긴 문의는 다음 영업일에 처리해요.
            </ThemedText>
          </ThemedView>

        </ScrollView>
        <ThemedView style={[styles.dock, { borderTopColor: theme.border }]}>
          <ActionButton
            variant="primary"
            size="xlarge"
            label={busy ? '보내는 중…' : '문의 보내기'}
            hint={
              ready
                ? undefined
                : rule.requiresSubject && !subject
                  ? '해당 화면에서 눌러 들어와주세요'
                  : '내용을 적어주세요'
            }
            disabled={busy || !ready || !isServerConfigured}
            onPress={submit}
          />
        </ThemedView>
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
    width: '100%',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  /* 시안 divider — 지난 문의와 질문 블록 사이 한 줄. */
  divider: {
    height: 1,
  },
  resolution: {
    paddingLeft: Layout.gutter - Spacing.two,
  },
  optionList: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Layout.fieldPaddingX,
    paddingVertical: Spacing.two,
    /* 입력 칸 글자도 본문이다. 토큰 밖의 크기를 쓰지 않는다. */
    fontSize: FontSize.t6,
  },
  body: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  dock: {
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
});
