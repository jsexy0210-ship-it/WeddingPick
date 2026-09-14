import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { common as commonCopy, error as errorCopy } from '../../../../../spec/strings.ko.json';

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
  onUpdate,
  maintenanceFrom,
  maintenanceTo,
}: {
  kind: ErrorKind;
  onRetry?: () => void;
  /** 설치 화면을 여는 동작. 단순 재시도와 구분한다. */
  onUpdate?: () => void;
  maintenanceFrom?: string;
  maintenanceTo?: string;
}) {
  const theme = useTheme();
  const copy = COPY[kind];
  const onAction = kind === 'update' ? onUpdate : onRetry;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.body}>
          <ProductSymbol name="warning" size={40} color={theme.textAssistive} />

          <ThemedView style={styles.text}>
            <ThemedText type="t2">{copy.title}</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary" style={styles.centered}>
              {kind === 'maintenance' && maintenanceFrom && maintenanceTo
                ? errorCopy['maintenance.body'].replace('{from}', maintenanceFrom).replace('{to}', maintenanceTo)
                : copy.body}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {onAction ? (
          <ThemedView style={styles.footer}>
            <ActionButton variant="primary" label={copy.cta} onPress={onAction} />
          </ThemedView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

/** 실제 실행할 수 있는 행동만 표시한다. 점검 알림 등록 기능은 연결되어 있지 않다. */
const COPY: Record<ErrorKind, { title: string; body: string; cta: string }> = {
  network: {
    title: errorCopy['network.title'],
    body: errorCopy['network.body'],
    cta: commonCopy['cta.retry'],
  },
  maintenance: {
    title: errorCopy['maintenance.title'],
    body: errorCopy['maintenance.bodyNoTime'],
    cta: commonCopy['cta.retry'],
  },
  update: {
    title: errorCopy['update.title'],
    body: errorCopy['update.body'],
    cta: errorCopy['update.cta'],
  },
  general: {
    title: errorCopy['general.title'],
    body: errorCopy['general.body'],
    cta: commonCopy['cta.retry'],
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
