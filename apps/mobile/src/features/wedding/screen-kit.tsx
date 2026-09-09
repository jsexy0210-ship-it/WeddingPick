import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  Badge as UiBadge,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  TextField,
  ThemedText,
  ThemedView,
  useTheme,
  type BadgeKind,
  type ThemeColor,
} from '@weddingpick/ui';
import { formatMonthDayDot } from '@/features/common/format-date';
import { useDepthBack } from '@/features/navigation/depth-back';

/**
 * 웨딩일정 · 제보 하위 화면의 공용 조각 — 핸드오프 08-schedule-sub · 08c · 11-report-review ·
 * 12-closing · 14-couple의 renderVals를 그대로 옮겼다.
 *
 *   navBack   56 · padding 0 20 0 12 · gap 8 · 뒤로 40 원 · 제목 18/24 700 · 오른쪽 16/22 700
 *   hero      padding 12 24 24 · gap 8 · 26/35 · 서브 16/24 · eyebrow 14/19 700 coral
 *   section   padding 0 24 24 · 라벨 14/19 700 tertiary → 내용 10
 *   row       min 56 · padding 12(한 줄) / 14(두 줄) 0 · gap 12 · 제목 18/24 400 · 부제 14/19 · 아래 선 1
 *   badge     padding 4 9 · radius 4 · 14/19 700 · 한 줄
 *   note      radius 10 · recessed · padding 20 · gap 8 · 18/24 700 + 16/24
 *   dock      92 · padding 12 24 · gap 8 · 버튼 52 · 위 선 1
 *   dateChip  52 · 월 14/19 tertiary · 일 bold tabular
 *
 * 화면이 같은 값을 여섯 번 적지 않게 한 곳에 둔다. 값은 전부 `@weddingpick/ui` 토큰이다.
 */

/* ------------------------------------------------------------------ 뼈대 */

/** 화면 껍데기 — 가운데 정렬 · 최대 폭 · 위 안전영역. 아래는 탭 바 · dock이 맡는다. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

export type NavBarProps = {
  /** 없으면 뒤로가기만 있는 56 줄이 된다 — 화면이 제 제목을 Hero로 들고 있을 때. */
  title?: string;
  /** «<»(기본) 또는 흐름 밖으로 빠지는 «✕». */
  variant?: 'back' | 'close';
  /** 진짜 예외 — 화면 안에서 단계를 되돌릴 때만 넘긴다(편집 취소 등). */
  onBack?: () => void;
  /** 오른쪽 텍스트 액션 — «추가»(brand) · «수정»(회색). */
  right?: { label: string; onPress: () => void; brand?: boolean; disabled?: boolean } | null;
};

/**
 * 하위 화면 헤더. 시안 `navBack` — 제목은 뒤로가기 옆에 왼쪽 정렬로 앉는다.
 *
 * 뒤로가기는 **Depth Back**이다(`features/navigation/depth-back-rules.ts`). 화면마다
 * `fallback`을 적던 자리를 없앴다 — 규칙이 현재 경로에서 부모를 계산한다.
 */
