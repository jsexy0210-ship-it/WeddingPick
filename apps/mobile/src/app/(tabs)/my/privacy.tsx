import { POLICY_DOCUMENTS } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
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
import { openExternal } from '@/features/open-external';
import { BackBar } from '@/components/back-bar';

/**
 * 개인정보처리방침 — 요약과 전문 링크.
 *
 * **전문을 여기 옮겨 적지 않는다.** 예전에는 이 화면이 7개 절의 뼈대를 직접
 * 들고 있었는데, 그 내용이 실제로 게시된 방침과 어긋났다 — 여기서는 「제3자에
 * 원칙적으로 제공하지 않아요」·「위탁 업체는 확정 후 명시해요」라고 적혀 있는데
 * 방침에는 수탁자 다섯 곳과 국외 이전 세 건이 이미 적혀 있다(2026-09-09).
 * 같은 문서를 두 벌 들면 언젠가 한 벌이 낡고, 낡은 쪽을 사용자가 본다.
 *
 * 그래서 정본은 웹 하나다(`POLICY_DOCUMENTS`). 이 화면은 **사용자가 가장 자주
 * 묻는 세 가지**만 요약하고 전문으로 보낸다 — 무엇을 받는지, 어디로 가는지,
 * 어떻게 지우는지.
 */
type Summary = {
  id: string;
  title: string;
  body: string;
};

const SUMMARY: Summary[] = [
  {
    id: 'collect',
    title: '무엇을 받나요',
    body:
      '카카오 로그인으로 받은 닉네임과 프로필 사진, 만 14세 이상인지 판정하는 데 쓰는 출생 연도예요. ' +
      '출생 연도는 판정하고 나서 지우고 판정 결과만 남겨요. 예식일 · 지역 · 예산처럼 직접 고른 값과, ' +
      'Pick 인증이나 견적서 정리에 올린 자료도 받아요.', // pick-language: 받는 서류 이름 — 무엇을 받는지 정확히 적어야 하는 방침 요약
  },
  {
    id: 'transfer',
    title: '어디로 가나요',
    body:
      '올린 자료에서 금액과 업체를 읽어내는 일은 국외(미국)의 외부 서비스가 맡아요. 서비스 서버와 ' +
      '저장 공간도 국외에 있고, 앱 알림은 국외의 발송 서비스를 거쳐요. 원본 이미지는 국내 저장소에 ' +
      '둬요. 자세한 것은 전문의 「개인정보의 국외 이전」에 이전받는 자 · 국가 · 항목 · 거부 방법까지 적어뒀어요.',
  },
  {
    id: 'delete',
    title: '어떻게 지우나요',
    body:
      '올린 원본은 정리가 끝나면 지워요. 계정과 함께 지우려면 설정에서 탈퇴하면 되고, 자료 하나만 ' +
      '지우려면 내 제보내역에서 지울 수 있어요. 열람 · 정정 · 처리정지 요청은 고객문의로 받아요.',
  },
];

function SummaryRow({ item }: { item: Summary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <ThemedView type="backgroundElement" style={styles.sectionCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? `${item.title} 접기` : `${item.title} 펼치기`}
        onPress={() => setExpanded((v) => !v)}
        style={styles.sectionHeader}>
        <ThemedText type="t6" style={styles.sectionTitle} numberOfLines={expanded ? undefined : 2}>
          {item.title}
        </ThemedText>
        <ThemedText type="t7" themeColor="textAssistive">
          {expanded ? '접기' : '보기'}
        </ThemedText>
      </Pressable>
      {expanded && (
        <ThemedText type="t7" themeColor="textSecondary" style={styles.sectionBody}>
          {item.body}
        </ThemedText>
      )}
    </ThemedView>
  );
}

export default function PrivacyScreen() {
  const policy = POLICY_DOCUMENTS.find((document) => document.id === 'privacy');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">개인정보처리방침</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              자주 묻는 세 가지를 먼저 적었어요. 전문은 아래에서 볼 수 있어요.
            </ThemedText>
          </ThemedView>

          {SUMMARY.map((item) => (
            <SummaryRow key={item.id} item={item} />
          ))}

          {/* 정본은 웹 하나다. 여기서 여는 주소는 웹 푸터와 같은 곳에서 온다. */}
          {policy?.url ? (
            <ActionButton
              variant="primary"
              label="전문 보기"
              onPress={() => {
                void openExternal(policy.url!);
              }}
            />
          ) : null}

          <ThemedView type="backgroundElement" style={styles.contactCard}>
            <ThemedText type="t6" style={styles.contactTitle}>
              개인정보 관련 문의
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              개인정보 처리에 관한 문의나 열람·삭제 요청은 앱 내 고객문의로 보내주세요.
            </ThemedText>
          </ThemedView>

          <ActionButton variant="secondary" label="돌아가기" onPress={() => router.back()} />
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
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.one },
  sectionCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: Layout.touchTarget,
  },
  sectionTitle: { flex: 1, fontWeight: '700' },
  sectionBody: { marginTop: Spacing.one },
  contactCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  contactTitle: { fontWeight: '700' },
});
