import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { FaqItemResponse } from '@weddingpick/api-contract';
import { FilterChip, Layout, MaxContentWidth, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { BackBar } from '@/components/back-bar';
import { useFaq } from '@/features/faq/use-faq';
import strings from '../../../../../../spec/strings.ko.json';

/** 카테고리 칩바의 «전체» — `community/index.tsx` `CATEGORIES`와 같은 이름을 쓴다. */
const ALL_CATEGORY = '전체';

/**
 * FAQ(WP-MY-013). 정본 my.js `faq(q, a)`처럼 질문을 누르면 그 자리에서 답이 펼쳐진다.
 * 질문 상세(`/my/faq/[faqKey]`)와 촬영 안내 · 샘플 결과(Pick 인증 촬영)는 2026-09-25 대표 지시로
 * 삭제했다 — 이 화면은 FAQ 하나만 그린다.
 */
export default function GuideScreen() {
  /* 질문은 운영자가 관리자 화면에서 고치고 지운다(2026-09-16 대표 지시). */
  const faq = useFaq();
  // 시안(WP-MY-013) 카테고리 칩바 — «전체» + 받아온 질문의 category를 처음 나온 순서로.
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const categories = [ALL_CATEGORY, ...new Set(faq.items.map((item) => item.category))];
  const visible =
    category === ALL_CATEGORY ? faq.items : faq.items.filter((item) => item.category === category);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar title={strings.my['item.faq']} />

        {faq.items.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipBar}>
            {categories.map((label) => (
              <FilterChip
                key={label}
                role="radio"
                label={label}
                selected={category === label}
                onPress={() => setCategory(label)}
              />
            ))}
          </ScrollView>
        ) : null}

        <ScrollView contentContainerStyle={styles.content}>
          {faq.loading ? null : visible.length > 0 ? (
            <ThemedView style={styles.section}>
              {visible.map((item) => (
                <FaqRow
                  key={item.key}
                  item={item}
                  open={openKey === item.key}
                  onToggle={() => setOpenKey((current) => (current === item.key ? null : item.key))}
                />
              ))}
            </ThemedView>
          ) : (
            /* 빈 상태를 반드시 그린다 — 운영자가 전부 지운 것인지 못 불러온 것인지 구별한다. */
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {faq.failed
                  ? '질문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
                  : '아직 등록된 질문이 없어요.'}
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FaqRow({ item, open, onToggle }: { item: FaqItemResponse; open: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">{item.question}</ThemedText>
        {open ? (
          <ThemedText type="small" themeColor="textSecondary">
            {item.answer}
          </ThemedText>
        ) : null}
      </ThemedView>
    </Pressable>
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
