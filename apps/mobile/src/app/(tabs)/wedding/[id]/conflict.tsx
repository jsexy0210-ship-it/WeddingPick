import type { CurrentUser } from '@weddingpick/api-contract';
import { TERMS } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getCurrentUser } from '@/api/client';
import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { Badge, Dock, DockButton, Hero, NavBar, NoteCard, Screen } from '@/features/wedding/screen-kit';

const KIND_LABEL: Record<string, string> = {
  task: '준비 항목',
  event: '일정',
  expense: '지출',
  candidate: 'Pick한 곳',
  memo: '메모',
};

/**
 * 공동 편집 충돌. WP-CPL-004 · 핸드오프 14-couple #4 · SPEC 4.2.
 *
 *   nav     항목 이름
 *   hero    «{배우자}님이 먼저 바꿨어요» · «같은 일정을 동시에 고쳤어요»
 *   카드 2   상대 변경 — coral 1.5px 테두리 + brand 배경 / 내 변경 — 회색 1px + 흰 배경
 *   note    «어느 쪽으로 둘까요?» · 나중에 다시 바꿀 수 있어요
 *   dock    «그만두기» + «저장된 내용 보기»
 *
 * **자동 병합하지 않는다.** 두 버전을 나란히 보여준다. 서버가 아직 «내 것으로 덮어쓰기»를
 * 받지 않아 오른쪽 버튼은 저장된 내용으로 돌아간다 — 부모 화면이 `useFocusEffect`로 다시
 * 읽는다. 되는 일만 버튼에 적는다.
 */
export default function ConflictScreen() {
  const {
    kind = '',
    label = '',
    conflictMessage = '',
  } = useLocalSearchParams<{ id: string; kind?: string; label?: string; conflictMessage?: string }>();
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then(setMe)
      .catch(() => undefined);
  }, []);

  const kindLabel = KIND_LABEL[kind] ?? '항목';
  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? TERMS.spouse) : TERMS.spouse;

  return (
    <Screen>
      <NavBar title={label || kindLabel} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={`${partner}님이 먼저 바꿨어요`} sub={`같은 ${kindLabel}을 동시에 고쳤어요`} />

        <View style={styles.cards}>
          {/* 상대 변경 — coral 테두리 + brand 배경. */}
          <View style={[styles.card, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
            <View style={styles.cardHead}>
              <Badge label={`${partner}님 변경`} tone="now" />
              <ThemedText type="t7" themeColor="textAssistive">
                저장됨
              </ThemedText>
            </View>
            <ThemedText type="t5">지금 저장된 내용</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {conflictMessage || `${partner}님이 먼저 고친 내용이 저장돼 있어요`}
            </ThemedText>
          </View>

          {/* 내 변경 — 회색 테두리 + 흰 배경. */}
          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.track }]}>
            <View style={styles.cardHead}>
              <Badge label="내 변경" tone="none" />
              <ThemedText type="t7" themeColor="textAssistive">
                방금
              </ThemedText>
            </View>
            <ThemedText type="t5" numberOfLines={2}>
              {label || `내가 고친 ${kindLabel}`}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              내가 지금 입력한 내용이에요
            </ThemedText>
          </View>
        </View>

        <View style={styles.noteWrap}>
          <NoteCard
            title="어느 쪽으로 둘까요?"
            body="저장된 내용을 먼저 보고 고치면 둘 모두에게 반영돼요. 나중에 다시 바꿀 수 있어요."
          />
        </View>
      </ScrollView>

      <Dock>
        <DockButton label="그만두기" onPress={() => router.back()} />
        <DockButton variant="primary" label="저장된 내용 보기" onPress={() => router.back()} />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  cards: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.cardGap },
  /* 버전 카드 — radius 10 · padding 18 20 · gap 8 · 테두리 1. */
  card: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingVertical: Layout.cardPadding - Spacing.half,
    paddingHorizontal: Layout.cardPadding,
    gap: Spacing.two,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
});
