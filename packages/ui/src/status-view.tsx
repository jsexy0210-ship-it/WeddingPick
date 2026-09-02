import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from './action-button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Layout, MaxContentWidth, Spacing } from './theme';
import { useTheme } from './use-theme';

/**
 * 화면 하나를 통째로 채우는 상태 셋 — 로딩·빈 상태·오류.
 *
 * 화면마다 이 셋을 각자 다시 그려왔다(불러오는 중 스피너, "불러오지 못했어요" +
 * 재시도 버튼, "아직 없어요" 안내가 15곳 넘게 거의 같은 모양으로 반복됐다). 모양이
 * 같은 것을 각자 그리면 하나를 고칠 때 나머지가 따라오지 않는다.
 *
 * 목록 한가운데 들어가는 빈 줄(`Empty`)이 아니라 **화면 전체**를 채우는 자리에
 * 쓴다 — 데이터가 없는데 레이아웃은 그대로 두는 홈 같은 화면은 이 컴포넌트를
 * 쓰지 않는다(핸드오프의 "빈 상태에서 레이아웃을 바꾸지 않는다" 규칙과는 다른 자리).
 */
type StatusFrameProps = {
  children: React.ReactNode;
};

function StatusFrame({ children }: StatusFrameProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

export type LoadingViewProps = {
  /** 무엇을 하는 중인지. 없으면 스피너만 돈다. */
  label?: string;
};

export function LoadingView({ label }: LoadingViewProps) {
  const theme = useTheme();

  return (
    <StatusFrame>
      <ActivityIndicator color={theme.tint} size="large" />
      {label ? (
        <ThemedText type="t6" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
    </StatusFrame>
  );
}

export type ErrorViewProps = {
  /** 화면 제목. 기본은 "불러오지 못했어요". */
  title?: string;
  /** 원인. 서버가 준 메시지를 그대로 보여준다. */
  message?: string;
  /** 주 CTA. 다시 부르거나, 다른 시작점(다시 촬영하기 등)으로 보낸다. */
  onRetry?: () => void;
  /** 기본 라벨은 "다시 시도" — 재촬영처럼 뜻이 다르면 바꿔 적는다. */
  retryLabel?: string;
  /** 돌아가기 버튼. 기본 라벨은 "돌아가기". */
  onBack?: () => void;
  backLabel?: string;
};

export function ErrorView({
  title = '불러오지 못했어요',
  message,
  onRetry,
  retryLabel = '다시 시도',
  onBack,
  backLabel = '돌아가기',
}: ErrorViewProps) {
  return (
    <StatusFrame>
      <ThemedText type="t4">{title}</ThemedText>
      {message ? (
        <ThemedText type="t7" themeColor="textSecondary">
          {message}
        </ThemedText>
      ) : null}
      {onRetry ? <ActionButton variant="primary" label={retryLabel} onPress={onRetry} /> : null}
      {onBack ? <ActionButton label={backLabel} onPress={onBack} /> : null}
    </StatusFrame>
  );
}

export type EmptyViewProps = {
  /** 없다는 것을 말하는 한 줄. 예: "아직 등록된 자료가 없어요". */
  title: string;
  /** 다음에 뭘 하면 되는지. */
  description?: string;
  /** 채우러 가는 CTA. */
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyView({ title, description, actionLabel, onAction }: EmptyViewProps) {
  return (
    <StatusFrame>
      <ThemedText type="t4">{title}</ThemedText>
      {description ? (
        <ThemedText type="t7" themeColor="textSecondary">
          {description}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <ActionButton variant="primary" label={actionLabel} onPress={onAction} />
      ) : null}
    </StatusFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Layout.gutter,
    gap: Spacing.two,
  },
});
