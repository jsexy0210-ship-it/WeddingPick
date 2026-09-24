import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { error as errorCopy } from '../../../spec/strings.ko.json';

import { ActionButton } from './action-button';
import { CircleLoader } from './circle-loader';
import { ListSkeleton } from './list-skeleton';
import { StepList, type Step } from './step-list';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Layout, MaxContentWidth, Motion, Spacing } from './theme';
import { FontSize, LineHeight } from './typography';
import type { ActionButtonProps } from './action-button';
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
  scope?: 'page' | 'section';
};

/**
 * 17-sheets-states stFrameCenter — 가운데 정렬 · 제목 18/24 700 · 본문 16/24 #4D5159 · 간격 8 ·
 * 행동 버튼 하나(48). 삽화는 없다.
 */
function StatusFrame({ children, scope = 'page' }: StatusFrameProps) {
  if (scope === 'section') {
    return (
      <ThemedView style={styles.sectionContent}>
        {children}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 섹션 제목은 React_Native/common.js `emptyT`의 16/700이다. */
function StatusTitle({ children, scope }: { children: string; scope: 'page' | 'section' }) {
  return (
    <ThemedText type={scope === 'section' ? 't6' : 't5'} style={[styles.centered, scope === 'section' && styles.sectionTitle]}>
      {children}
    </ThemedText>
  );
}

/** 섹션 설명은 React_Native/common.js `emptyS`의 13/20/400이다. */
function StatusBody({ children, scope }: { children: string; scope: 'page' | 'section' }) {
  return (
    <ThemedText
      type={scope === 'section' ? 'micro' : 'body'}
      themeColor={scope === 'section' ? 'textAssistive' : 'textSecondary'}
      style={[styles.centered, scope === 'section' && styles.sectionBody]}>
      {children}
    </ThemedText>
  );
}

/** 상태 화면의 행동 버튼 — Secondary 48. 빈 상태에는 다음 행동 버튼을 하나만 둔다. */
function StatusAction(props: Omit<ActionButtonProps, 'size'>) {
  return (
    <View style={styles.actions}>
      <ActionButton size="large" {...props} />
    </View>
  );
}

// ─── WP-ST-007 로딩 ───────────────────────────────────────────────────────────

export type LoadingViewProps = {
  /** 무엇을 하는 중인지. 없으면 로더만 돈다. */
  title?: string;
  /** @deprecated `title`. */
  label?: string;
  /*
   * **`exclude`와 `loader`를 없앴다**(2026-09-15 대표 지시 — 「기본로더만 사용할것」).
   * 둘 다 업종 순회 로더 전용이었다 — 로더가 하나가 되면서 고를 것도, 순회에서
   * 뺄 업종도 없어졌다.
   */
};

/**
 * 짧은 처리(3초 이하)의 화면 전체 로딩 — 로더 40. 폼·상세 하나를 읽어오는
 * 자리. **목록에는 쓰지 않는다** — 목록은 `SkeletonView`다(핸드오프 규칙 «목록에는
 * 로더를 쓰지 않아요»). 700ms 규칙은 호출하는 화면이 `useDelayedVisible`로 지킨다.
 *
 * **로더는 원형 하나뿐이다**(2026-09-15 대표 지시 — 「모든 화면 로딩 발생 시
 * 기본로더로 돌려라. **기존 정책 파기** 기본로더만 사용할것」). 2026-09-11의
 * 「기본은 써클, 순회는 `loader="cycle"`」에서 예외가 없어졌다.
 *
 * 정본 WP-LOAD-003과 재대조(2026-09-23) — 크기 40 · 700ms 임계값은 일치(PASS),
 * 로더 모양(원형 vs 업종 아이콘 순회)만 `DESIGN_UNRESOLVED`(사유는
 * `circle-loader.tsx`·`delayed-loader.tsx` 참고).
 */
export function LoadingView({ title, label }: LoadingViewProps) {
  const text = title ?? label;

  return (
    <StatusFrame>
      <View style={styles.centerRow}>
        <CircleLoader size={40} />
      </View>
      {text ? (
        <ThemedText type="t6" themeColor="textSecondary" style={styles.centered}>
          {text}
        </ThemedText>
      ) : null}
    </StatusFrame>
  );
}

export type SkeletonViewProps = {
  /** 위에 히어로 이미지 자리(168)를 먼저 그린다 — 업체 상세 첫 로딩. */
  hero?: boolean;
  rows?: 1 | 2 | 3;
};

/**
 * WP-ST-007 목록 뼈대 — 화면 전체. 검색 결과·목록·업체 상세 첫 로딩.
 * 3줄까지만 그린다 — 4줄 이상은 실제 내용보다 뼈대가 기억된다.
 */
export function SkeletonView({ hero = false, rows = 3 }: SkeletonViewProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.skeletonContent}>
          <ListSkeleton hero={hero} rows={rows} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

export type RecommendingBodyProps = {
  /** 온보딩 닉네임. «{닉네임}님에게 맞는 곳을 찾고 있어요». 없으면 «맞는 곳을 찾고 있어요». */
  nickname?: string;
  /** 제목을 통째로 바꿀 때. `nickname`보다 우선. */
  title?: string;
  /** 예상 소요 시간. 반드시 적는다. */
  estimatedLabel?: string;
  /**
   * 단계 목록. 끝난 단계는 체크, 진행 중은 코랄, 남은 단계는 회색. **실제 진행
   * 상태를 넘긴다** — 타이머로 굴리는 가짜 진행률을 만들지 않는다.
   */
  steps?: readonly Step[];
};

export type RecommendingViewProps = RecommendingBodyProps;

/** WP-ST-015 제목. «두 분»을 쓰지 않는다 — 배우자 연결 여부와 무관하게 쓰이던 문구다. */
export function recommendingTitle(nickname?: string): string {
  return nickname ? `${nickname}님에게 맞는 곳을\n찾고 있어요` : '맞는 곳을\n찾고 있어요';
}

/**
 * WP-ST-015 업종 순회 로딩의 본문 — 로더 40 · 제목 24 · 예상 시간 · 단계 목록.
 * 화면 전체를 채우지 않는다 — 카드·시트 안처럼 부모가 자리를 정할 때 쓴다.
 *
 * 정본 WP-LOAD-001(업종 순회 로딩) · WP-LOAD-005(처리 중 · 단계 표시) `centerWrap`과
 * 재대조(2026-09-23) — 세로 gap 32 · 제목/부제 gap 8 · 제목 24/32 · 부제 t6는
 * 전부 일치(PASS). 로더 모양만 `DESIGN_UNRESOLVED`(원형 vs 업종 아이콘 순회 —
 * 사유는 `delayed-loader.tsx` 참고). `apps/mobile/.../capture/analysis/[id].tsx`가
 * WP-LOAD-005를 그대로 쓰는 실사용처다 — 제목 「올려주신 자료를 읽고 있어요」 ·
 * 「10초 안에 끝나요」 · 단계(글자 읽기 · 금액과 날짜 찾기 · 업체 맞춰보기)까지
 * 정본과 문구 그대로 일치한다. 다만 그 화면엔 정본에 있는 하단 `취소` ghost
 * 버튼(WP-LOAD-005 `Ldock`)이 없다 — 취소가 무엇을 하는지(뒤로가기 vs 폴링만
 * 중단)가 정본에 안 적혀 있어 `DESIGN_UNRESOLVED`로 남기고 그 화면 파일은
 * 건드리지 않았다(이 세션의 범위는 공용 컴포넌트다).
 */
export function RecommendingBody({
  nickname,
  title,
  estimatedLabel = '10초 안에 끝나요',
  steps,
}: RecommendingBodyProps) {
  return (
    <View style={styles.processing} accessibilityLabel={estimatedLabel}>
      <CircleLoader size={40} />
      <View style={styles.processingText}>
        <ThemedText type="t3" style={styles.centered}>
          {title ?? recommendingTitle(nickname)}
        </ThemedText>
        <ThemedText type="t6" themeColor="textAssistive" style={styles.centered}>
          {estimatedLabel}
        </ThemedText>
      </View>
      {steps && steps.length > 0 ? <StepList steps={steps} /> : null}
    </View>
  );
}

/**
 * WP-ST-015 추천 계산 로딩 — 화면 전체. 추천 계산 · 첫 진입에만 쓴다.
 *
 * 로더는 원형이다(2026-09-15 대표 지시). 이 화면이 «오래 걸린다»를 말하는 것은
 * 로더 모양이 아니라 제목과 「10초 안에 끝나요」가 맡는다.
 */
export function RecommendingView(props: RecommendingViewProps) {
  return (
    <StatusFrame>
      <RecommendingBody {...props} />
    </StatusFrame>
  );
}

// ─── WP-ST-008 빈 목록 ────────────────────────────────────────────────────────

export type EmptyViewProps = {
  /** 없다는 것을 말하는 한 줄. 예: "아직 Pick한 곳이 없어요". */
  title: string;
  /** 페이지 본문 전체인지, 정상 화면 안의 한 섹션인지. 헤더·필터를 유지해야 하면 section. */
  scope?: 'page' | 'section';
  /** 다음에 뭘 하면 되는지. */
  description?: string;
  /** 채우러 가는 CTA. 빈 상태에는 다음 행동 버튼을 하나만 둔다. */
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyView({ title, scope = 'page', description, actionLabel, onAction }: EmptyViewProps) {
  const theme = useTheme();
  return (
    <StatusFrame scope={scope}>
      <StatusTitle scope={scope}>{title}</StatusTitle>
      {description ? <StatusBody scope={scope}>{description}</StatusBody> : null}
      {actionLabel && onAction ? scope === 'section' ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.sectionAction,
            { backgroundColor: theme.tint, transform: [{ scale: pressed ? Motion.pressButton.scale : 1 }] },
          ]}>
          <ThemedText style={[styles.sectionActionText, { color: theme.onTint }]}>{actionLabel}</ThemedText>
        </Pressable>
      ) : (
        <StatusAction variant="primary" label={actionLabel} onPress={onAction} />
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
  title = errorCopy['general.title'],
  message = errorCopy['general.body'],
  onRetry,
  retryLabel = '다시 시도',
  onBack,
  backLabel = '돌아가기',
}: ErrorViewProps) {
  return (
    <StatusFrame>
      <StatusTitle scope="page">{title}</StatusTitle>
      {message ? <StatusBody scope="page">{message}</StatusBody> : null}
      {onRetry ? <StatusAction variant="primary" label={retryLabel} onPress={onRetry} /> : null}
      {onBack ? <StatusAction variant="ghost" label={backLabel} onPress={onBack} /> : null}
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
      <StatusTitle scope="page">연결이 불안정해요</StatusTitle>
      <StatusBody scope="page">{cachedLabel}</StatusBody>
      {onRetry ? <StatusAction variant="primary" label="다시 시도" onPress={onRetry} /> : null}
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
      <StatusTitle scope="page">{PERMISSION_TITLE[kind]}</StatusTitle>
      <StatusBody scope="page">{PERMISSION_DESC[kind]}</StatusBody>
      {/* 브라우저에는 앱 설정 화면이 없다 — react-native-web에 openSettings가 없어
          누르면 아무 반응이 없거나 에러가 난다. 네이티브에서만 보여준다. */}
      {Platform.OS !== 'web' ? (
        <StatusAction
          variant="primary"
          label="설정 열기"
          onPress={() => Linking.openSettings()}
        />
      ) : null}
      {onAlternative && alternativeLabel ? (
        <StatusAction variant="ghost" label={alternativeLabel} onPress={onAlternative} />
      ) : null}
    </StatusFrame>
  );
}

// ─── WP-ST-012 처리 중 ────────────────────────────────────────────────────────

export type ProcessingViewProps = {
  /** 무슨 처리인지. 2줄까지. 기본: "확인하고 있어요". */
  title?: string;
  /** 예상 소요 시간. 반드시 적는다 — 없으면 얼마나 기다릴지 알 수 없다. */
  estimatedLabel?: string;
  /**
   * 단계가 있는 처리면 어디까지 왔는지. 끝난 단계는 체크, 진행 중은 700,
   * 남은 단계는 회색. 3초 넘게 걸리는 처리는 무엇을 하는 중인지 말한다.
   */
  steps?: readonly Step[];
};

/** WP-ST-012 처리 중 — 업종 순회 로더 40 · 제목 24 · 예상 시간 · 단계 목록. */
export function ProcessingView({
  title = '확인하고 있어요',
  estimatedLabel = '10초 안에 끝나요',
  steps,
}: ProcessingViewProps) {
  return (
    <StatusFrame>
      <View style={styles.processing}>
        <CircleLoader size={40} />
        <View style={styles.processingText}>
          <ThemedText type="t3" style={styles.centered}>
            {title}
          </ThemedText>
          <ThemedText type="t6" themeColor="textAssistive" style={styles.centered}>
            {estimatedLabel}
          </ThemedText>
        </View>
        {steps && steps.length > 0 ? <StepList steps={steps} /> : null}
      </View>
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
      <StatusTitle scope="page">잠시 점검 중이에요</StatusTitle>
      <StatusBody scope="page">{`${timeLabel}까지예요. 끝나면 알려드릴게요.`}</StatusBody>
      {onNotify ? <StatusAction variant="primary" label="알림 받기" onPress={onNotify} /> : null}
    </StatusFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
    gap: Spacing.two,
  },
  /*
   * React_Native/common.js `emptyCard`: radius 12 · 내부 좌우 20 · 상하 32.
   * 앱은 라이트 고정이며, 시안의 면색 #F7F8FA를 그대로 쓴다.
   */
  sectionContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f7f8fa',
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 6,
  },
  /** 버튼은 글보다 조금 떨어져(8 + 4) 서고, 글 폭에 맞춰 늘어나지 않는다. */
  actions: { alignSelf: 'stretch', paddingTop: Spacing.one },
  centered: { textAlign: 'center' },
  centerRow: { alignItems: 'center' },
  skeletonContent: {
    flex: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
  },
  processing: { alignItems: 'center', gap: Spacing.five },
  processingText: { alignItems: 'center', gap: Spacing.two },
  sectionTitle: { fontWeight: '700' },
  sectionBody: { lineHeight: LineHeight.lh20, fontWeight: '400' },
  sectionAction: {
    marginTop: 12,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionActionText: { fontSize: FontSize.f15, fontWeight: '700' },
});
