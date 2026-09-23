import { type ConsentAgreementKey, TERM_DOCUMENTS, termDocumentFor } from '@weddingpick/domain';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Layout, MaxContentWidth, ProductSymbol, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 약관 상세 — WP-AUTH-011. 공통 풀팝업.
 *
 * 약관 동의(WP-AUTH-010) · MY · 서비스 정보의 `>`에서 연다(이 컴포넌트는 로그인
 * 흐름에서만 쓴다 — MY · 서비스 정보 쪽 연결은 그 화면을 담당하는 세션의 몫이다).
 * 누른 항목의 탭이 선택된 채로 열리고 탭은 가로 스크롤한다.
 *
 * 헤더는 CLAUDE.md 공통 풀팝업 규격 그대로다 — 56px · 좌우 16px · 좌측 36px 슬롯에
 * 회색 원형 X(16px 아이콘) · 중앙 타이틀 · 우측 36px 빈칸.
 *
 * **동의 화면에서 열었을 때만** 하단에 «동의하기»가 붙는다(`onAgree`가 있을 때).
 *
 * 조문은 아직 법무 확정 전 임시 문구다(`packages/domain/src/consent-terms.ts`).
 */
export function TermsDetailModal({
  visible,
  initialKey,
  onAgree,
  onClose,
}: {
  visible: boolean;
  initialKey: ConsentAgreementKey;
  /** 있으면 하단에 «동의하기»가 뜬다 — 약관 동의 화면에서 열었을 때만 넘긴다. */
  onAgree?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [key, setKey] = useState(initialKey);
  const doc = termDocumentFor(key) ?? TERM_DOCUMENTS[0]!;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={() => setKey(initialKey)}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={[styles.nav, { borderBottomColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              style={({ pressed }) => [styles.navClose, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
              <ProductSymbol name="close" size={16} color={theme.text} />
            </Pressable>
            <ThemedText type="f16" style={styles.navTitle}>
              약관 상세
            </ThemedText>
            <View style={styles.navPad} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabs, { borderBottomColor: theme.border }]}
            contentContainerStyle={styles.tabsContent}>
            {TERM_DOCUMENTS.map((tab) => {
              const active = tab.key === key;

              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setKey(tab.key)}
                  style={[styles.tab, active && { borderBottomColor: theme.text, borderBottomWidth: 2 }]}>
                  <ThemedText type="f15" themeColor={active ? 'text' : 'textAssistive'} style={active ? styles.tabActiveLabel : undefined}>
                    {tab.tab}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <ThemedText type="t2">{doc.title}</ThemedText>
              <ThemedText type="f13" themeColor="textAssistive">
                {doc.meta}
              </ThemedText>
            </View>

            {doc.articles.map((article) => (
              <View key={article.title} style={styles.article}>
                <ThemedText type="f15" style={styles.articleTitle}>
                  {article.title}
                </ThemedText>
                <ThemedText type="f14" themeColor="textSecondary" style={styles.articleBody}>
                  {article.body}
                </ThemedText>
              </View>
            ))}
          </ScrollView>

          {onAgree ? (
            <ThemedView style={[styles.dock, { borderTopColor: theme.border }]}>
              <ActionButton variant="primary" size="xlarge" label="동의하기" onPress={onAgree} />
            </ThemedView>
          ) : null}
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  nav: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  navClose: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1, minWidth: 0, textAlign: 'center', fontWeight: 700 },
  navPad: { width: 36 },
  tabs: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1 },
  tabsContent: { paddingHorizontal: 20, gap: 20 },
  tab: { height: 44, alignItems: 'center', justifyContent: 'center' },
  tabActiveLabel: { fontWeight: 700 },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: Spacing.five, gap: 22 },
  head: { gap: 6 },
  article: { gap: 6 },
  articleTitle: { fontWeight: 700 },
  articleBody: { lineHeight: 22 },
  dock: { paddingHorizontal: Layout.gutter, paddingTop: 12, borderTopWidth: 1 },
  pressed: { opacity: 0.8 },
});
