import type {
  ComparisonResponse,
  ExtractionField,
  Quote,
  QuoteDocument,
} from '@weddingpick/api-contract';
import { ANALYSIS_DISCLAIMER, PRICE_JUDGEMENT_LABEL } from '@weddingpick/domain';
import { ScrollView, StyleSheet, TextInput, type ViewStyle } from 'react-native';

import { ActionButton, Spacing, ThemedText, ThemedView, VerificationBadge, useTheme } from '@weddingpick/ui';

const FIELD_LABEL: Record<string, string> = {
  totalAmount: '계약금액',
  contractDate: '계약일',
  refundTerms: '환불조건',
  vendorName: '업체',
  plannerName: '플래너',
  productName: '상품',
  discountAmount: '할인',
};

const KIND_LABEL = {
  included: '포함',
  excluded: '별도',
  additional_candidate: '추가 가능',
} as const;

const UNAVAILABLE_MESSAGE = {
  not_enough_samples: '아직 비교할 만큼 인증된 계약이 모이지 않았습니다.',
  vendor_unknown: '어느 업체인지 확정되지 않아 비교할 수 없습니다.',
  product_unknown: '어떤 상품과 견줄지 정할 수 없습니다.',
  amount_unconfirmed: '금액을 확인하면 비교할 수 있습니다.',
} as const;

const ROLE_LABEL = {
  studio: '스튜디오',
  dress: '드레스',
  makeup: '메이크업',
  planning: '플래닝',
  snap: '스냅',
  other: '기타',
} as const;

export const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

