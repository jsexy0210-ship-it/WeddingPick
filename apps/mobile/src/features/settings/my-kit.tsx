import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Badge,
  type BadgeKind,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  ProgressBar,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  type ThemeColor,
} from '@weddingpick/ui';

/**
 * MY 하위 · 혜택 화면 공통 부품. 디자인 핸드오프 `13-my-sub` · `15-events` · `13b-withdrawal`의
 * renderVals를 그대로 옮겼다 — 값은 전부 `@weddingpick/ui` 토큰에서 온다.
 *
 *   navBack   56 · 뒤로 40 원형 · 제목 18/24 700 · 오른쪽 글자 액션
 *   padHero   12 24 24 · gap 8 · 26/35 700 + 16/24 gray700
 *   padSec    0 24 28(24) · 섹션 제목 14/19 700 gray600
 *   row       min 56 · 12 0 · gap 12 · 이름 18/24 400 · 메타 14/19 gray600 · 꼬리 16/22 700 · 구분선 1 gray200
 *   badge     @weddingpick/ui Badge — 22 · 4 9 · radius 4 · 14/19 700
 *   check     24 원 · coral + 흰 체크 16 / 1.5 gray300 테두리
 *   statBox   radius 10 · gray50 · 20 · gap 10        noteBox  radius 10 · gray50 · 20 · gap 8
 *   card      radius 10 · 1 gray300 · 18 20 · gap 10  brand 카드는 coral 7% 바탕 · 32% 테두리
 *   dock      92 = 12 + 52 + 28 · 위 선 1 · ghost flex 1 · primary flex 1.4
 */

// ─── 화면 껍데기 ───────────────────────────────────────────────

