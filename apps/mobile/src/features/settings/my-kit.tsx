import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  Badge,
  Border,
  type BadgeKind,
  CanonGray,
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
import { DepthHeader } from '@/components/depth-header';

/**
 * MY 하위 · 혜택 화면 공통 부품. 디자인 핸드오프 `13-my-sub` · `15-events` · `13b-withdrawal`의
 * renderVals를 그대로 옮겼다 — 값은 전부 `@weddingpick/ui` 토큰에서 온다.
 *
 * **그 핸드오프는 파기됐다**(2026-09-22). 앱 정본은 `docs/design/React_Native/my.js`이고,
 * 아래 값 가운데 정본과 다른 것(행 56→52 · 이름 18→15 · 섹션 제목 14→13 · 섹션 아래 24→20 ·
 * gap 10→12)은 MY 하위 화면 전체가 함께 바뀌는 자리라 `DESIGN_UNRESOLVED`로 올려 두었다.
 *
 *   navBack   56 · 뒤로 40 원형 · 제목 18/24 700 · 오른쪽 글자 액션
 *   padHero   12 24 24 · gap 8 · 26/35 700 + 16/24 gray700
 *   padSec    0 24 28(24) · 섹션 제목 14/19 700 gray600
 *   row       min 56 · 12 0 · gap 12 · 이름 18/24 400 · 메타 14/19 gray600 · 꼬리 16/22 700 · 구분선 1 gray200
 *   badge     @weddingpick/ui Badge — 최소 22 · 4 9 · radius 4 · 14/19 700
 *   check     24 원 · coral + 흰 체크 16 / 1.5 gray300 테두리
 *   statBox   radius 10 · gray50 · 20 · gap 10        noteBox  radius 10 · gray50 · 20 · gap 8
 *   card      radius 10 · 1 gray300 · 18 20 · gap 10  brand 카드는 coral 7% 바탕 · 32% 테두리
 *   dock      92 = 12 + 52 + 28 · 위 선 1 · ghost flex 1 · primary flex 1.4
 */

// ─── 화면 껍데기 ───────────────────────────────────────────────

/**
 * MY 하위 화면 껍데기. 뒤로가기는 **Depth Back**이다 —
 * `features/navigation/depth-back-rules.ts`가 현재 경로에서 부모를 계산한다.
 * 화면마다 `fallback`을 적던 자리는 없앴다(혜택 하위가 MY로 튀던 원인).
 */
