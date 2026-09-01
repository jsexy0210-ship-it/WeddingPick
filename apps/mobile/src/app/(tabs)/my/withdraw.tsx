import { WITHDRAWAL_PENDING, withdrawalNotice } from '@weddingpick/domain';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

/**
 * 회원탈퇴. 디자인 핸드오프(SEED) WP-MY-008.
 *
 * **아직 탈퇴 자체를 처리하지 않는다.** 개인정보처리방침이 확정되기 전이라
 * `withdrawalNotice()`가 항상 대기 문구를 돌려준다(`packages/domain/src/withdrawal.ts`).
 * 방침 없이 "지워드릴게요"라고 먼저 약속하면, 방침이 다르게 정해졌을 때 거짓말이 된다.
 *
 * 그래도 요청할 길은 있어야 한다. 문의(`개인정보` 카테고리)는 이미 사람이 직접 받아서
 * 처리하는 창구라, 자동화된 탈퇴 버튼이 없어도 사람이 요청을 받을 수 있다.
 */
export default function WithdrawScreen() {
  const notice = withdrawalNotice();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">회원탈퇴</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              탈퇴하면 계정과 개인화 정보는 삭제돼요.
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.noticeCard}>
            <ThemedText type="t7" themeColor="tint">
              지금 알려드릴 수 있는 것
            </ThemedText>
            <ThemedText type="t6">{notice}</ThemedText>
            {notice === WITHDRAWAL_PENDING ? (
              <ThemedText type="t7" themeColor="textAssistive">
                방침이 확정되면 이 화면과 자주 묻는 질문이 같은 문장으로 안내해드려요.
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">
              지금 바로 탈퇴하고 싶어요
            </ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              자동 처리는 아직 준비 중이지만, 문의로 요청하시면 사람이 직접 확인하고
              처리해드려요.
            </ThemedText>
            <ActionButton
              variant="primary"
              label="탈퇴 요청하기"
              hint="문의하기의 개인정보 항목으로 연결돼요"
              onPress={() => router.push('/my/contact?category=privacy')}
            />
          </ThemedView>

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  noticeCard: {
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.one,
  },
});
