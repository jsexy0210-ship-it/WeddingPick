import { ActivityIndicator, Linking, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from './action-button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Layout, MaxContentWidth, Spacing } from './theme';
import { useTheme } from './use-theme';

/**
 * 화면 하나를 통째로 채우는 공통 상태 컴포넌트.
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

// ─── WP-ST-007 로딩 ───────────────────────────────────────────────────────────

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

// ─── WP-ST-008 빈 목록 ────────────────────────────────────────────────────────

export type EmptyViewProps = {
  /** 없다는 것을 말하는 한 줄. 예: "아직 Pick한 곳이 없어요". */
  title: string;
  /** 다음에 뭘 하면 되는지. */
  description?: string;
  /** 채우러 가는 CTA. 빈 상태에는 다음 행동 버튼을 하나만 둔다. */
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

// ─── WP-ST-009 오류 ───────────────────────────────────────────────────────────

export type ErrorViewProps = {
  /** 기본: "잠시 문제가 생겼어요". */
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
  title = '잠시 문제가 생겼어요',
  message = '다시 시도해도 안 되면 알려주세요',
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

// ─── WP-ST-010 네트워크 오류 ──────────────────────────────────────────────────

export type NetworkErrorViewProps = {
  /** 마지막으로 확인한 시각. 있으면 표시한다. */
  cachedAt?: Date;
  onRetry?: () => void;
};

export function NetworkErrorView({ cachedAt, onRetry }: NetworkErrorViewProps) {
  const cachedLabel = cachedAt
    ? `마지막으로 확인한 내용을 보여드리고 있어요 (${cachedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
    : '마지막으로 확인한 내용을 보여드리고 있어요';

  return (
    <StatusFrame>
      <ThemedText type="t4">연결이 불안정해요</ThemedText>
      <ThemedText type="t7" themeColor="textSecondary">
        {cachedLabel}
      </ThemedText>
      {onRetry ? <ActionButton variant="primary" label="다시 시도" onPress={onRetry} /> : null}
    </StatusFrame>
  );
}

// ─── WP-ST-011 권한 거부 ──────────────────────────────────────────────────────

export type PermissionKind = 'camera' | 'photos' | 'notifications' | 'location';

const PERMISSION_TITLE: Record<PermissionKind, string> = {
  camera: '카메라 접근이 꺼져 있어요',
  photos: '사진 접근이 꺼져 있어요',
  notifications: '알림이 꺼져 있어요',
  location: '위치 접근이 꺼져 있어요',
};

const PERMISSION_DESC: Record<PermissionKind, string> = {
  camera: '설정에서 켜면 카메라로 바로 촬영할 수 있어요',
  photos: '설정에서 켜면 사진으로 바로 인증할 수 있어요',
  notifications: '설정에서 켜면 중요한 소식을 바로 받을 수 있어요',
  location: '설정에서 켜면 주변 업체를 지도에서 볼 수 있어요',
};

export type PermissionDeniedViewProps = {
  kind: PermissionKind;
  /** 설정 앱을 열 수 없을 때 대신 보여주는 대안 행동. */
  onAlternative?: () => void;
  alternativeLabel?: string;
};

export function PermissionDeniedView({
  kind,
  onAlternative,
  alternativeLabel,
}: PermissionDeniedViewProps) {
  return (
    <StatusFrame>
      <ThemedText type="t4">{PERMISSION_TITLE[kind]}</ThemedText>
      <ThemedText type="t7" themeColor="textSecondary">
        {PERMISSION_DESC[kind]}
      </ThemedText>
      {/* 브라우저에는 앱 설정 화면이 없다 — react-native-web에 openSettings가 없어
          누르면 아무 반응이 없거나 에러가 난다. 네이티브에서만 보여준다. */}
      {Platform.OS !== 'web' ? (
        <ActionButton
          variant="primary"
          label="설정 열기"
          onPress={() => Linking.openSettings()}
        />
      ) : null}
      {onAlternative && alternativeLabel ? (
        <ActionButton label={alternativeLabel} onPress={onAlternative} />
      ) : null}
    </StatusFrame>
  );
}

// ─── WP-ST-012 처리 중 ────────────────────────────────────────────────────────

export type ProcessingViewProps = {
  /** 무슨 처리인지. 기본: "확인하고 있어요". */
  title?: string;
  /** 예상 소요 시간 안내. 기본: "보통 10초 안에 끝나요". */
  estimatedLabel?: string;
};

export function ProcessingView({
  title = '확인하고 있어요',
  estimatedLabel = '보통 10초 안에 끝나요',
}: ProcessingViewProps) {
  const theme = useTheme();

  return (
    <StatusFrame>
      <ActivityIndicator color={theme.tint} size="large" />
      <ThemedText type="t4" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText type="t7" themeColor="textSecondary" style={styles.centered}>
        {estimatedLabel}
      </ThemedText>
    </StatusFrame>
  );
}

// ─── WP-ST-014 점검·업데이트 ──────────────────────────────────────────────────

export type MaintenanceViewProps = {
  /** 점검 종료 시각. 반드시 적는다. */
  endsAt: Date;
  /** 점검 종료 알림 등록. */
  onNotify?: () => void;
};

export function MaintenanceView({ endsAt, onNotify }: MaintenanceViewProps) {
  const timeLabel = endsAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <StatusFrame>
      <ThemedText type="t4">잠시 점검 중이에요</ThemedText>
      <ThemedText type="t7" themeColor="textSecondary">
        {`${timeLabel}까지예요. 끝나면 알려드릴게요.`}
      </ThemedText>
      {onNotify ? (
        <ActionButton variant="primary" label="알림 받기" onPress={onNotify} />
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
  centered: { textAlign: 'center' },
});
