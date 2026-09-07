import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import type { ErrorKind } from './kind';

/**
 * 전면 오류 화면. 디자인 핸드오프 WP-APP-006, 문구는 `spec/strings.ko.json`의 `error.*`.
 *
 * 앱을 더 쓸 수 없을 때만 전면으로 덮는다. 한 화면이 실패한 것은 그 화면 안에서
 * 말한다 — 부분 실패를 전면으로 덮으면 사용자는 되돌아갈 곳을 잃는다.
 *
 * **무엇이 잘못됐는지 대신 무엇을 하면 되는지 적는다.** 세 화면 모두 할 일이 정확히
 * 하나씩이고, 그래서 CTA도 하나다(CLAUDE.md §3 «화면당 Primary CTA는 1개»).
 */
export function FullScreenError({
  kind,
  onRetry,
  maintenanceFrom,
  maintenanceTo,
}: {
  kind: ErrorKind;
  onRetry?: () => void;
  maintenanceFrom?: string;
  maintenanceTo?: string;
}) {
  const theme = useTheme();
  const copy = COPY[kind];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.body}>
          <ProductSymbol name="warning" size={40} color={theme.textAssistive} />

          <ThemedView style={styles.text}>
            <ThemedText type="t2">{copy.title}</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary" style={styles.centered}>
              {kind === 'maintenance' && maintenanceFrom && maintenanceTo
                ? `${maintenanceFrom}부터 ${maintenanceTo}까지 서비스를 점검하고 있어요. 끝나면 알려드릴게요.`
                : copy.body}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ActionButton variant="primary" label={copy.cta} onPress={onRetry ?? (() => undefined)} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 문구는 `spec/strings.ko.json`의 `error.*`와 같은 문장을 유지한다. */
const COPY: Record<ErrorKind, { title: string; body: string; cta: string }> = {
  network: {
    title: '연결이 불안정해요',
    body: '네트워크를 확인하고 다시 시도해주세요',
    cta: '다시 시도',
  },
  maintenance: {
    title: '잠시 점검 중이에요',
    body: '점검이 끝나면 알려드릴게요',
    cta: '알림 받기',
  },
  update: {
    title: '새 버전이 필요해요',
    body: '결제 정보 처리 방식이 바뀌어서 업데이트해야 이용할 수 있어요',
    cta: '업데이트',
  },
};

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  text: { alignItems: 'center', gap: Spacing.two },
  centered: { textAlign: 'center' },
  footer: { padding: Layout.gutter },
});
