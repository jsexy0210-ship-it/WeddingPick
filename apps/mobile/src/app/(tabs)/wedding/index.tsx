import { DOCUMENT_TYPE_LABEL } from '@weddingpick/domain';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, VerificationBadge } from '@weddingpick/ui';
import { ensureWedding } from '@/api/client';
import { useDocumentStore } from '@/features/documents/document-store';

/**
 * A-11 내 웨딩. 후보·견적·가계약·계약·비용이 모이는 자리이며,
 * 지금은 저장된 문서 묶음만 있다. 배우자 연결(Phase 3) 후 "우리 웨딩"이 된다.
 */
export default function WeddingScreen() {
  const { sets, ready } = useDocumentStore();

  /*
   * 후보는 웨딩에 매달려 있어 웨딩 id가 필요하다. 아직 없으면 여기서 만든다 —
   * 담아두려고 들어온 사람에게 "먼저 웨딩을 만드세요"라고 하지 않는다.
   */
  async function open(
    section: 'tasks' | 'expenses' | 'visit-notes' | 'candidates' | 'quotes' | 'events'
  ) {
    const weddingId = await ensureWedding();

    router.push(`/wedding/${weddingId}/${section}`);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">내 웨딩</ThemedText>
            <ActionButton
              label="일정"
              hint="예식 관련 일정을 날짜·시간으로 관리해요"
              onPress={() => void open('events')}
            />
            <ActionButton
              label="웨딩 스케줄"
              hint="준비할 일 열네 가지가 미리 들어 있어요"
              onPress={() => void open('tasks')}
            />
            <ActionButton
              label="지출내역"
              hint="Pick 인증한 금액이 여기 모여요"
              onPress={() => void open('expenses')}
            />
            <ActionButton
              label="방문노트"
              hint="상담에서 들은 금액과 느낌을 적어두세요"
              onPress={() => void open('visit-notes')}
            />
            <ActionButton
              label="담아둔 곳 보기"
              hint="배우자와 함께 보는 후보 목록이에요"
              onPress={() => void open('candidates')}
            />
            <ActionButton
              label="올린 Pick 인증 자료"
              hint="웨딩픽이 읽어낸 계약 내용을 확인해요"
              onPress={() => void open('quotes')}
            />
            <ActionButton
              label="배우자와 함께 보기"
              hint="금액과 비교 결과를 함께 보며 결정할 수 있어요"
              onPress={() => router.push('/wedding/partner')}
            />
          </ThemedView>

          {!ready ? null : sets.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                저장된 문서가 없어요. 자료를 찍어두면 여기에 쌓여요.
              </ThemedText>
              <ActionButton
                variant="primary"
                label="자료 촬영하기"
                onPress={() => router.push('/capture')}
              />
            </ThemedView>
          ) : (
            <ThemedView style={styles.list}>
              {sets.map((set) => (
                <Pressable key={set.id} onPress={() => router.push(`/wedding/${set.id}`)}>
                  <ThemedView type="backgroundElement" style={styles.row}>
                    <ThemedView type="backgroundElement" style={styles.rowText}>
                      <ThemedText type="smallBold">{set.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {set.pages.length}장 · {set.docType === 'unknown' ? '분석 전' : DOCUMENT_TYPE_LABEL[set.docType]}
                      </ThemedText>
                    </ThemedView>
                    <VerificationBadge level={set.verificationLevel} />
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          )}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