export function SubScreen({
  title,
  right,
  onBack,
  fallback = '/my',
  children,
  dock,
  contentStyle,
}: {
  title: string;
  /** 오른쪽 글자 액션(«저장» · «참여 내역»). */
  right?: ReactNode;
  onBack?: () => void;
  /** 되돌아갈 곳이 없을 때(링크로 바로 들어옴). */
  fallback?: string;
  children: ReactNode;
  dock?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            hitSlop={Spacing.one}
            onPress={() => {
              if (onBack) {
                onBack();
                return;
              }
              if (router.canGoBack()) router.back();
              else router.replace(fallback as never);
            }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <ProductSymbol name="chevronLeft" size={Layout.iconTab} color={theme.text} />
          </Pressable>
          <ThemedText type="t5" numberOfLines={1} style={styles.navTitle}>
            {title}
          </ThemedText>
          {right}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {dock ? (
          <View style={[styles.dock, { borderTopColor: theme.border }]}>{dock}</View>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

/** 헤더 오른쪽 글자 액션. 13-my-sub navRightStyle 16/22 700 — brand면 코랄. */
export function NavAction({
  label,
  onPress,
  brand,
  disabled,
}: {
  label: string;
  onPress: () => void;
  brand?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={Spacing.two}
      style={[styles.navAction, disabled && styles.disabled]}>
      <ThemedText type="t6" themeColor={brand ? 'tint' : 'textSecondary'} style={styles.bold}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** dock — 왼쪽 ghost(flex 1) · 오른쪽 primary(flex 1.4). 하나만 두면 primary가 꽉 찬다. */
export function Dock({
  primary,
  secondary,
}: {
  primary: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean };
  secondary?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const theme = useTheme();

  return (
    <>
      {secondary ? (
        <View style={styles.dockGhost}>
          <ActionButton
            size="xlarge"
            label={secondary.label}
            disabled={secondary.disabled}
            onPress={secondary.onPress}
          />
        </View>
      ) : null}
      <View style={secondary ? styles.dockPrimary : styles.dockFull}>
        <ActionButton
          variant="primary"
          size="xlarge"
          label={primary.label}
          disabled={primary.disabled}
          /* 13b ctaDangerWide — 탈퇴만 빨강. 그 밖의 primary는 스킨 색. */
          tone={primary.danger ? { background: theme.negative, text: theme.onTint } : undefined}
          onPress={primary.onPress}
        />
      </View>
    </>
  );
}

// ─── 블록 ─────────────────────────────────────────────────────

/** padHero — eyebrow(14/19 700 coral) · 제목 26/35(2줄) · 서브 16/24 gray700(1줄). */
export function Hero({
  eyebrow,
  lines,
  sub,
}: {
  eyebrow?: string;
  lines: readonly string[];
  sub?: string;
}) {
  return (
    <View style={styles.hero}>
      {eyebrow ? (
        <ThemedText type="t7" themeColor="tint" style={styles.bold}>
          {eyebrow}
        </ThemedText>
      ) : null}
      <ThemedText type="t2">{lines.join('\n')}</ThemedText>
      {sub ? (
        <ThemedText type="body" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** padSec — 제목 14/19 700 gray600 한 줄, 아래 내용. */
export function Section({
  title,
  children,
  gap = 'my',
  style,
}: {
  title?: string;
  children: ReactNode;
  /** 13-my-sub는 아래 24 · gap 10, 15-events는 아래 28 · gap 12. */
  gap?: 'my' | 'events';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[gap === 'events' ? styles.sectionEvents : styles.section, style]}>
      {title ? <SectionTitle>{title}</SectionTitle> : null}
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1} style={styles.bold}>
      {children}
    </ThemedText>
  );
}

/** rows — 행 사이 2, 행마다 아래 선 1. */
export function Rows({ children }: { children: ReactNode }) {
  return <View style={styles.rows}>{children}</View>;
}

/** 배지는 디자인 시스템 것을 그대로 쓴다 — height 22 · 4 9 · radius 4 · 14/19/700. */
export { Badge, type BadgeKind };

/** 체크 원 24 — 켜짐: coral 바탕 흰 체크 16 · 꺼짐: 1.5 gray300 테두리. */
export function CheckDot({ on }: { on: boolean }) {
  const theme = useTheme();

  return on ? (
    <View style={[styles.checkDot, { backgroundColor: theme.tint }]}>
      <ProductSymbol name="check" size={CHECK_GLYPH} color={theme.onTint} />
    </View>
  ) : (
    <View style={[styles.checkDot, styles.checkRing, { borderColor: theme.track }]} />
  );
}

/**
 * 목록 행. 이름 18/24 400 · 메타 14/19 gray600 · 꼬리(글자 16/22 700 또는 배지) · chevron 18.
 * 메타가 있으면 위 정렬 · 상하 14, 없으면 가운데 · 상하 12. 아래 선 1 gray200.
 */
export function Row({
  lead,
  name,
  meta,
  tail,
  tailDim,
  tailBadge,
  chevron,
  off,
  danger,
  onPress,
  right,
  accessibilityLabel,
}: {
  lead?: ReactNode;
  name: string;
  meta?: string;
  /** 오른쪽 글자. 숫자는 tabular. */
  tail?: string;
  /** 회색 꼬리(«하기» · 값 표시). */
  tailDim?: boolean;
  tailBadge?: BadgeKind;
  chevron?: boolean;
  /** 이미 끝난 항목 — 이름이 회색(gray500). */
  off?: boolean;
  /** 연결 끊기 같은 위험 행동 — 이름이 빨강. */
  danger?: boolean;
  onPress?: () => void;
  /** 꼬리 자리에 직접 놓는 것(스위치 · 로고). */
  right?: ReactNode;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const nameColor: ThemeColor = danger ? 'negative' : off ? 'textDisabled' : 'text';
  const body = (
    <>
      {lead}
      <View style={styles.rowText}>
        <ThemedText type="t5" themeColor={nameColor} numberOfLines={1} style={styles.regular}>
          {name}
        </ThemedText>
        {meta ? (
          <ThemedText type="t7" themeColor="textAssistive" numeric>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      {tail !== undefined && tailBadge ? (
        <Badge kind={tailBadge}>{tail}</Badge>
      ) : tail !== undefined ? (
        <ThemedText
          type="t6"
          numeric
          numberOfLines={1}
          themeColor={tailDim ? 'textAssistive' : 'text'}
          style={styles.bold}>
          {tail}
        </ThemedText>
      ) : null}
      {right}
      {chevron ? (
        <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
      ) : null}
    </>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => [styles.row, meta ? styles.rowTall : null, pressed && styles.pressed]}>
          {body}
        </Pressable>
      ) : (
        <View style={[styles.row, meta ? styles.rowTall : null]}>{body}</View>
      )}
      <View style={[styles.hr, { backgroundColor: theme.border }]} />
    </View>
  );
}

/** 값 한 줄(«예식일 ↔ 2027.05.16»). 13b kvRow — 16/22 gray700 ↔ 16/22 700 tabular. */
export function KeyValueRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  const theme = useTheme();

  return (
    <View>
      <View style={styles.kvRow}>
        <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText
          type="t6"
          numeric
          numberOfLines={1}
          themeColor={dim ? 'textDisabled' : 'text'}
          style={[styles.bold, styles.kvValue]}>
          {value}
        </ThemedText>
      </View>
      <View style={[styles.hr, { backgroundColor: theme.border }]} />
    </View>
  );
}

/** statBox — 큰 숫자 32/43 · 설명 14/19 gray600 · (진행바 6). */
export function StatBox({
  value,
  note,
  progress,
}: {
  value: string;
  note?: string;
  /** 0~1. 없으면 막대를 그리지 않는다. */
  progress?: number;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.statBox}>
      <ThemedText type="amount" numeric>
        {value}
      </ThemedText>
      {note ? (
        <ThemedText type="t7" themeColor="textAssistive" numeric>
          {note}
        </ThemedText>
      ) : null}
      {progress !== undefined ? <ProgressBar value={progress} height={TRACK_HEIGHT} /> : null}
    </ThemedView>
  );
}

/** noteBox — 제목 18/24 700 · 본문 16/24 gray700. 화면 맨 아래 «무엇을 바꾸면 무엇이 달라지는지». */
export function NoteBox({ title, body }: { title: string; body?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.noteBox}>
      <ThemedText type="t5">{title}</ThemedText>
      {body ? (
        <ThemedText type="body" themeColor="textSecondary">
          {body}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

/** emptyBox — 비어 있을 때 한 줄. */
export function EmptyBox({ children }: { children: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.emptyBox}>
      <ThemedText type="body" themeColor="textSecondary">
        {children}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * 캠페인 카드(15-events). 배지 + 메타 · 제목 18/24 700 · 본문 16/24 gray700 · 진행바 · CTA 48.
 * brand 카드는 coral 7% 바탕 · 32% 테두리 — 참여 중인 것 하나만.
 */
export function CampaignCard({
  badge,
  badgeKind,
  meta,
  title,
  body,
  progress,
  cta,
  ctaOff,
  onPress,
  brand,
}: {
  badge: string;
  badgeKind?: BadgeKind;
  meta?: string;
  title: string;
  body?: string;
  progress?: number;
  cta?: string;
  /** 끝난 캠페인 — 회색 버튼. */
  ctaOff?: boolean;
  onPress?: () => void;
  brand?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        brand
          ? { backgroundColor: theme.tintSubtle, borderColor: theme.tintBorder }
          : { backgroundColor: theme.background, borderColor: theme.track },
      ]}>
      <View style={styles.cardHead}>
        <Badge kind={badgeKind}>{badge}</Badge>
        {meta ? (
          <ThemedText type="t7" themeColor="textAssistive" numeric numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="t5">{title}</ThemedText>
      {body ? (
        <ThemedText type="body" themeColor="textSecondary">
          {body}
        </ThemedText>
      ) : null}
      {progress !== undefined ? <ProgressBar value={progress} height={TRACK_HEIGHT} /> : null}
      {/* 끝난 캠페인의 CTA는 회색이지만 눌린다 — «응모 내역 보기»처럼 볼 것이 남아 있다. */}
      {cta ? (
        <ActionButton variant={ctaOff ? 'secondary' : 'primary'} size="large" label={cta} onPress={onPress} />
      ) : null}
    </View>
  );
}

/** 카드 세로 목록 — 사이 12. */
export function CardList({ children }: { children: ReactNode }) {
  return <View style={styles.cardList}>{children}</View>;
}

/** 아바타 원 — 이니셜 한 글자. Layout.avatarProfile(56 · MY 홈) · avatarRow(32) · avatarLarge(88). */
export function Avatar({ initial, size = Layout.avatarProfile }: { initial: string; size?: number }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, backgroundColor: theme.backgroundSelected },
      ]}>
      <ThemedText type={size >= Layout.avatarProfile ? 't4' : 't7'} themeColor="textAssistive">
        {initial}
      </ThemedText>
    </View>
  );
}

// ─── 값 ───────────────────────────────────────────────────────

/** 체크 원 안의 획 16. 시안 check(): background-size 16px. */
const CHECK_GLYPH = Spacing.three;
/** 진행 막대 6. 시안 track: height 6px. */
const TRACK_HEIGHT = Spacing.one + Spacing.half;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /* navBack 56 · 뒤로 40 원형 — 아이콘 24가 거터선(24)에 앉는다. */
  nav: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Layout.gutter - (Layout.iconButton - Layout.iconTab) / 2,
    paddingRight: Layout.gutter,
    gap: Spacing.two,
  },
  back: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1, minWidth: 0 },
  navAction: { minHeight: Layout.touchTarget, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },

  scroll: { flex: 1 },
  content: { paddingBottom: Spacing.four },

  /* dock 92 = 12 + 52 + 28. 위 선 1. */
  dock: {
    minHeight: Layout.dock,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Layout.sectionGap,
    borderTopWidth: 1,
  },
  dockGhost: { flex: 1 },
  dockPrimary: { flex: 1.4 },
  dockFull: { flex: 1 },

  /* padHero 12 24 24 · gap 8 */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  /* padSec — 13-my-sub 0 24 24 · gap 10 / 15-events 0 24 28 · gap 12 */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four,
    gap: Layout.cardGap,
  },
  sectionEvents: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: Layout.rowPaddingY,
  },
  rows: { gap: Spacing.half },

  /* SEED는 400 · 700 둘뿐 — 굵기는 이 두 곳에서만 바꾼다. */
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },

  /* 행 — min 56 · 12 0 · gap 12 · 메타 있으면 14 0 위 정렬 */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  rowTall: {
    alignItems: 'flex-start',
    paddingVertical: Layout.sectionHeadGap,
  },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.half },
  hr: { height: 1 },

  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  kvValue: { flexShrink: 1, textAlign: 'right' },

  checkDot: {
    width: Spacing.four,
    height: Spacing.four,
    flexShrink: 0,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRing: { borderWidth: 1.5 },

  statBox: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Layout.cardGap,
  },
  noteBox: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },
  emptyBox: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
  },

  /* 카드 radius 10 · 1 테두리 · 18 20 · gap 10 */
  card: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Layout.cardPadding - Spacing.half,
    gap: Layout.cardGap,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardList: { gap: Layout.rowPaddingY },

  avatar: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
