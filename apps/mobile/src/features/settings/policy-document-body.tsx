import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton, CanonGray, FontSize, LineHeight, Spacing, ThemedText } from '@weddingpick/ui';

import { getPublishedLegalDocument, UnpublishedLegalDocumentError, type PublishedLegalDocument } from '@/api/client';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { openExternal } from '@/features/open-external';
import strings from '../../../../../spec/strings.ko.json';

/** 웹 문서와 같은 관리자 공개판을 RN으로 그린다. 조문 사본은 앱에 두지 않는다. */
export function PolicyDocumentBody({ id }: { id: 'terms' | 'privacy' }) {
  const title = id === 'privacy' ? '개인정보처리방침' : '서비스이용약관';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' | 'unpublished' } | { status: 'ready'; document: PublishedLegalDocument }
  >({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    void getPublishedLegalDocument(id)
      .then((document) => { if (alive) setState({ status: 'ready', document }); })
      .catch((error: unknown) => {
        if (alive) setState({ status: error instanceof UnpublishedLegalDocumentError ? 'unpublished' : 'error' });
      });
    return () => { alive = false; };
  }, [id, attempt]);

  if (state.status !== 'ready') {
    return (
      <View style={styles.center}>
        {state.status === 'loading' ? <DelayedLoader size={28} /> : (
          <>
            <ThemedText type="t6" themeColor="textSecondary">
              {state.status === 'unpublished' ? `${title}이 아직 공개되지 않았어요.` : '문서를 불러오지 못했어요.'}
            </ThemedText>
            <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }} />
          </>
        )}
      </View>
    );
  }

  const { document } = state;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <ThemedText type="t3" style={styles.title}>{title}</ThemedText>
      {document.clauses.map((clause) => (
        <View key={clause.id} style={styles.section}>
          <ThemedText type="f15" style={styles.sectionTitle}>{clause.title}</ThemedText>
          {clause.bodyTable ? (
            <>
              {clause.bodyTable.lead ? <LegalText value={clause.bodyTable.lead} /> : null}
              {clause.bodyTable.rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.tableRow}>
                  {clause.bodyTable!.cols.map((column, columnIndex) => (
                    <View key={columnIndex} style={[styles.tableCell, columnIndex > 0 && styles.tableCellBorder]}>
                      <ThemedText type="f12" themeColor="textSecondary" style={styles.tableLabel}>
                        {column.label}
                      </ThemedText>
                      <LegalText value={row[columnIndex] ?? ''} />
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : clause.body.split('\n').filter((line) => line.trim().length > 0).map((line, lineIndex) => (
            <View key={lineIndex} style={styles.line}>
              <ThemedText type="f12" style={styles.lineNumber}>{lineIndex + 1}</ThemedText>
              <View style={styles.lineBody}><LegalText value={line} /></View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function LegalText({ value }: { value: string }) {
  return (
    <ThemedText type="f14" style={styles.text}>
      {value.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => (
        /^https?:\/\//.test(part) ? (
          <ThemedText
            key={index}
            type="f14"
            themeColor="link"
            accessibilityRole="link"
            onPress={() => void openExternal(part, { title: '관련 사이트' })}>
            {part}
          </ThemedText>
        ) : part
      ))}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: Spacing.five, gap: 24 },
  title: { fontSize: FontSize.searchRootTitle, lineHeight: LineHeight.lh28, minHeight: 30 },
  section: { gap: 12 },
  sectionTitle: { fontWeight: 700, lineHeight: LineHeight.lh22 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lineNumber: {
    width: 22, height: 22, overflow: 'hidden', textAlign: 'center', marginTop: 2,
    borderRadius: 6, backgroundColor: CanonGray.gray100, color: CanonGray.gray700,
  },
  lineBody: { flex: 1, minWidth: 0 },
  text: { lineHeight: LineHeight.lh22, color: CanonGray.gray700 },
  tableRow: { borderColor: CanonGray.gray200, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  tableCell: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  tableCellBorder: { borderTopColor: CanonGray.gray200, borderTopWidth: 1 },
  tableLabel: { fontWeight: 700 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
});
