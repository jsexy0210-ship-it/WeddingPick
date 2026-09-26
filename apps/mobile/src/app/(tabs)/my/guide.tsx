import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Border,
  CanonGray,
  Layout,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { BackBar } from '@/components/back-bar';
import { chevronRotation, INITIAL_EXPANDED, toggleExpanded } from '@/features/faq/accordion';
import { useFaq } from '@/features/faq/use-faq';
import { usePullRefresh } from '@/features/refresh/use-pull-refresh';
import { Section } from '@/features/settings/my-kit';
import strings from '../../../../../../spec/strings.ko.json';

/**
 * FAQ(WP-MY-013). 촬영 요령 · 분석 안내는 Pick 인증 촬영 삭제(2026-09-25)로 뺐다.
 *
 * **아코디언 목록 하나뿐이다**(2026-09-26 대표 지시 「FAQ 카테고리 칩 삭제 · 아코디언
 * 리스트만 · 전부 닫힌 채로」). 정본 my.jsx:681 `chipBar`(`faqCats`)와 my.js `faq()` 앞 둘
 * 펼침을 대표 지시가 이긴다 — 칩을 지우고 처음에는 모든 질문이 닫혀 있다.
 */
export default function GuideScreen() {
  /* 질문은 운영자가 관리자 화면에서 고치고 지운다(2026-09-16 대표 지시). */
  const faq = useFaq();
  const pull = usePullRefresh(faq.refresh);
  const theme = useTheme();
  /* 펼친 질문. 처음에는 비어 있다 — 전부 닫힌 채로 연다. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(INITIAL_EXPANDED);

  function toggle(key: string) {
    setExpanded((now) => toggleExpanded(now, key));
  }

  const visible = faq.items;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar title={strings.my['item.faq']} />

        <ScrollView
          contentContainerStyle={styles.faqContent}
          showsVerticalScrollIndicator={false}
          refreshControl={pull.refreshControl}>
          <Section>
            {faq.loading ? null : visible.length > 0 ? (
              /* 정본 faqs — listCard 안 펼침 목록. 펼친 질문은 답을 아래에 그린다. 꺾쇠: 닫힘 ∨ · 열림 ∧. */
              <View style={[styles.listCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {visible.map((item, index) => {
                  const open = expanded.has(item.key);

                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      onPress={() => toggle(item.key)}
                      style={[
                        styles.faqWrap,
                        /* 정본 선은 inset 그림자라 높이를 먹지 않는다 — 선 1만큼 아래 여백을 덜어 54를 지킨다. */
                        index < visible.length - 1
                          ? { borderBottomWidth: Border.hairline, borderBottomColor: theme.border, paddingBottom: Spacing.three - Border.hairline }
                          : null,
                      ]}>
                      <View style={styles.faqHead}>
                        <ThemedText type="f15" style={styles.faqQ}>
                          {item.question}
                        </ThemedText>
                        <View style={{ transform: [{ rotate: chevronRotation(open) }] }}>
                          <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
                        </View>
                      </View>
                      {open ? (
                        <ThemedText type="f14" style={[styles.faqA, { color: CanonGray.gray700 }]}>
                          {item.answer}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {faq.failed
                    ? '질문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
                    : '아직 등록된 질문이 없어요.'}
                </ThemedText>
              </ThemedView>
            )}
          </Section>
        </ScrollView>
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
  /* 정본 scroll padding-top 16. */
  faqContent: { paddingTop: Spacing.three, paddingBottom: Spacing.four },
  listCard: { borderWidth: Border.hairline, borderRadius: Radius.medium, overflow: 'hidden' },
  /* 정본 faq wrap — 16 · gap 10. */
  faqWrap: { padding: Spacing.three, gap: Layout.cardGap },
  faqHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Layout.inlineGap },
  /* faqQ 15/700 · lh 22. */
  faqQ: { flex: 1, fontWeight: 700, lineHeight: LineHeight.lh22 },
  /* faqA 14/22 #4d5159. */
  faqA: { lineHeight: LineHeight.lh22 },
  /*
   * 아코디언 꺾쇠 — 닫힘은 아래(∨), 열림은 위(∧)(2026-09-25 대표 지시 「아코디언 화살표 방향 수정한다」).
   * 정본 my.js `faq()`는 닫힘 오른쪽(>) · 열림 아래였다 — 대표 지시가 이긴다. 각도는 `chevronRotation`.
   */
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
