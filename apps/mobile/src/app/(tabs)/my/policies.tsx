import { POLICY_DOCUMENTS, WITHDRAWAL_SEPARATED_NOTE } from '@weddingpick/domain';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { openExternal } from '@/features/open-external';

/**
 * A-15 정책.
 *
 * 이용약관 초안은 "법률 자문 전 게시 금지"라 앱에 싣지 않는다. 자리와 상태만 두고,
 * 자문이 끝나면 확정본을 여기에 넣는다.
 *
 * 목록은 @weddingpick/domain에 있다 — 웹 랜딩이 같은 것을 본다. 한쪽에서만
 * "게시됨"으로 바뀌면 어느 쪽이 맞는지 아무도 모르게 된다.
 */
export default function PoliciesScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">약관 및 정책</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              서비스 오픈 전까지 확정해야 하는 문서들이에요. 아직 확정본이 없어 상태만
              표시해요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.list}>
            {POLICY_DOCUMENTS.map((policy) => (
              <ThemedView key={policy.id} type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{policy.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {policy.status} · {policy.note}
                </ThemedText>
                {/* 전문은 웹에 있다. 새 창으로 연다 — 랜딩 안 앵커('#…')는 앱의 안내 화면이 대신한다. */}
                {policy.url && !policy.url.startsWith('#') ? (
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={Spacing.two}
                    onPress={() => {
                      void openExternal(policy.url!);
                    }}>
                    <ThemedText
                      type="smallBold"
                      style={[styles.link, { color: theme.link, textDecorationColor: theme.link }]}>
                      전문 보기
                    </ThemedText>
                  </Pressable>
                ) : null}
              </ThemedView>
            ))}
          </ThemedView>

          {/*
            탈퇴하면 낸 자료가 어떻게 되는지 한 줄 요약. 자세한 항목별 안내는
            탈퇴 화면(`/my/withdrawal`, WP-MY-008) 쪽이 실제 개수를 들고 답한다 —
            여기서는 문구만 어긋나지 않게 같은 상수를 쓴다.
           */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">탈퇴하면 낸 자료는요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {WITHDRAWAL_SEPARATED_NOTE}
            </ThemedText>
          </ThemedView>

          <ActionButton
            variant="primary"
            label="분석 안내 보기"
            onPress={() => router.push('/my/guide')}
          />
          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: 'underline', textDecorationStyle: 'solid', alignSelf: 'flex-start' },
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