export function SubScreen({
  title,
  right,
  onBack,
  children,
  dock,
  contentStyle,
}: {
  title: string;
  /** 오른쪽 글자 액션(«저장» · «참여 내역»). */
  right?: ReactNode;
  /** 진짜 예외 — 화면 안에서 단계를 되돌릴 때만 넘긴다. */
  onBack?: () => void;
  children: ReactNode;
  dock?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <DepthHeader title={title} right={right} onBack={onBack} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {dock ? (
          <View
            style={[
              styles.dock,
              /* 정본 dock 아래 48은 기기 홈 표시줄 자리를 포함한다 — 안전 영역만큼 덜어 낸다. */
              { borderTopColor: theme.border, paddingBottom: Math.max(DOCK_BOTTOM - insets.bottom, Layout.rowPaddingY) },
            ]}>
            {dock}
          </View>
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
  primary: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; icon?: ReactNode };
  secondary?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const theme = useTheme();

  return (
    <>
      {secondary ? (
        <View style={styles.dockGhost}>
          <ActionButton
            size="sheet"
            label={secondary.label}
            disabled={secondary.disabled}
            onPress={secondary.onPress}
          />
        </View>
      ) : null}
      <View style={secondary ? styles.dockPrimary : styles.dockFull}>
        <ActionButton
          variant="primary"
          size="sheet"
          label={primary.label}
          icon={primary.icon}
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

/** 정본 qBlock — 16 20 20(좌우는 공통 24) · gap 8 · 제목 26/35 700(2줄) · 서브 15 muted(qSub · 1줄). */
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
        <ThemedText type="f15" themeColor="textAssistive" numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** padSec — 제목 14/19 700 gray600 한 줄, 아래 내용. `big`이면 20/27 700 먹색. */
export function Section({
  title,
  children,
  gap = 'my',
  big = false,
  style,
}: {
  title?: string;
  children: ReactNode;
  /** 13-my-sub는 아래 24 · gap 10, 15-events는 아래 28 · gap 12. */
  gap?: 'my' | 'events';
  /** 시안 s20 — 화면을 나누는 큰 제목. 13-my-sub L186이 두 단계를 함께 정의한다. */
  big?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[gap === 'events' ? styles.sectionEvents : styles.section, style]}>
      {title ? <SectionTitle big={big}>{title}</SectionTitle> : null}
      {children}
    </View>
  );
}

/**
 * 섹션 제목. 두 단계다 — `13-my-sub.dc.html` L186이 `o.big ? 20/27 #212124 : 14/19 #868b94`로
 * 한 줄에 적어 둔 그대로다.
 *
 * 작은 쪽은 목록 위 라벨이고 큰 쪽은 화면을 나누는 제목이다. 큰 자리에 작은 것을 쓰면
 * (FAQ 답변의 「비슷한 질문」처럼) 제목이 앞 내용의 꼬리처럼 붙어 읽힌다.
 */
export function SectionTitle({ children, big = false }: { children: string; big?: boolean }) {
  return (
    <ThemedText
      type={big ? 't4' : 'f13'}
      themeColor={big ? 'text' : 'textAssistive'}
      numberOfLines={1}
      style={styles.bold}>
      {children}
    </ThemedText>
  );
}

/** rows — 행 사이 2, 행마다 아래 선 1. */
export function Rows({ children }: { children: ReactNode }) {
  /* 정본 `ROW(last)` — 마지막 행은 아래 선이 없다(카드 테두리가 대신한다). */
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ last?: boolean }>[];

  return (
    <View>
      {items.map((item, index) => (index === items.length - 1 ? cloneElement(item, { last: true }) : item))}
    </View>
  );
}

/**
 * 정본 `cat()`(my.js) — 34 · 0 14 · pill · 13/700. 켜짐 먹색 바탕 흰 글자 · 꺼짐 #f2f3f6 바탕 #4d5159.
 * FAQ · 라운지 칩바가 쓴다(공용 FilterChip은 36/14 — pick.js `chip` 규격이라 여기와 다르다).
 */
export function CatChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.cat, { backgroundColor: selected ? theme.text : theme.backgroundSelected }]}>
      <ThemedText type="f13" numberOfLines={1} style={[styles.bold, { color: selected ? theme.background : CanonGray.gray700 }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 정본 토글(my.js `track` · `knob`) — 44 × 26 · 안쪽 3 · 흰 원 20. 켜짐 코랄 · 꺼짐 #dcdee3. */
export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: disabled === true }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[
        styles.toggle,
        { backgroundColor: value ? theme.tint : theme.track, justifyContent: value ? 'flex-end' : 'flex-start' },
      ]}>
      <View style={[styles.knob, { backgroundColor: theme.onTint }]} />
    </Pressable>
  );
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
  inset,
  wide,
  tall,
  last,
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
  /** 테두리 카드 안 행의 정본 좌우 여백(16 · my.js `LI`). 구분선 폭은 카드 전체를 유지한다. */
  inset?: boolean;
  /** 정본 `ROW` · `rowPlain` — 좌우 20. `inset`보다 넓은 행(알림 · 계정). */
  wide?: boolean;
  /** 정본 `li2` · `profileBasic` — 최소 높이 64 · 56. 기본은 52. */
  tall?: 56 | 64;
  /** `Rows`가 채운다 — 마지막 행은 아래 선을 긋지 않는다. */
  last?: boolean;
}) {
  const theme = useTheme();
  const nameColor: ThemeColor = danger ? 'negative' : off ? 'textDisabled' : 'text';
  const body = (
    <>
      {lead}
      <View style={styles.rowText}>
        <ThemedText type="f15" themeColor={nameColor} numberOfLines={1} style={styles.regular}>
          {name}
        </ThemedText>
        {meta ? (
          <ThemedText type="f12" themeColor="textAssistive" numeric>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      {tail !== undefined && tailBadge ? (
        <Badge kind={tailBadge}>{tail}</Badge>
      ) : tail !== undefined ? (
        <ThemedText
          type="f15"
          numeric
          numberOfLines={1}
          themeColor={tailDim ? 'textAssistive' : 'text'}
          style={styles.bold}>
          {tail}
        </ThemedText>
      ) : null}
      {right}
      {chevron ? (
        <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} />
      ) : null}
    </>
  );

  /* 정본 행은 선을 안쪽 그림자(inset 0 -1px 0)로 긋는다 — 행 높이에 선이 들어간다. */
  const frame = [
    styles.row,
    inset ? styles.rowInset : null,
    wide ? styles.rowWide : null,
    tall ? { minHeight: tall } : null,
    last ? null : { borderBottomWidth: Border.hairline, borderBottomColor: theme.border },
  ];

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [frame, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={frame}>{body}</View>
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

/** noteBox(my.js) — 18 · gap 5 · 제목 15/700 · 본문 13/20 muted. 화면 맨 아래 «무엇을 바꾸면 무엇이 달라지는지». */
export function NoteBox({ title, body }: { title: string; body?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.noteBox}>
      <ThemedText type="f15" style={styles.bold}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText type="f13" themeColor="textAssistive">
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
          /* 시안 15-events.dc.html L157 — 코랄 7%(tintSurface)다. tintSubtle은 12%라 더 짙다. */
          ? { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }
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

/**
 * 아바타 원 — 이니셜 한 글자. 두 자리뿐이다.
 *
 *   MY 프로필 카드 `profAvatar`  52 · #fff5f2 · 코랄 20/700  (my.jsx frame-001)
 *   프로필 `avatarBig`           88 · #fff5f2 · 코랄 32/700  (my.jsx frame-002)
 */
export const AVATAR_MY = 52;

export function Avatar({ initial, size = AVATAR_MY }: { initial: string; size?: number }) {
  const theme = useTheme();
  const large = size >= Layout.avatarLarge;

  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: theme.tintSurface }]}>
      <ThemedText type={large ? 'f32' : 'f20'} themeColor="tint" style={styles.avatarText}>
        {initial}
      </ThemedText>
    </View>
  );
}

