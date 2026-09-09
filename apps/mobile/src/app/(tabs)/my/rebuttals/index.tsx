import type { MyRebuttal } from '@weddingpick/api-contract';
import { isEditable } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';
import { NavBar } from '@/features/wedding/screen-kit';
import { listMyRebuttals, removeRebuttal } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';

/**
 * 내가 낸 업체 반론. 디자인 핸드오프 20번.
 *
 * **게시되면 어떻게 보일지를 그대로 보여준다** — 원본 후기 카드 안에 반론 블록이
 * 붙은 모양이다. 반론만 세우면 무엇에 대한 답인지 알 수 없다.
 */
export default function MyRebuttalsScreen() {
  const theme = useTheme();
  const [rebuttals, setRebuttals] = useState<MyRebuttal[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listMyRebuttals()
      .then((response) => {
        setLoadError(null);
        setRebuttals(response.rebuttals);
      })
      .catch((caught: Error) => setLoadError(caught.message ?? '반론 내역을 불러오지 못했어요.'));
  }, []);

  useEffect(load, [load]);

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (rebuttals === null) {
    return <SkeletonView />;
  }

  function confirmRemove(rebuttal: MyRebuttal) {
    /*
     * 파괴적 동작은 컨펌을 거치고 대상 이름을 함께 보여준다 — 핸드오프가 정한
     * 규칙이다. 목록에서 두 번째 카드를 지우려다 첫 번째를 지우는 일이 실제로 난다.
     */
    confirmAlert(
      '반론을 지울까요',
      `${rebuttal.review.vendorName} 후기에 등록한 반론이 사라져요`,
      [
        { text: '그만두기', style: 'cancel' },
        {
          text: '지우기',
          style: 'destructive',
          onPress: () => {
            void removeRebuttal(rebuttal.id)
              .then(load)
              .catch(() => confirmAlert('지우지 못했어요', '잠시 후 다시 시도해주세요.'));
          },
        },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/*
          시안 layoutStack «header 56». 뒤로는 Depth Back — MY로 내려간다.
          제목은 화면이 아래 Hero로 들고 있어 nav에 다시 적지 않는다.
        */}
        <NavBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">업체 반론</ThemedText>

          {rebuttals.length === 0 ? (
            <ThemedText type="t6" themeColor="textSecondary">
              아직 등록한 반론이 없어요. 반론은 답할 후기를 고른 뒤 그 후기 옆에서
              등록해주세요
            </ThemedText>
          ) : null}

          {rebuttals.map((rebuttal) => (
            <ThemedView key={rebuttal.id} type="backgroundElement" style={styles.card}>
              <View style={styles.cardHead}>
                <ThemedText type="t7" themeColor="textSecondary">
                  {rebuttal.review.vendorName}
                </ThemedText>
                <ThemedText
                  type="badge"
                  themeColor={rebuttal.status === 'published' ? 'positive' : 'textAssistive'}>
                  {rebuttal.statusLabel}
                </ThemedText>
              </View>

              {/* 원본 후기 — 무엇에 대한 답인지가 먼저 보여야 한다. */}
              <ThemedText type="t5">{rebuttal.review.title}</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                {rebuttal.review.body}
              </ThemedText>

              {/* 게시되면 붙을 모양 그대로. */}
              <View
               
                style={[styles.rebuttal, { borderLeftColor: theme.tint }]}>
                <ThemedText type="t7" themeColor="tint">
                  업체 반론 · {rebuttal.claimedRole}
                </ThemedText>
                <ThemedText type="t6">{rebuttal.body}</ThemedText>
              </View>

              <ThemedText type="t7" themeColor="textSecondary">
                {rebuttal.statusNote}
              </ThemedText>

              {/*
                * 사유는 게시하지 않기로 했을 때만 보여준다. 게시된 반론의
                * decisionNote는 "무엇으로 소속을 확인했는지"라 담당자가 쓰는 말이고,
                * 낸 사람에게 필요한 것은 지금 붙어 있다는 사실이다.
                */}
              {rebuttal.status === 'rejected' && rebuttal.decisionNote ? (
                <ThemedText type="t7" themeColor="negative">
                  {rebuttal.decisionNote}
                </ThemedText>
              ) : null}

              <View style={styles.actions}>
                {isEditable(rebuttal.status) ? (
                  <ActionButton
                    label="수정"
                    onPress={() => router.push(`/my/rebuttals/${rebuttal.review.id}`)}
                  />
                ) : null}
                {/* 지우기는 게시된 뒤에도 된다. 자기 말을 거두는 것은 언제든 되어야 한다. */}
                <ActionButton label="삭제" onPress={() => confirmRemove(rebuttal)} />
              </View>
            </ThemedView>
          ))}
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
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rebuttal: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