/** "2026년 8월 28일". 화면에는 ISO 문자열을 그대로 내보내지 않는다. */
function formatDay(timestamp: string): string {
  const date = new Date(timestamp);

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 원본이 언제 지워지는지. A-12가 요구하는 표시다.
 *
 * 날짜를 앱이 세지 않고 서버가 준 것을 그대로 보여준다 — 검증이 끝난 날로부터
 * 세는데 그 시점은 확인과 심사에 따라 달라지고, 앱이 따로 계산하면 화면에 적힌
 * 날짜와 실제로 지워지는 날이 달라진다.
 *
 * 날짜가 없는 경우가 둘이라 구분해 말한다. 인증 심사가 열려 있으면 심사가
 * 끝나야 셈이 시작되고, 그건 "모른다"가 아니라 "아직 아니다"이다.
 */
function retentionNote(document: QuoteDocument): string {
  if (document.deletedAt) {
    return `${formatDay(document.deletedAt)}에 원본을 지웠습니다. 정리된 결과는 그대로 남습니다.`;
  }

  if (document.retentionUntil) {
    // "자동으로"라고 하지 않는다. 지우는 것은 사람이고, 사용자에게 중요한 것은
    // 누가 지우는지가 아니라 언제 지워지는지다. 운영 방식이 바뀌어도 이 말은
    // 거짓이 되지 않는다.
    return `${formatDay(document.retentionUntil)}에 원본이 지워집니다. 정리된 결과는 그대로 남습니다.`;
  }

  if (document.awaitingVerification) {
    return '인증 심사가 끝나면 원본 삭제 예정일이 정해집니다. 심사에 이 문서가 증빙으로 들어가 있어 그때까지 보관합니다.';
  }

  return '아직 삭제 예정일이 정해지지 않았습니다. 정해지면 여기에 표시합니다.';
}

/** 항목 금액. 범위로 적힌 것은 범위 그대로 보여준다. */
function itemAmount(item: { amount: number | null; amountMin: number | null; amountMax: number | null }) {
  if (item.amount !== null) return won(item.amount);
  if (item.amountMin !== null && item.amountMax !== null) {
    return `${won(item.amountMin)}~${won(item.amountMax)}`;
  }
  if (item.amountMin !== null) return `${won(item.amountMin)}부터`;
  return null;
}

type Props = {
  quote: Quote;
  comparison: ComparisonResponse | null;
  /** 확인 단계를 쓸 수 있을 때만 준다. 샘플 화면에서는 없다. */
  confirm?: {
    busy: boolean;
    onEdit: (path: string, value: string) => void;
    onConfirm: (paths: string[]) => void;
  };
  header?: React.ReactNode;
  /** 결과 아래에 붙는 것. 인증 신청 버튼처럼 화면마다 다른 동선이 들어온다. */
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
};

/**
 * 분석 결과를 그리는 부분. 실제 결과 화면과 샘플 미리보기가 같은 것을 쓴다 —
 * 둘이 갈라지면 샘플이 실제와 다른 약속을 하게 된다.
 */
export function QuoteResultView({
  quote,
  comparison,
  confirm,
  header,
  footer,
  contentStyle,
}: Props) {
  const theme = useTheme();

  const pending: ExtractionField[] = quote.extractionFields.filter(
    (field) => field.requiresConfirmation && !field.confirmedByUser
  );

  return (
    <ScrollView contentContainerStyle={[styles.content, contentStyle]}>
      {header}

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">{quote.vendor?.name ?? '업체 미확인'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[quote.productName, quote.contractDate].filter(Boolean).join(' · ') || '—'}
        </ThemedText>
        <VerificationBadge level={quote.verificationLevel} />
        {quote.vendor?.sourceNote ? (
          <ThemedText type="small" themeColor="textSecondary">
            업체 정보 출처: {quote.vendor.sourceNote}
          </ThemedText>
        ) : null}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          계약금액
        </ThemedText>
        <ThemedText type="subtitle">
          {quote.totalAmount === null ? '읽지 못함' : won(quote.totalAmount)}
        </ThemedText>
        {quote.depositAmount !== null || quote.balanceAmount !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            {[
              quote.depositAmount !== null && `계약금 ${won(quote.depositAmount)}`,
              quote.balanceAmount !== null && `잔금 ${won(quote.balanceAmount)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        ) : null}
        {quote.guaranteedGuests !== null || quote.mealPricePerPerson !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            {[
              quote.guaranteedGuests !== null && `보증인원 ${quote.guaranteedGuests}명`,
              quote.mealPricePerPerson !== null &&
                `1인 식대 ${won(quote.mealPricePerPerson)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        ) : null}
      </ThemedView>

      {quote.subVendors.length > 0 ? (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">패키지 구성</ThemedText>
          {quote.subVendors.map((sub) => (
            <ThemedView key={`${sub.role}-${sub.name}`} type="backgroundElement" style={styles.row}>
              <ThemedText type="small" style={styles.rowLabel}>
                {ROLE_LABEL[sub.role]} · {sub.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {sub.amount === null ? '금액 미기재' : won(sub.amount)}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      ) : null}

      {pending.length > 0 ? (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">확인이 필요합니다</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            이 항목들은 확인하기 전까지 비교에 쓰이지 않습니다.
          </ThemedText>

          {pending.map((field) => (
            <ThemedView key={field.path} type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {FIELD_LABEL[field.path] ?? field.path} · 확인 필요
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                defaultValue={field.correctedValue ?? field.value}
                editable={Boolean(confirm)}
                onChangeText={(text) => confirm?.onEdit(field.path, text)}
                multiline={field.path === 'refundTerms'}
              />
              {confirm ? (
                <ActionButton
                  label="이 값이 맞아요"
                  disabled={confirm.busy}
                  onPress={() => confirm.onConfirm([field.path])}
                />
              ) : null}
            </ThemedView>
          ))}

          {confirm ? (
            <ActionButton
              variant="primary"
              label={confirm.busy ? '확인 중…' : '전부 맞아요'}
              disabled={confirm.busy}
              onPress={() => confirm.onConfirm(pending.map((field) => field.path))}
            />
          ) : null}
        </ThemedView>
      ) : null}

      {comparison ? (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">실제 계약과 비교</ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {comparison.available ? (
              <>
                <ThemedText type="subtitle">
                  {PRICE_JUDGEMENT_LABEL[comparison.judgement]}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  내 견적 {won(comparison.myAmount)} · 실제 계약 중앙값{' '}
                  {won(comparison.stat.median)}
                </ThemedText>
                {/* 사업계획서 9번: 표본 수와 기준 기간을 늘 함께 보인다. */}
                <ThemedText type="small" themeColor="textSecondary">
                  인증된 계약 {comparison.stat.sampleCount}건 · {comparison.stat.periodStart}~
                  {comparison.stat.periodEnd}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {UNAVAILABLE_MESSAGE[comparison.reason]}
              </ThemedText>
            )}
          </ThemedView>
        </ThemedView>
      ) : null}

      {quote.lineItems.length > 0 ? (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">항목</ThemedText>
          {quote.lineItems.map((item) => (
            <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
              {/* 항목 이름이 길어 한 줄에 금액과 나란히 두면 눌린다. 아래로 내린다. */}
              <ThemedText type="small">{item.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {KIND_LABEL[item.kind]}
                {itemAmount(item) ? ` · ${itemAmount(item)}` : ''}
              </ThemedText>
              {item.standardNote ? (
                <ThemedText type="small" style={styles.standardNote}>
                  {item.standardNote}
                </ThemedText>
              ) : null}
            </ThemedView>
          ))}
        </ThemedView>
      ) : null}

      {quote.terms.length > 0 ? (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">계약조건</ThemedText>
          {quote.terms.map((term) => (
            <ThemedView key={term.id} type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor={term.flagged ? 'text' : 'textSecondary'}>
                {term.flagged ? '⚠ ' : ''}
                {term.body}
              </ThemedText>
              {/* 공개 기준과 견준 결과. 법률 판단이 아니라 확인해볼 거리다. */}
              {term.standardNote ? (
                <ThemedText type="small" style={styles.standardNote}>
                  {term.standardNote}
                </ThemedText>
              ) : null}
            </ThemedView>
          ))}
        </ThemedView>
      ) : null}

      {quote.documents.length > 0 ? (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">원본 보관</ThemedText>
          {quote.documents.map((document) => (
            <ThemedView
              key={document.rawDocumentId}
              type="backgroundElement"
              style={styles.card}>
              <ThemedText type="small">
                {formatDay(document.uploadedAt)} 올림 · {document.pageCount}장
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {retentionNote(document)}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      ) : null}

      {footer}
    </ScrollView>
  );
}

/**
 * 분석 결과의 성격을 알리는 고정 문구. 서비스정책서 1번에 따라 결과 화면 상단에 둔다.
 *
 * 사용자에게 "AI"라는 말을 쓰지 않는다 — 알아야 할 것은 이 결과가 참고용이고
 * 원본이 우선한다는 사실이지, 무엇으로 읽었는지가 아니다.
 */
export function AnalysisNotice() {
  return (
    <ThemedView type="backgroundElement" style={styles.notice}>
      <ThemedText type="small" themeColor="textSecondary">
        {ANALYSIS_DISCLAIMER}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  rowLabel: {
    flex: 1,
  },
  standardNote: {
    color: '#B4571A',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
