import type { MyReport } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Badge,
  Border,
  ErrorView,
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import { listMyReports } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { EmptyBox, Section, SubScreen } from '@/features/settings/my-kit';

/** 정본 `docs/design/React_Native/my.jsx` 프레임 6 «내가 쓴 후기 · WP-MY-006». */
const S = {
  title: '내가 쓴 후기',
  written: '쓴 후기',
  emptyWritten: '아직 쓴 후기가 없어요',
  writable: '쓸 수 있는 곳',
  write: '쓰기',
  /** 시안 «Pick 인증 완료 · 3월 4일». `REPORT_KIND_LABEL`은 배지용이라 띄어쓰지 않아 여기서는 쓰지 않는다. */
  verified: 'Pick 인증 완료',
  /** 아직 보이지 않는 후기 — 서버가 `inUse: false`로 알려준 것만 적는다. */
  hidden: '확인 중',
  emptyWritable: 'Pick 인증을 하면 그 업체에 후기를 쓸 수 있어요',
  loadError: '내 후기를 불러오지 못했어요',
} as const;

/** «2026.07». 후기 행의 작성 시기 — 시안 «2026.07 · 도움돼요 14»의 앞 절반. */
function yearMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7).replace('-', '.');
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** «3월 4일». Pick 인증을 끝낸 날 — 시안 «Pick 인증 완료 · 3월 4일». */
function monthDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 내가 쓴 후기 · WP-MY-006 · `docs/design/React_Native/my.jsx` 프레임 6.
 *
 *   «쓴 후기 N개»(업체명 · 작성 시기) → «쓸 수 있는 곳 N개»(Pick 인증 완료 + «쓰기» 배지)
 *
 * 두 목록 모두 `/v1/me/reports`(내 제보 내역) 한 번으로 만든다 — 후기만 따로 주는 엔드포인트가
 * 없고, 그 응답에 후기(`kind: 'review'`)와 Pick 인증(`kind: 'payment_proof'`)이 이미 다 있다.
 *
 * **시안에 있지만 서버가 주지 않아 비워둔 것**
 *   - 썸네일: `myReportSchema`에 이미지가 없다. 업체 이미지를 따로 부르면 목록 한 줄마다 요청이
 *     하나씩 붙는다 — 행을 글자만으로 둔다.
 *   - «도움돼요 14» · «반론 1» 배지: 도움돼요 수와 반론 수가 계약에 없다. 지어내지 않는다.
 *     대신 서버가 «지금 쓰이고 있는가»(`inUse`)는 알려주므로 그것만 «확인 중»으로 적는다.
 *
 * **v3.29 대조 — noteBox를 지웠다.** 옛 시안(12b-remaining #10)에는 맨 아래 «후기는 언제든
 * 고칠 수 있어요» 안내 카드가 있었는데, 지금 정본(WP-MY-006)의 이 화면은 두 목록으로 끝난다
 * — 정본에 없는 화면 안 요소라 뺐다.
 *
 * 행을 누르면 그 업체의 후기 목록으로 간다. 시안이 가리키는 후기 상세(WP-REV-003)는 아직 화면이
 * 없고, 고치기 화면(`edit-review`)은 별점 · 제목 · 본문을 params로 받는데 `/v1/me/reports`가 그 셋을
 * 주지 않는다 — 없는 값을 채워 보내는 대신 글이 실제로 보이는 자리로 보낸다.
 */
export default function MyReviewsScreen() {
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listMyReports()
      .then((response) => {
        setError(null);
        setReports(response.reports);
      })
      .catch((caught: Error) => setError(caught.message ?? S.loadError));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onRetry={load} />;
  if (reports === null) return <DelayedLoadingView />;

  const written = reports.filter((report) => report.kind === 'review');
  /* 이미 후기를 쓴 업체는 «쓸 수 있는 곳»에서 뺀다 — 한 사람이 한 업체에 하나다(reviews 계약). */
  const reviewed = new Set(written.map((report) => report.vendorId).filter(Boolean));
  const writable = reports.filter(
    (report) =>
      report.kind === 'payment_proof' &&
      report.vendorId !== null &&
      report.inUse &&
      !reviewed.has(report.vendorId)
  );

  return (
    <SubScreen title={S.title}>
      <Section title={`${S.written} ${written.length}개`}>
        {written.length > 0 ? (
          <ListCard>
            {written.map((report, index) => (
              <ReviewRow
                key={report.id}
                name={report.subject}
                meta={yearMonth(report.reportedAt)}
                badge={report.inUse ? undefined : S.hidden}
                chevron={report.vendorId !== null}
                last={index === written.length - 1}
                onPress={
                  report.vendorId === null
                    ? undefined
                    : () => router.push(`/search/${report.vendorId}`)
                }
              />
            ))}
          </ListCard>
        ) : (
          <EmptyBox>{S.emptyWritten}</EmptyBox>
        )}
      </Section>

      <Section title={`${S.writable} ${writable.length}개`}>
        {writable.length > 0 ? (
          <ListCard>
            {writable.map((report, index) => (
              <ReviewRow
                key={report.id}
                name={report.subject}
                meta={`${S.verified} · ${monthDay(report.reportedAt)}`}
                write
                last={index === writable.length - 1}
                onPress={() => router.push(`/search/${report.vendorId}/write-review`)}
                accessibilityLabel={`${report.subject} 후기 쓰기`}
              />
            ))}
          </ListCard>
        ) : (
          <EmptyBox>{S.emptyWritable}</EmptyBox>
        )}
      </Section>
    </SubScreen>
  );
}

/** 정본 listCard — radius 10 · 1 테두리 #eaebee. */
function ListCard({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>{children}</View>;
}

/**
 * 정본 `mr()` 행 — 최소 72(+12 12 = 96) · 12 16 · gap 12 · 썸네일 48(radius 8) · 이름 15/700 · 메타 12 muted.
 * 썸네일 자리는 `myReportSchema`에 이미지가 없어 빈 칸(이미지 자리 색)으로 둔다 — 자리는 정본대로 지킨다.
 */
function ReviewRow({
  name,
  meta,
  badge,
  chevron,
  write,
  last,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  meta: string;
  badge?: string;
  chevron?: boolean;
  write?: boolean;
  last: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        last ? null : { borderBottomWidth: Border.hairline, borderBottomColor: theme.border },
        pressed ? styles.pressed : null,
      ]}>
      <View style={[styles.thumb, { backgroundColor: theme.imagePlaceholder }]} />
      <View style={styles.col}>
        <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
          {name}
        </ThemedText>
        <ThemedText type="f12" themeColor="textAssistive" numeric numberOfLines={1}>
          {meta}
        </ThemedText>
      </View>
      {badge ? <Badge kind="wait">{badge}</Badge> : null}
      {write ? (
        <View style={[styles.writeBtn, { backgroundColor: theme.tint }]}>
          <ThemedText type="f13" themeColor="onTint" style={styles.bold}>
            {S.write}
          </ThemedText>
        </View>
      ) : null}
      {chevron ? <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: Border.hairline, borderRadius: Radius.medium, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    /* 정본 min-height 72 + 위아래 12(미리보기는 content-box라 96으로 그린다). */
    minHeight: 96,
    paddingVertical: Layout.rowPaddingY,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.6 },
  /* mrThumb 48 · radius 8. */
  thumb: { width: 48, height: 48, borderRadius: Spacing.two, flexShrink: 0 },
  col: { flex: 1, minWidth: 0, gap: Layout.cardNameGap },
  bold: { fontWeight: 700 },
  /* writeBtn 32 · 0 14 · radius 6 · 13/700 흰 글자. */
  writeBtn: {
    height: 32,
    paddingHorizontal: Layout.chipPaddingX,
    borderRadius: Radius.control,
    justifyContent: 'center',
  },
});
