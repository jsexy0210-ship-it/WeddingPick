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
import { useFaq } from '@/features/faq/use-faq';
import { CatChip, Section } from '@/features/settings/my-kit';
import strings from '../../../../../../spec/strings.ko.json';

/** 처음부터 펼쳐 두는 질문 수 — 정본 frame-015는 앞 둘만 답을 보여준다. */
const FAQ_OPEN_COUNT = 2;

/** 카테고리 칩바의 «전체» — `community/index.tsx` `CATEGORIES`와 같은 이름을 쓴다. */
const ALL_CATEGORY = '전체';

/** FAQ(WP-MY-013). 촬영 요령 · 분석 안내는 Pick 인증 촬영 삭제(2026-09-25)로 뺐다. */
export default function GuideScreen() {
  /* 질문은 운영자가 관리자 화면에서 고치고 지운다(2026-09-16 대표 지시). */
  const faq = useFaq();
  // 시안(WP-MY-013) 카테고리 칩바 — «전체» + 받아온 질문의 category를 처음 나온 순서로.
  const [category, setCategory] = useState(ALL_CATEGORY);
  const theme = useTheme();
  /* 정본 faqs — 앞의 두 질문을 펼친 채로 연다(my.js `faq(q, a)` 앞 둘만 답이 있다). 누르면 접고 편다. */
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const initial = new Set(faq.items.slice(0, FAQ_OPEN_COUNT).map((item) => item.key));
  const expanded = new Set([...initial].filter((key) => !toggled.has(key)).concat(
    [...toggled].filter((key) => !initial.has(key)),
  ));

  function toggle(key: string) {
    setToggled((now) => {
      const next = new Set(now);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const categories = [ALL_CATEGORY, ...new Set(faq.items.map((item) => item.category))];
  const visible =
    category === ALL_CATEGORY ? faq.items : faq.items.filter((item) => item.category === category);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar title={strings.my['item.faq']} />

        <ScrollView contentContainerStyle={styles.faqContent} showsVerticalScrollIndicator={false}>
          {/* 정본 chipBar — 0 20 14(좌우 공통 24) · gap 8 · 칩 34. */}
          {faq.items.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipBar}>
              {categories.map((label) => (
                <CatChip
                  key={label}
                  label={label}
                  selected={category === label}
                  onPress={() => setCategory(label)}
                />
              ))}
            </ScrollView>
          ) : null}

          <Section>
            {faq.loading ? null : visible.length > 0 ? (
              /* 정본 faqs — listCard 안 펼침 목록. 펼친 질문은 답을 아래에 그리고 꺾쇠가 아래를 본다. */
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
                        <View style={open ? styles.chevronOpen : null}>
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
  chipScroll: { flexGrow: 0 },
  chipBar: {
    gap: Layout.chipGap,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionHeadGap,
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
  chevronOpen: { transform: [{ rotate: '90deg' }] },
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