// ─── 값 ───────────────────────────────────────────────────────

/** 정본 dock 아래 여백 48(미리보기 기준 — 홈 표시줄 자리 포함). */
const DOCK_BOTTOM = 48;
/** 체크 원 안의 획 16. 시안 check(): background-size 16px. */
const CHECK_GLYPH = Spacing.three;
/** 진행 막대 6. 시안 track: height 6px. */
const TRACK_HEIGHT = Spacing.one + Spacing.half;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  navAction: { minHeight: Layout.touchTarget, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },

  scroll: { flex: 1 },
  /* 정본 scroll `padding-top:16px`. */
  content: { paddingTop: Spacing.three, paddingBottom: Spacing.four },

  /* 정본 dockSingle · dockTwo — 위 12 · CTA 56 · 아래 48(= 116, 미리보기가 그린 높이) · 사이 10 · 위 선 1. */
  dock: {
    flexDirection: 'row',
    gap: Layout.cardGap,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    borderTopWidth: 1,
  },
  dockGhost: { flex: 1 },
  dockPrimary: { flex: 1.4 },
  dockFull: { flex: 1 },

  /* qBlock 16 · 20(좌우 공통 24) · 아래 20 · gap 8 */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Layout.listGap,
    gap: Spacing.two,
  },
  /* 정본 sec — 0 20 20(좌우 공통 24) · gap 12 / 15-events 0 24 28 · gap 12 */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    gap: Layout.inlineGap,
  },
  sectionEvents: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: Layout.rowPaddingY,
  },

  /* SEED는 400 · 700 둘뿐 — 굵기는 이 두 곳에서만 바꾼다. */
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },

  /* 정본 ROW · LI — 최소 52 · gap 12 · 가운데 정렬. 메타는 setCol gap 3. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 52,
  },
  rowInset: { paddingHorizontal: Spacing.three },
  rowWide: { paddingHorizontal: Layout.listGap },
  rowText: { flex: 1, minWidth: 0, gap: Layout.cardNameGap },
  hr: { height: 1 },

  /* 정본 track 44 × 26 · 안쪽 3 · knob 20. */
  toggle: {
    width: 44,
    height: 26,
    flexShrink: 0,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  knob: { width: 20, height: 20, borderRadius: Radius.pill },
  /* 정본 cat — 34 · 0 14 · pill. */
  cat: {
    height: 34,
    paddingHorizontal: Layout.chipPaddingX,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    flexShrink: 0,
  },

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
    padding: Layout.cardPaddingCompactY,
    gap: 5,
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
  avatarText: { fontWeight: 700 },
});