export function NavBar({ title, variant = 'back', onBack, right }: NavBarProps) {
  const theme = useTheme();
  const depthBack = useDepthBack();

  return (
    <View style={styles.nav}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={variant === 'close' ? '닫기' : '뒤로'}
        onPress={onBack ?? depthBack}
        style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
        <ProductSymbol
          name={variant === 'close' ? 'close' : 'chevronLeft'}
          size={Layout.iconTab}
          color={theme.text}
        />
      </Pressable>
      <ThemedText type="t5" numberOfLines={1} style={styles.navTitle}>
        {title ?? ''}
      </ThemedText>
      {right ? (
        <Pressable
          accessibilityRole="button"
          disabled={right.disabled}
          onPress={right.onPress}
          hitSlop={8}
          style={({ pressed }) => [pressed && styles.pressed, right.disabled && styles.disabled]}>
          <ThemedText type="t6" themeColor={right.brand ? 'tint' : 'textSecondary'} style={styles.bold}>
            {right.label}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export type HeroProps = {
  /** 위 한 줄 — «D-11 · 2027.03.14(금)» · «2027.05.16(토) · 예식 완료». coral 14/19 700. */
  eyebrow?: string | null;
  title: string;
  /** 아래 한 줄 16/24. */
  sub?: string | null;
  children?: ReactNode;
};

/** 화면 히어로 — padding 12 24 24 · gap 8 · 26/35. */
export function Hero({ eyebrow, title, sub, children }: HeroProps) {
  return (
    <View style={styles.hero}>
      {eyebrow ? (
        <ThemedText type="t7" themeColor="tint" numeric style={styles.bold}>
          {eyebrow}
        </ThemedText>
      ) : null}
      <ThemedText type="t2">{title}</ThemedText>
      {sub ? (
        <ThemedText type="body" themeColor="textSecondary">
          {sub}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

export type SectionProps = {
  /** 작은 그룹 라벨 14/19 700 tertiary — «지난 일정» · «알림» · «업종별». */
  label?: string;
  /** 섹션 제목 20/27 — «다가오는 일정» · «분할 결제». */
  title?: string;
  /** 제목 오른쪽 «전체 보기». */
  action?: { label: string; onPress: () => void } | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 섹션 — padding 0 24 24 · 제목/라벨 → 내용 10 · 행 사이 2. */
export function Section({ label, title, action, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {label || title ? (
        <View style={styles.sectionHead}>
          {title ? <ThemedText type="t4">{title}</ThemedText> : <GroupLabel>{label}</GroupLabel>}
          {action ? (
            <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
              <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                {action.label}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.list}>{children}</View>
    </View>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
      {children}
    </ThemedText>
  );
}

/** 섹션을 가르는 gray100 밴드 16. 다음 섹션 위 여백은 밴드가 아니라 섹션이 든다(0 24 24). */
export function Band() {
  const theme = useTheme();

  return <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />;
}

/* ------------------------------------------------------------------ 행 */

export type ListRowProps = {
  /** 왼쪽 조각 — 날짜칩 · 아바타 · 체크. */
  left?: ReactNode;
  title: string;
  titleColor?: ThemeColor;
  /** 제목을 700으로. 기본은 시안대로 400. */
  titleBold?: boolean;
  /** 제목 줄 수. 기본 1 — 동의 문장처럼 끊으면 뜻이 사라지는 것만 늘린다. */
  titleLines?: number;
  sub?: string | null;
  subLines?: number;
  /** 오른쪽 조각 — 금액 · D-day · 배지 · 시간. */
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 마지막 행도 선을 긋는다(시안 기본). 카드 안에서는 끈다. */
  divider?: boolean;
};

/** 목록 한 행. 두 줄이면 padding 14 0, 한 줄이면 12 0 — 시안 `row84` · `row80`. */
export function ListRow({
  left,
  title,
  titleColor = 'text',
  titleBold = false,
  titleLines = 1,
  sub,
  subLines = 2,
  right,
  onPress,
  accessibilityLabel,
  divider = true,
}: ListRowProps) {
  const theme = useTheme();
  const body = (
    <View style={[styles.row, sub ? styles.rowTwoLine : styles.rowOneLine]}>
      {left}
      <View style={styles.rowBody}>
        <ThemedText type="t5" themeColor={titleColor} numberOfLines={titleLines} style={!titleBold && styles.regular}>
          {title}
        </ThemedText>
        {sub ? (
          <ThemedText type="t7" themeColor="textAssistive" numberOfLines={subLines}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          style={({ pressed }) => pressed && styles.pressed}>
          {body}
        </Pressable>
      ) : (
        body
      )}
      {divider ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
    </View>
  );
}

/** 라벨 ↔ 값 한 줄 — 지출 상세 6행. 라벨 16/22 secondary · 값 16/22 700. */
export function KeyValueRow({
  label,
  value,
  valueColor = 'text',
  numeric,
  divider = true,
}: {
  label: string;
  value: string;
  valueColor?: ThemeColor;
  numeric?: boolean;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      <View style={[styles.row, styles.rowOneLine, styles.keyValue]}>
        <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1} style={styles.rowBody}>
          {label}
        </ThemedText>
        <ThemedText type="t6" themeColor={valueColor} numeric={numeric} numberOfLines={1} style={styles.bold}>
          {value}
        </ThemedText>
      </View>
      {divider ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
    </View>
  );
}

/** 오른쪽 값 16/22 — D-day · 시간 · «남음». */
export function RowValue({
  children,
  color = 'textAssistive',
  bold = false,
  numeric = true,
}: {
  children: ReactNode;
  color?: ThemeColor;
  bold?: boolean;
  numeric?: boolean;
}) {
  return (
    <ThemedText type="t6" themeColor={color} numeric={numeric} numberOfLines={1} style={bold && styles.bold}>
      {children}
    </ThemedText>
  );
}

/* ------------------------------------------------------------------ 조각 */

export type BadgeTone = 'ok' | 'wait' | 'no' | 'now' | 'none';

/** 시안 톤 이름 → 공용 `Badge` kind. now(좁히는 중 · 인증)는 brand다. */
const BADGE_KIND: Record<BadgeTone, BadgeKind> = { ok: 'ok', wait: 'wait', no: 'no', now: 'brand', none: 'none' };

/**
 * 배지 — 공용 `Badge`(tokens.json component.badge · SPEC 12.3: 22 · padding 4 9 · radius 4 · 한 줄).
 * ok 초록(결정 · 반영됨 · 공유) · wait 노랑(확인 중) · no 빨강(반려 · 공유 종료) ·
 * now coral(좁히는 중 · 인증) · none 회색(시작 전 · 각자).
 */
export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <UiBadge kind={BADGE_KIND[tone]} style={styles.badge}>
      {label}
    </UiBadge>
  );
}

/** 안내 카드 — radius 10 · recessed · padding 20 · 제목 18/24 700 · 본문 16/24. */
export function NoteCard({ title, body }: { title: string; body: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="t5">{title}</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        {body}
      </ThemedText>
    </View>
  );
}

/** 라벨 14/19 + 값 18/24 700 카드 — 연결 완료 · 제출 완료의 «반영 카드». padding 18 20 · gap 3. */
export function InfoCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="t7" themeColor="textAssistive">
        {label}
      </ThemedText>
      <ThemedText type="t5">{value}</ThemedText>
    </View>
  );
}

/** 요약 카드 — radius 10 · recessed · padding 20 · 요소 사이 12(지출 총액 상자). */
export function StatCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();

  return <View style={[styles.statCard, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

/** 날짜칩 52 — 월 14/19 tertiary 위에 일 bold. 시안 22/29는 토큰에 없어 heading(24/32)을 쓴다. */
export function DateChip({ date, muted = false }: { date: string | Date; muted?: boolean }) {
  const value = typeof date === 'string' ? new Date(date) : date;

  return (
    <View style={styles.dateChip}>
      <ThemedText type="t7" themeColor="textAssistive" numeric>
        {value.getMonth() + 1}월
      </ThemedText>
      <ThemedText type="t3" themeColor={muted ? 'textDisabled' : 'text'} numeric>
        {String(value.getDate()).padStart(2, '0')}
      </ThemedText>
    </View>
  );
}

/** 체크 24 · radius 4 — 켜짐은 coral 채움, 꺼짐은 테두리. 시안 `check`. */
export function CheckBox({ checked }: { checked: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.check,
        checked
          ? { backgroundColor: theme.tint }
          : { borderWidth: 1, borderColor: theme.track, backgroundColor: theme.background },
      ]}>
      {checked ? <ProductSymbol name="check" size={16} color={theme.onTint} /> : null}
    </View>
  );
}

/** 라디오 24 — 원. 시안 `radio`. */
export function RadioDot({ on }: { on: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.radio,
        on ? { backgroundColor: theme.tint } : { borderWidth: 1, borderColor: theme.track },
      ]}>
      {on ? <ProductSymbol name="check" size={14} color={theme.onTint} /> : null}
    </View>
  );
}

/** 아바타 — 내 것은 coral weak, 배우자는 gray100. 26(헤더) · 32(행) · 44(초대 수락). */
export function Avatar({
  initial,
  tone,
  size = 32,
}: {
  initial: string;
  tone: 'me' | 'partner' | 'unknown';
  size?: 26 | 32 | 44;
}) {
  const theme = useTheme();
  const bg = tone === 'me' ? theme.tintSubtle : theme.backgroundSelected;
  const fg: ThemeColor = tone === 'me' ? 'tint' : tone === 'partner' ? 'textSecondary' : 'textDisabled';

  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: bg }]}>
      <ThemedText type={size === 44 ? 't5' : 't7'} themeColor={fg} style={styles.bold}>
        {initial}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------ 입력 */

export type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** 값 아래 한 줄 — 읽은 표기 · 오류(`hintColor="negative"`면 오류로 그린다). */
  hint?: string | null;
  hintColor?: ThemeColor;
  /** 더 이상 쓰지 않는다 — 공용 `TextField`가 높이 · 여러 줄 정렬을 정한다. 옛 호출을 깨지 않으려고 받기만 한다. */
  style?: unknown;
};

/** 입력 필드 — 공용 `TextField`(tokens.json component.field: 52 · radius 6 · 1px fieldBorder · padding 0 14 · 16). */
export function Field({ label, hint, hintColor = 'textAssistive', style: _style, ...rest }: FieldProps) {
  const isError = hintColor === 'negative' && hint;

  return (
    <TextField
      label={label}
      accessibilityLabel={label}
      hint={isError ? undefined : (hint ?? undefined)}
      error={isError ? hint : undefined}
      {...rest}
    />
  );
}

/** 필드처럼 보이는 버튼 — 날짜처럼 눌러서 고르는 값. */
export function FieldButton({
  label,
  value,
  placeholder,
  onPress,
  open = false,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  open?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="t7" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.input,
          styles.inputButton,
          { borderColor: open ? theme.text : theme.fieldBorder, backgroundColor: theme.background },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="t6" themeColor={value ? 'text' : 'textDisabled'} numeric numberOfLines={1}>
          {value ?? placeholder}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ dock */

/**
 * 하단 dock — 92 + safeBottom · padding 12 24 · 버튼 사이 8 · 위 선 1.
 * 버튼은 `ActionButton size="xlarge"`(52). 왼쪽 보조 · 오른쪽 Primary 하나.
 */
export function Dock({ children, note }: { children: ReactNode; note?: string | null }) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.dock,
        {
          borderTopColor: theme.border,
          backgroundColor: theme.background,
          minHeight: Layout.dock + bottom,
          paddingBottom: Layout.rowPaddingY + bottom,
        },
      ]}>
      {note ? (
        <ThemedText type="t7" themeColor="textAssistive">
          {note}
        </ThemedText>
      ) : null}
      <View style={styles.dockRow}>{children}</View>
    </View>
  );
}

export function DockButton(props: Omit<ComponentProps<typeof ActionButton>, 'size'>) {
  return (
    <View style={styles.dockButton}>
      <ActionButton size="xlarge" {...props} />
    </View>
  );
}

/* ------------------------------------------------------------------ 시간 */

/** «3분 전 · 5시간 전 · 3일 전 · 1주 전 · 05.16(토)». 메모 · 변경 내역의 오른쪽 값. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '방금';
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}주 전`;

  return formatMonthDayDot(iso);
}

/** 오전/오후 없이 `14:00`. 시안의 «오후 2시»는 전역 표기 규칙(`05.16(토) 14:30`)으로 옮겼다. */
export function eventTime(iso: string): string {
  const value = new Date(iso);

  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ 스타일 */

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  nav: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Layout.gutter - Layout.rowPaddingY,
    paddingRight: Layout.gutter - Spacing.one,
    gap: Spacing.two,
  },
  navButton: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1, minWidth: 0 },

  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },

  section: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.cardGap },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Layout.rowPaddingY },
  list: { gap: Spacing.half },
  band: { height: Layout.sectionBand, marginBottom: Spacing.four },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: Layout.rowMinHeight,
  },
  rowOneLine: { paddingVertical: Layout.rowPaddingY },
  rowTwoLine: { paddingVertical: Layout.rowPaddingY + Spacing.half },
  rowBody: { flex: 1, minWidth: 0, gap: Spacing.half },
  keyValue: { gap: Spacing.three },
  divider: { height: 1 },

  badge: { flexShrink: 0, alignSelf: 'center' },
  note: { borderRadius: Radius.medium, padding: Layout.cardPadding, gap: Spacing.two },
  infoCard: {
    borderRadius: Radius.medium,
    paddingVertical: Layout.cardPadding - Spacing.half,
    paddingHorizontal: Layout.cardPadding,
    gap: 3,
  },
  statCard: { borderRadius: Radius.medium, padding: Layout.cardPadding, gap: Layout.rowPaddingY },

  dateChip: { width: 52, flexShrink: 0, alignItems: 'center' },
  check: {
    width: Layout.iconTab,
    height: Layout.iconTab,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radio: {
    width: Layout.iconTab,
    height: Layout.iconTab,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatar: { borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  field: { gap: Spacing.one + Spacing.half },
  input: {
    minHeight: Layout.field,
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.three - Spacing.half,
  },
  inputButton: { justifyContent: 'center' },

  dock: {
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    gap: Spacing.two,
  },
  dockRow: { flexDirection: 'row', gap: Spacing.two },
  dockButton: { flex: 1 },

  bold: { fontWeight: 700 },
  regular: { fontWeight: 400 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
