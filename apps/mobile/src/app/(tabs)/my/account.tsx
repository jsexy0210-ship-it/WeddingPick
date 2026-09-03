import type { CurrentUser } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  Layout,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
} from '@weddingpick/ui';
import { getCurrentUser } from '@/api/client';
import { useSession } from '@/features/auth/use-session';

/**
 * 계정 정보. 디자인 핸드오프 19번.
 *
 * **여기에 개인정보를 두지 않는다.** 이름·예식일·지역은 설정 화면에서 고친다.
 * 여기서 보여주는 것은 로그인 방식뿐이다.
 *
 * **로그인 제공자는 서버 응답에 포함되지 않는다.** 현재 `/v1/me` 계약이 provider를
 * 돌려주지 않아, 화면은 "소셜 로그인"으로만 표기한다. 계약이 추가되는 날 여기에
 * 제공자명(카카오·네이버·애플·구글)을 채운다.
 */
export default function AccountScreen() {
  const { signOut } = useSession();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    void getCurrentUser()
      .then((response) => {
        setLoadError(null);
        setMe(response);
      })
      .catch((caught: Error) =>
        setLoadError(caught.message ?? '계정 정보를 불러오지 못했어요.')
      );
  }, []);

  useEffect(load, [load]);

  function confirmSignOut() {
    // 파괴적 동작은 컨펌을 거친다. 핸드오프 인터랙션 규칙.
    Alert.alert('로그아웃할까요', '기기에 저장된 문서는 지워지지 않아요', [
      { text: '그만두기', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void signOut().catch(() => setToast('로그아웃하지 못했어요'));
        },
      },
    ]);
  }

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (!me) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">계정</ThemedText>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">
              로그인 방식
            </ThemedText>
            {/*
              `/v1/me`가 provider를 내려주지 않아 지금은 "소셜 로그인"으로만 표기한다.
              계약이 추가되면 여기에 제공자명을 채운다.
            */}
            <ThemedView type="backgroundElement" style={styles.infoRow}>
              <ThemedText type="t5">로그인 방법</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                소셜 로그인
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">
              계정 관리
            </ThemedText>
            <ActionButton
              variant="secondary"
              label="로그아웃"
              onPress={confirmSignOut}
            />
            <ActionButton
              label="회원탈퇴"
              onPress={() => router.push('/my/withdrawal')}
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
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
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  infoRow: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderRadius: Spacing.three,
    minHeight: Layout.rowMinHeight,
    justifyContent: 'center',
  },
});
