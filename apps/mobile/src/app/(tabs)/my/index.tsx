import { router } from 'expo-router';
import { Alert, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/use-session';
import { useDocumentStore } from '@/features/documents/document-store';

/** 공유되는 건 앱 자체뿐이다. 견적·계약 정보는 포함하지 않는다 — 사업계획서 12번. */
const SHARE_MESSAGE = '웨딩픽 — 찍으면, 진짜 가격이 보인다. 견적서를 찍으면 조건을 정리해줍니다.';

/** A-14 MY. 내 활동, 앱 공유, 정책 진입점. */
export default function MyScreen() {
  const { sets } = useDocumentStore();
  const { state, signOut } = useSession();
  const pageCount = sets.reduce((total, set) => total + set.pages.length, 0);

  async function leave() {
    try {
      await signOut();
    } catch {
      Alert.alert('로그아웃 실패', '다시 시도해주세요.');
    }
  }

  async function shareApp() {
    try {
      // 스토어 링크는 앱을 올린 뒤 여기에 함께 넣는다.
      await Share.share({ message: SHARE_MESSAGE });
    } catch {
      // 사용자가 공유 시트를 닫은 경우가 대부분이라 따로 알리지 않는다.
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">MY</ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">내 활동</ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                저장한 문서 {sets.length}건 · 총 {pageCount}장
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                분석하고 확인받은 기록은 여기에 쌓입니다.
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">계정</ThemedText>
            {state.status === 'offline' ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  이 빌드는 서버에 붙어 있지 않습니다. 촬영과 기기 저장까지 됩니다.
                </ThemedText>
              </ThemedView>
            ) : state.status === 'signedIn' ? (
              <ActionButton
                label="로그아웃"
                hint="기기에 저장된 문서는 지워지지 않습니다"
                onPress={leave}
              />
            ) : state.status === 'signedOut' ? (
              <ActionButton
                variant="primary"
                label="로그인"
                hint="분석과 자료 확인 신청에 필요합니다"
                onPress={() => router.push('/login')}
              />
            ) : null}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">안내</ThemedText>
            <ActionButton
              label="촬영 방법과 분석 안내"
              onPress={() => router.push('/my/guide')}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">공유</ThemedText>
            <ActionButton
              label="웨딩픽 공유하기"
              hint="앱만 공유합니다. 내 견적·계약 정보는 포함되지 않습니다"
              onPress={shareApp}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">약관 및 정책</ThemedText>
            <ActionButton label="이용약관 · 개인정보 · 분석 안내" onPress={() => router.push('/my/policies')} />
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
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
