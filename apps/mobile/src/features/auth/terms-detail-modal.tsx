import {
  PRIVACY_POLICY_TAB_KEY,
  TERM_DOCUMENTS,
  TERMS_POPUP_TABS,
  termDocumentFor,
  type TermsPopupTabKey,
} from '@weddingpick/domain';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, CanonGray, FontSize, Layout, LineHeight, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { FullPopupHeader } from '@/components/full-popup-header';
import { FullPopupModal } from '@/components/full-popup-modal';
import { PolicyDocumentBody } from '@/features/settings/policy-document-body';

/**
 * 약관 상세 — WP-AUTH-011. 공통 풀팝업.
 *
 * 약관 동의(WP-AUTH-010) · MY · 서비스 정보의 `>`에서 연다(이 컴포넌트는 로그인
 * 흐름에서만 쓴다 — MY · 서비스 정보 쪽 연결은 그 화면을 담당하는 세션의 몫이다).
 * 누른 항목의 탭이 선택된 채로 열리고 탭은 가로 스크롤한다.
 *
 * 올라오고 내려가는 움직임 · 뒤 딤은 공통 껍데기(`components/full-popup-modal.tsx`)가 맡는다.
 *
 * 헤더는 CLAUDE.md 공통 풀팝업 규격 그대로다 — 56px · 좌우 16px · 좌측 36px 슬롯에
 * 회색 원형 X(16px 아이콘) · 중앙 타이틀 · 우측 36px 빈칸. 상담 예약과 같이 쓰도록
 * `components/full-popup-header.tsx`로 뗐다.
 *
 * **동의 화면에서 열었을 때만** 하단에 «동의하기»가 붙는다(`onAgree`가 있을 때).
 *
 * **«개인정보처리방침» 탭**(2026-09-26 대표 지시)은 조문 목록이 아니라 웹사이트 원문을
 * 그린다 — `/my/privacy-policy`가 그리던 것과 같은 `PolicyDocumentBody`다(사본을 두지
 * 않는다). MY 「개인정보처리방침」 행이 이 탭으로 연다.
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
  initialKey: TermsPopupTabKey;
  /** 있으면 하단에 «동의하기»가 뜬다 — 약관 동의 화면에서 열었을 때만 넘긴다. */
  onAgree?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState(initialKey);
  const policy = key === PRIVACY_POLICY_TAB_KEY;
  const doc = (policy ? null : termDocumentFor(key)) ?? TERM_DOCUMENTS[0]!;

  return (
    <FullPopupModal visible={visible} onRequestClose={onClose} onShow={() => setKey(initialKey)}>
      <ThemedView style={styles.container}>
        {/* 동의 도크가 있으면 도크가 아래 inset을 직접 챙긴다(정본 CTA y 828). */}
        <SafeAreaView style={styles.safeArea} edges={onAgree ? ['top'] : ['top', 'bottom']}>
          <FullPopupHeader title="약관 상세" onClose={onClose} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabs, { borderBottomColor: CanonGray.gray200 }]}
            contentContainerStyle={styles.tabsContent}>
            {TERMS_POPUP_TABS.map((tab) => {
              const active = tab.key === key;

              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setKey(tab.key)}
                  style={[styles.tab, active && { borderBottomColor: theme.text, borderBottomWidth: 2 }]}>
                  <ThemedText type="f15" themeColor={active ? 'text' : 'textAssistive'} style={styles.tabLabel}>
                    {tab.tab}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {policy ? (
            <PolicyDocumentBody id="privacy" />
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.head}>
                {/*
                  home.js `tdTitle` 22/30/700 — 22는 같은 값의 FontSize.searchRootTitle을 쓴다. 줄 높이
                  30 토큰이 없어 lh28 글자를 30 상자에 둔다(공용 토큰은 common 담당 — PR에 요청).
                */}
                <ThemedText type="t3" style={styles.title}>{doc.title}</ThemedText>
                <ThemedText type="f13" themeColor="textAssistive" style={styles.meta}>
                  {doc.meta}
                </ThemedText>
              </View>

              {doc.articles.map((article) => (
                <View key={article.title} style={styles.article}>
                  <ThemedText type="f15" style={styles.articleTitle}>
                    {article.title}
                  </ThemedText>
                  <ThemedText type="f14" style={styles.articleBody}>
                    {article.body}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
          )}

          {onAgree ? (
            <ThemedView style={[styles.dock, { borderTopColor: CanonGray.gray200, paddingBottom: Math.max(DOCK_BOTTOM, Layout.gutter + insets.bottom) }]}>
              <ActionButton variant="primary" size="sheet" label="동의하기" onPress={onAgree} />
            </ThemedView>
          ) : null}
        </SafeAreaView>
      </ThemedView>
    </FullPopupModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  tabs: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1 },
  tabsContent: { paddingHorizontal: 20, gap: 20 },
  tab: { height: 44, alignItems: 'center', justifyContent: 'center' },
  /* home.js `termTabs` — 선택 여부와 관계없이 15/700, 색만 다르다. */
  tabLabel: { fontWeight: 700 },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: Spacing.five, gap: 22 },
  head: { gap: 6 },
  title: { fontSize: FontSize.searchRootTitle, lineHeight: LineHeight.lh28, minHeight: 30 },
  /* `tdMeta` 13 · 줄 높이 normal(18). */
  meta: { lineHeight: LineHeight.micro },
  article: { gap: 6 },
  /* `tdArtT` 15/700 · 줄 높이 normal(19). */
  articleTitle: { fontWeight: 700, lineHeight: LineHeight.lh19 },
  /* `tdArtB` 14/22 · #4d5159. */
  articleBody: { lineHeight: LineHeight.lh22, color: CanonGray.gray700 },
  /* 도크 — 위 선 1 · 위 12 · CTA 56 · 아래 48 또는 24 + inset(정본 그림 CTA y 828). */
  dock: { paddingHorizontal: Layout.gutter, paddingTop: 12, borderTopWidth: 1 },
});

/* 도크 아래 여백 — 정본 그림의 CTA y 828(아래 48). 홈 인디케이터 기기는 24 + inset이 더 크면 그것. */
const DOCK_BOTTOM = 48;
