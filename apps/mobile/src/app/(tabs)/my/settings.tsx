import type { Settings } from '@weddingpick/api-contract';
import { PAYMENT_CONSENT_REVOKED_NOTICE, formatWeddingDate } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { getSettings, revokePaymentConsent, updateSettings } from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import { APP_VERSION } from '@/features/settings/version';

/**
 * 설정. 디자인 핸드오프 19번.
 *
 * **`배우자와 실시간 공유` 스위치는 없다.** 최종통합정책 v2.0 원문 30번이 그 설정을
 * 없앴다 — `배우자 연결 = 공유`, `연결 해제 = 공유 종료`로 단순해졌다. 연결해두고
 * 공유는 끄는 상태를 만들 수 있게 두면, 상대는 무엇이 보이는지 알 수 없다.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const { signOut } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    void getSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  useEffect(load, [load]);

  async function toggle(key: 'pushEnabled' | 'priceChangeEnabled', value: boolean) {
    if (!settings) return;

    // 먼저 화면을 바꾼다. 서버를 기다리면 스위치가 늦게 따라와 두 번 누르게 된다.
    setSettings({ ...settings, [key]: value });

    await updateSettings({ [key]: value })
      .then(setSettings)
      .catch(() => {
        setSettings(settings);
        setToast('설정을 바꾸지 못했어요');
      });
  }

  function confirmRevoke() {
    Alert.alert(
      '결제인증 동의를 철회할까요',
      '앞으로 결제내역을 등록할 수 없어요. 이미 등록한 내역은 내 제보 내역에서 지울 수 있어요',
      [
        { text: '그만두기', style: 'cancel' },
        {
          text: '철회하기',
          style: 'destructive',
          onPress: () => {
            void revokePaymentConsent()
              .then((next) => {
                setSettings(next);
                setToast(PAYMENT_CONSENT_REVOKED_NOTICE);
              })
              .catch(() => setToast('철회하지 못했어요'));
          },
        },
      ]
    );
  }

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">설정</ThemedText>

          <Section title="알림">
            <SwitchRow
              label="푸시 알림"
              hint="자료 확인 결과, 문의 답변, 배우자 연결"
              value={settings?.pushEnabled ?? true}
              onChange={(next) => void toggle('pushEnabled', next)}
            />
            <SwitchRow
              label="가격 변동 알림"
              hint="관심업체의 결제 구간이 크게 바뀌면 알려드려요"
              value={settings?.priceChangeEnabled ?? true}
              onChange={(next) => void toggle('priceChangeEnabled', next)}
            />
          </Section>

          <Section title="계정">
            <Row
              label="예식일"
              value={
                settings?.weddingDate ? formatWeddingDate(settings.weddingDate) : '등록하지 않음'
              }
              onPress={() => router.push('/setup')}
            />
            <Row
              label="배우자 연결"
              value={settings?.spouseLinked ? '연결됨' : '연결하지 않음'}
              onPress={() => router.push('/wedding/partner')}
            />
          </Section>

          <Section title="데이터">
            <ActionButton label="내 제보 내역" onPress={() => router.push('/my/reports')} />
            {/*
              동의하지 않은 사람에게 철회 단추를 보이지 않는다. 누를 것이 없는
              단추는 무엇이 잘못됐는지 생각하게 만든다.
            */}
            {settings?.paymentConsent ? (
              <ActionButton
                label="결제인증 동의 철회"
                hint={
                  settings.paymentConsentAt
                    ? `${formatWeddingDate(settings.paymentConsentAt.slice(0, 10))}에 동의하셨어요`
                    : undefined
                }
                onPress={confirmRevoke}
              />
            ) : null}
          </Section>

          <Section title="지원">
            <ActionButton label="문의하기" onPress={() => router.push('/my/contact')} />
            <ActionButton
              label="이용약관 · 개인정보 처리방침"
              onPress={() => router.push('/my/policies')}
            />
          </Section>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textAssistive">
              앱 버전 {APP_VERSION}
            </ThemedText>
            <ActionButton label="로그아웃" onPress={confirmSignOut} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText type="t7" themeColor="textSecondary">
          {title}
        </ThemedText>
        {children}
      </ThemedView>
    );
  }

  function SwitchRow({
    label,
    hint,
    value,
    onChange,
  }: {
    label: string;
    hint: string;
    value: boolean;
    onChange: (next: boolean) => void;
  }) {
    return (
      <ThemedView type="backgroundElement" style={styles.switchRow}>
        <View style={styles.grow}>
          <ThemedText type="t5">{label}</ThemedText>
          <ThemedText type="t7" themeColor="textSecondary">
            {hint}
          </ThemedText>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ true: theme.tint, false: theme.track }}
          // 손잡이 색을 정하지 않으면 플랫폼 기본 초록이 나온다. 그려보고 알았다.
          thumbColor={theme.onTint}
          ios_backgroundColor={theme.track}
        />
      </ThemedView>
    );
  }
}

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <ActionButton label={label} hint={value} onPress={onPress} />;
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    minHeight: Layout.rowMinHeight,
  },
  grow: {
    flex: 1,
  },
});
