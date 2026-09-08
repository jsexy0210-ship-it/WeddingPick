import type { Settings } from '@weddingpick/api-contract';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Switch, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { getSettings, updateSettings } from '@/api/client';

/**
 * 알림 설정. 디자인 핸드오프 19번.
 *
 * **스위치를 누르면 바로 저장한다.** 저장 버튼이 따로 없다 — 토글은 상태 변경이지
 * 제출이 아니다. 서버 실패 시 되돌리고 토스트로 알린다.
 *
 * **혜택·이벤트·커플 공유는 아직 서버 계약이 없다.** 화면에서는 받지만 저장하지
 * 않는다 — 계약이 나오는 날 `updateSettings` 호출을 추가한다.
 */
export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * 혜택·이벤트 알림과 커플 공유 알림은 아직 Settings 계약에 없다.
   * 로컬 상태로 화면에 두고, 계약이 추가되면 여기에 API 연동을 건다.
   */
  const [benefitEnabled, setBenefitEnabled] = useState(true);
  const [coupleEnabled, setCoupleEnabled] = useState(true);

  const load = useCallback(() => {
    void getSettings()
      .then((response) => {
        setLoadError(null);
        setSettings(response);
        // 서버가 pushEnabled를 끈 경우 혜택 알림도 꺼 있는 것으로 본다.
        setBenefitEnabled(response.pushEnabled);
        setCoupleEnabled(response.pushEnabled);
      })
      .catch((caught: Error) =>
        setLoadError(caught.message ?? '알림 설정을 불러오지 못했어요.')
      );
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

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (!settings) {
    return <DelayedLoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">알림 설정</ThemedText>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">
              받을 알림
            </ThemedText>

            <SwitchRow
              label="Pick 알림"
              hint="자료 확인 결과, 문의 답변, 배우자 연결"
              value={settings.pushEnabled}
              onChange={(next) => void toggle('pushEnabled', next)}
              theme={theme}
            />
            <SwitchRow
              label="가격변동 알림"
              hint="Pick한 곳의 가격대가 크게 바뀌면 알려드려요"
              value={settings.priceChangeEnabled}
              onChange={(next) => void toggle('priceChangeEnabled', next)}
              theme={theme}
            />
            <SwitchRow
              label="혜택·이벤트 알림"
              hint="새로운 혜택과 이벤트가 있을 때 알려드려요"
              value={benefitEnabled}
              onChange={setBenefitEnabled}
              theme={theme}
            />
            <SwitchRow
              label="커플 공유 알림"
              hint="배우자가 Pick을 바꾸거나 일정을 추가하면 알려드려요"
              value={coupleEnabled}
              onChange={setCoupleEnabled}
              theme={theme}
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
  theme,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  theme: ReturnType<typeof useTheme>;
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
        thumbColor={theme.onTint}
        ios_backgroundColor={theme.track}
      />
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    minHeight: Layout.rowMinHeight,
  },
  grow: {
    flex: 1,
  },
});
