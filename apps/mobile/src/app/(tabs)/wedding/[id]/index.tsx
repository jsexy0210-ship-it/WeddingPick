import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, ErrorView, LoadingView, MaxContentWidth, Spacing, ThemedText, ThemedView, VerificationBadge } from '@weddingpick/ui';
import { PageThumbnail } from '@/components/page-thumbnail';
import { useDocumentStore } from '@/features/documents/document-store';

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 저장`;
}

/** A-12 견적 상세. 저장된 묶음을 다시 열어보고, 인증 신청과 삭제로 이어진다. */
export default function DocumentSetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sets, ready, removeSet } = useDocumentStore();
  const set = sets.find((item) => item.id === id);

  if (!set) {
    if (!ready) return <LoadingView />;

    return (
      <ErrorView
        title="문서를 찾을 수 없어요"
        onRetry={() => router.back()}
        retryLabel="내 웨딩으로"
      />
    );
  }

  function confirmDelete() {
    Alert.alert('문서를 지울까요?', '저장된 원본까지 함께 지워요. 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지우기',
        style: 'destructive',
        onPress: async () => {
          await removeSet(set!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">{set.label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDate(set.createdAt)} · {set.pages.length}장
            </ThemedText>
            <VerificationBadge level={set.verificationLevel} />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">분석 결과</ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                아직 분석하지 않았어요. 업체·상품·금액·계약조건은 분석이 끝나면
                여기에 채워져요.
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">문서 {set.pages.length}장</ThemedText>
            <ThemedView style={styles.list}>
              {set.pages.map((page, index) => (
                <ThemedView key={page.id} type="backgroundElement" style={styles.row}>
                  <PageThumbnail page={page} />
                  <ThemedView type="backgroundElement" style={styles.rowText}>
                    <ThemedText type="smallBold">{index + 1}번째 장</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {page.name ?? (page.mimeType === 'application/pdf' ? 'PDF 파일' : '사진')}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">보관</ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                이 문서는 기기 안에만 있어요. 서버에 올리시면 원본은 30일 뒤에 지워지고,
                정리된 결과는 남아요.
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.footer}>
            <ActionButton
              label="인증 등급 올리기"
              hint="올린 자료를 확인받으면 등급이 올라가요"
              onPress={() => router.push(`/wedding/${set.id}/verify`)}
            />
            <ActionButton label="문서 지우기" onPress={confirmDelete} />
          </ThemedView>
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  content: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  footer: {
    gap: Spacing.two,
  },
});
