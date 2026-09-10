/**
 * 관리자 콘솔 공용 부품.
 *
 * 시안은 `docs/design-handoff/current/html/22-admin-ops.dc.html`(v3.27)이고 규칙은
 * `docs/design-handoff/current/ADMIN.md`의 「공통 규칙」이다. 화면마다 배너·카드·표를
 * 따로 그리면 여섯 규칙 중 무엇 하나는 반드시 어긋난다 — 여기 한 곳에서만 그린다.
 *
 *   1. 상단 배너가 상태를 먼저 말한다 — `StatusBanner` (초록 · 주황 · 빨강)
 *   2. 빈 상태가 정상 상태다 — `EmptyState`
 *   3. 숫자는 tabular-nums — `Kpi` · `Row.num` · `DataTable` 셀이 전부 붙인다
 *   4. 표는 카드 안에서만 가로 스크롤 — `DataTable`
 *   5. 위험한 조작은 무엇이 바뀌는지 보여준 뒤 진행 — `ConfirmCard`
 *   6. 강조색은 화면당 네 곳 이하 — 코랄(`Colors.light.tint`)은 활성 메뉴 · 주요 CTA ·
 *      브랜드 마크 · 강조 수치에만 쓴다. 여기서는 `kind: 'brand'`로만 열어 둔다
 *
 * 기준 폭은 1920 × 1080 · 사이드바 240이다. 늘어나는 규칙도 여기 들어 있다 —
 * 표는 폭을 다 쓰고 남는 폭을 `grow` 열이 먹고, `CardGrid`는 카드 폭이 아니라 칸 수를
 * 늘리고, 흐르는 글은 `FLOW_MAX`에서 멈춘다.
 *
 * 값은 전부 `spec/tokens.json`에서 온다 — 이 파일에 hex를 적지 않는다.
 */
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight, Radius, Spacing } from '@weddingpick/ui';

const C = Colors.light;

/** 상태 세 가지. ADMIN.md — 문제 없으면 초록, 확인할 것이 있으면 주황, 조치가 필요하면 빨강. */
export type Tone = 'ok' | 'warn' | 'bad';
/** 배지·숫자에만 쓰는 보조 색. `brand`는 강조색이라 화면당 네 곳 이하를 지켜야 한다. */
export type Kind = Tone | 'brand' | 'none' | 'dim';

/**
 * 흐르는 글 한 줄의 상한. ADMIN.md — 「글이 흐르는 블록은 한 줄 100자에서 멈춤」.
 * 한글은 전각이라 글자 수 × 글자 크기가 곧 줄 길이다.
 */
const FLOW_MAX = FontSize.t7 * 100;

/** 카드 한 칸의 최소 폭. 1920 기준 본문에서 두 칸이 되고, 더 넓어지면 칸 수가 는다. */
const CARD_MIN = 560;

const TONE_FG: Record<Tone, string> = {
  ok: C.positive,
  warn: C.cautionary,
  bad: C.negative,
};

const TONE_BG: Record<Tone, string> = {
  ok: C.positiveBackground,
  warn: C.adminBannerWarn,
  bad: C.negativeBackground,
};

const TONE_ICON_BG: Record<Tone, string> = {
  ok: C.adminBannerOkIcon,
  warn: C.cautionaryBackground,
  bad: C.adminBannerBadIcon,
};

const KIND_FG: Record<Kind, string> = {
  ok: C.positive,
  warn: C.cautionary,
  bad: C.negative,
  brand: C.tint,
  dim: C.textAssistive,
  none: C.text,
};

const KIND_BG: Record<Kind, string> = {
  ok: C.positiveBackground,
  warn: C.cautionaryBackground,
  bad: C.negativeBackground,
  brand: C.tintSubtle,
  dim: C.backgroundSelected,
  none: C.backgroundSelected,
};

/* ── 화면 뼈대 ─────────────────────────────────────────────── */

export type PageProps = {
  title: string;
  /** 제목 아래 한 줄. 지금 무엇을 보고 있는지. */
  sub?: string;
  /** 오른쪽 위 동작 하나. 내려받기 · 규칙 열기처럼 화면 전체에 걸리는 것만. */
  action?: { label: string; onPress: () => void; kind?: 'brand' | 'danger' | 'plain' };
  children: ReactNode;
};

/** 상단 바(76) + 본문. 사이드바는 `_layout.tsx`가 그린다. */
export function Page({ title, sub, action, children }: PageProps) {
  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <View style={styles.topbarText}>
          <Text style={styles.pageTitle} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={styles.pageSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {action ? (
          <Pressable
            onPress={action.onPress}
            style={[
              styles.topAction,
              action.kind === 'brand' && styles.topActionBrand,
              action.kind === 'danger' && styles.topActionDanger,
            ]}
          >
            <Text
              style={[
                styles.topActionLabel,
                action.kind === 'brand' && styles.onTintLabel,
                action.kind === 'danger' && styles.dangerLabel,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {children}
      </ScrollView>
    </View>
  );
}

/* ── 1. 상단 배너 ──────────────────────────────────────────── */

export type StatusBannerProps = {
  tone: Tone;
  title: string;
  /** 상태를 풀어 쓰는 한두 줄. 100자에서 멈춘다. */
  detail?: string;
  cta?: { label: string; onPress: () => void };
};

/**
 * 지금 사람이 봐야 할 것을 맨 위에서 먼저 말한다. 화면마다 하나만 둔다.
 * 문제가 없을 때 이 배너를 빼면 「볼 것이 없다」는 사실이 화면에서 사라진다 — 초록으로 남긴다.
 */
export function StatusBanner({ tone, title, detail, cta }: StatusBannerProps) {
  return (
    <View style={[styles.banner, { backgroundColor: TONE_BG[tone] }]}>
      <View style={[styles.bannerIcon, { backgroundColor: TONE_ICON_BG[tone] }]}>
        <Text style={[styles.bannerIconMark, { color: TONE_FG[tone] }]}>{tone === 'ok' ? '✓' : '!'}</Text>
      </View>
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: TONE_FG[tone] }]}>{title}</Text>
        {detail ? <Text style={styles.bannerDetail}>{detail}</Text> : null}
      </View>
      {cta ? (
        <Pressable onPress={cta.onPress} style={styles.bannerCta}>
          <Text style={[styles.bannerCtaLabel, { color: TONE_FG[tone] }]}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── 3. 숫자 ──────────────────────────────────────────────── */

export type KpiItem = {
  label: string;
  value: string;
  /** 값 아래 한 줄 — 어제 대비 · 한도 대비처럼 값을 읽는 기준. */
  note?: string;
  kind?: Kind;
};

/** KPI 한 줄. 칸 수는 항목 수를 따르고 폭은 고르게 나눈다. */
export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <View style={styles.kpiRow}>
      {items.map((k) => (
        <View key={k.label} style={styles.kpiCard}>
          <Text style={styles.kpiLabel} numberOfLines={1}>{k.label}</Text>
          <Text style={[styles.kpiValue, { color: KIND_FG[k.kind ?? 'none'] }]} numberOfLines={1}>
            {k.value}
          </Text>
          {k.note ? (
            <Text
              style={[styles.kpiNote, k.kind === 'bad' && { color: C.negative }]}
              numberOfLines={1}
            >
              {k.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/* ── 카드 · 격자 ──────────────────────────────────────────── */

/**
 * 카드 격자. 폭이 늘면 카드가 넓어지는 것이 아니라 칸 수가 는다 —
 * 최소 폭을 정해두고 남는 폭에서 한 칸이 더 들어가면 줄바꿈이 풀린다.
 */
export function CardGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export type CardProps = {
  title: string;
  sub?: string;
  action?: { label: string; onPress: () => void; kind?: 'brand' | 'plain' };
  /** 격자에서 한 줄을 다 쓴다. 표가 들어간 카드가 그렇다. */
  full?: boolean;
  /** 카드 맨 아래 회색 한 줄 — 규칙이나 보관 기한처럼 표를 읽는 데 필요한 단서. */
  note?: string;
  children?: ReactNode;
};

export function Card({ title, sub, action, full, note, children }: CardProps) {
  return (
    <View style={[styles.card, full ? styles.cardFull : styles.cardCell]}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={styles.cardSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {action ? (
          <Pressable
            onPress={action.onPress}
            style={[styles.cardAction, action.kind === 'brand' && styles.cardActionBrand]}
          >
            <Text style={[styles.cardActionLabel, action.kind === 'brand' && styles.onTintLabel]}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

/* ── 2. 빈 상태 ───────────────────────────────────────────── */

/**
 * 큐가 비어 있는 것은 실패가 아니라 목표다. 그래서 초록 체크로 그린다 —
 * 회색 「데이터 없음」은 고장처럼 읽힌다.
 */
export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}>
        <Text style={styles.emptyMarkText}>✓</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {detail ? <Text style={styles.emptyDetail}>{detail}</Text> : null}
    </View>
  );
}

/* ── 행 목록 ──────────────────────────────────────────────── */

export type RowItem = {
  key: string;
  /** 행 앞 상태 점. 없으면 그리지 않는다. */
  dot?: Tone | 'none';
  name: string;
  meta?: string;
  bold?: boolean;
  /** 오른쪽 숫자. 항상 tabular-nums로 앉는다. */
  num?: string;
  numKind?: Kind;
  /** 숫자 자리의 배지. 「정상」 「보류 6」처럼 상태를 한 낱말로. */
  tail?: string;
  tailKind?: Kind;
  btn?: { label: string; onPress: () => void; kind?: 'danger' | 'brand' | 'plain' };
  toggle?: { on: boolean; onPress: () => void };
};

export function Rows({ items }: { items: RowItem[] }) {
  return (
    <View>
      {items.map((r, i) => (
        <View key={r.key}>
          <View style={[styles.row, r.meta ? styles.rowTop : styles.rowCenter]}>
            {r.dot ? (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: r.dot === 'none' ? C.textDisabled : r.dot === 'warn' ? C.adminDotWarn : TONE_FG[r.dot] },
                ]}
              />
            ) : null}
            <View style={styles.rowText}>
              <Text style={[styles.rowName, r.bold && styles.bold]} numberOfLines={1}>{r.name}</Text>
              {r.meta ? <Text style={styles.rowMeta} numberOfLines={1}>{r.meta}</Text> : null}
            </View>
            {r.num ? (
              <Text style={[styles.rowNum, { color: KIND_FG[r.numKind ?? 'none'] }]}>{r.num}</Text>
            ) : null}
            {r.tail ? <Badge label={r.tail} kind={r.tailKind ?? 'none'} /> : null}
            {r.btn ? (
              <Pressable
                onPress={r.btn.onPress}
                style={[
                  styles.rowBtn,
                  r.btn.kind === 'danger' && styles.rowBtnDanger,
                  r.btn.kind === 'brand' && styles.rowBtnBrand,
                ]}
              >
                <Text
                  style={[
                    styles.rowBtnLabel,
                    r.btn.kind === 'danger' && styles.dangerLabel,
                    r.btn.kind === 'brand' && styles.onTintLabel,
                  ]}
                >
                  {r.btn.label}
                </Text>
              </Pressable>
            ) : null}
            {r.toggle ? <Toggle on={r.toggle.on} onPress={r.toggle.onPress} /> : null}
          </View>
          {i < items.length - 1 ? <View style={styles.hr} /> : null}
        </View>
      ))}
    </View>
  );
}

export function Badge({ label, kind = 'none' }: { label: string; kind?: Kind }) {
  return (
    <View style={[styles.badge, { backgroundColor: KIND_BG[kind] }]}>
      <Text style={[styles.badgeLabel, { color: kind === 'none' ? C.textSecondary : KIND_FG[kind] }]}>
        {label}
      </Text>
    </View>
  );
}

export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
    >
      <View style={styles.knob} />
    </Pressable>
  );
}

/* ── 4. 표 ────────────────────────────────────────────────── */

export type Col = {
  key: string;
  label: string;
  /** 1920 기준 폭. 시안의 열 폭을 그대로 적는다. */
  width: number;
  align?: 'left' | 'right';
  /** 남는 폭을 먹는 열. 화면마다 가장 긴 열 하나에만 준다. */
  grow?: boolean;
};

export type Cell = {
  v: string;
  kind?: Kind;
  bold?: boolean;
  mono?: boolean;
  badge?: Kind;
  /**
   * 행에 걸린 동작. 없으면 글자만 그린다 — 할 수 없는 일은 회색 글씨로도 두지 않고
   * 아예 누를 것을 만들지 않는다(ADMIN.md WP-ADM-015 「권리 미확인은 승인 버튼이 뜨지 않는다」).
   */
  onPress?: () => void;
};
export type TableRow = { key: string; cells: Cell[] };

/**
 * 표. 가로 스크롤은 이 카드 안에서만 일어난다 — 화면 전체가 흔들리면 사이드바와
 * 상단 배너까지 따라 움직여서 「지금 무엇을 보고 있는지」를 잃는다.
 *
 * 폭이 남으면 `grow` 열이 먹는다. 열을 고르게 늘리면 짧은 열에 빈칸만 생긴다.
 */
export function DataTable({ cols, rows, empty }: { cols: Col[]; rows: TableRow[]; empty?: StatusBannerProps['title'] }) {
  const min = cols.reduce((sum, c) => sum + c.width, 0);

  if (rows.length === 0) {
    return <EmptyState title={empty ?? '확인할 것이 없어요'} />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View style={{ minWidth: min }}>
        <View style={styles.thead}>
          {cols.map((c) => (
            <Text key={c.key} style={[styles.th, colWidth(c)]} numberOfLines={1}>
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.key} style={styles.tbody}>
            {r.cells.map((cell, i) => {
              const col = cols[i];
              if (!col) return null;
              if (cell.onPress) {
                return (
                  <View
                    key={col.key}
                    style={[colWidth(col), col.align === 'right' ? styles.cellRightBox : styles.cellLeftBox]}
                  >
                    <Pressable onPress={cell.onPress}>
                      <Text style={[styles.td, styles.bold, { color: KIND_FG[cell.kind ?? 'none'] }]}>
                        {cell.v}
                      </Text>
                    </Pressable>
                  </View>
                );
              }
              if (cell.badge) {
                return (
                  <View
                    key={col.key}
                    style={[colWidth(col), col.align === 'right' ? styles.cellRightBox : styles.cellLeftBox]}
                  >
                    <Badge label={cell.v} kind={cell.badge} />
                  </View>
                );
              }
              return (
                <Text
                  key={col.key}
                  numberOfLines={1}
                  style={[
                    styles.td,
                    colWidth(col),
                    cell.mono && styles.mono,
                    cell.bold && styles.bold,
                    { color: KIND_FG[cell.kind ?? (cell.bold ? 'none' : 'dim')] },
                    col.align === 'right' && styles.alignRight,
                  ]}
                >
                  {cell.v}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function colWidth(c: Col) {
  return c.grow
    ? { flexGrow: 1, flexShrink: 0, flexBasis: c.width, minWidth: c.width }
    : { flexGrow: 0, flexShrink: 0, flexBasis: c.width, width: c.width };
}

/* ── 막대 ─────────────────────────────────────────────────── */

export type BarItem = { label: string; pct: number; kind?: 'brand' | 'dim' | 'plain' };

/** 추이 막대. 값 자체는 표가 말하고 이것은 모양만 말한다. */
export function Bars({ items }: { items: BarItem[] }) {
  return (
    <View style={styles.bars}>
      {items.map((b) => (
        <View key={b.label} style={styles.barCol}>
          <View
            style={[
              styles.bar,
              {
                height: Math.max(4, Math.round(b.pct * 1.3)),
                backgroundColor: b.kind === 'brand' ? C.tint : b.kind === 'dim' ? C.border : C.adminBarFill,
              },
            ]}
          />
          <Text style={styles.barLabel}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── 5. 위험한 조작 ────────────────────────────────────────── */

export type ConfirmCardProps = {
  title: string;
  /** 무엇이 왜 바뀌는지 한두 줄. */
  body: string;
  /** 바뀌는 것을 항목으로. 「무엇이 바뀌는지 보여준 뒤 진행」이 이 목록이다. */
  items: string[];
  cta: string;
  danger?: boolean;
  /** 확인 전에 값을 하나 받아야 할 때. 항목과 단추 사이에 온다. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 확인 카드. 항목이 비어 있으면 그리지 않는다 — 무엇이 바뀌는지 말하지 못하는
 * 확인 창은 「예」를 누르는 절차만 늘린다.
 */
export function ConfirmCard({ title, body, items, cta, danger, children, onConfirm, onCancel }: ConfirmCardProps) {
  return (
    <View style={styles.confirmWrap}>
      <View style={styles.confirmCard}>
        <Text style={styles.confirmTitle}>{title}</Text>
        <Text style={styles.confirmBody}>{body}</Text>
        <View style={styles.confirmList}>
          {items.map((it) => (
            <View key={it} style={styles.confirmItem}>
              <View style={styles.confirmDot} />
              <Text style={styles.confirmItemText}>{it}</Text>
            </View>
          ))}
        </View>
        {children}
        <View style={styles.confirmActions}>
          <Pressable onPress={onCancel} style={styles.btnGhost}>
            <Text style={styles.btnGhostLabel}>취소</Text>
          </Pressable>
          <Pressable onPress={onConfirm} style={[styles.btnPrimary, danger && styles.btnDanger]}>
            <Text style={styles.btnPrimaryLabel}>{cta}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ── 불러오기 · 오류 ──────────────────────────────────────── */

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.loadError}>
      <Text style={styles.loadErrorText}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.btnPrimary}>
        <Text style={styles.btnPrimaryLabel}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.backgroundSelected },

  topbar: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    backgroundColor: C.background,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  topbarText: { flex: 1, minWidth: 0, gap: Spacing.half },
  pageTitle: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, fontWeight: '700', color: C.text },
  pageSub: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: C.textAssistive },
  topAction: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    justifyContent: 'center',
    backgroundColor: C.backgroundSelected,
  },
  topActionBrand: { backgroundColor: C.tint },
  topActionDanger: { backgroundColor: C.negativeBackground },
  topActionLabel: { fontSize: FontSize.micro, fontWeight: '700', color: C.textSecondary },
  onTintLabel: { color: C.onTint },
  dangerLabel: { color: C.negative },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.five, gap: Spacing.four },

  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.medium },
  bannerIcon: { width: 28, height: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  bannerIconMark: { fontSize: FontSize.t7, fontWeight: '700' },
  bannerText: { flex: 1, minWidth: 0, gap: Spacing.half },
  bannerTitle: { fontSize: FontSize.adminBanner, lineHeight: LineHeight.adminBanner, fontWeight: '700' },
  bannerDetail: {
    fontSize: FontSize.micro,
    lineHeight: LineHeight.micro,
    color: C.textSecondary,
    maxWidth: FLOW_MAX,
  },
  bannerCta: {
    height: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    justifyContent: 'center',
    backgroundColor: C.background,
  },
  bannerCtaLabel: { fontSize: FontSize.micro, fontWeight: '700' },

  kpiRow: { flexDirection: 'row', gap: Spacing.four },
  kpiCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.background,
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.half,
  },
  kpiLabel: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: C.textAssistive },
  kpiValue: {
    fontSize: FontSize.adminKpi,
    lineHeight: LineHeight.adminKpi,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiNote: {
    fontSize: FontSize.tab,
    lineHeight: LineHeight.tab,
    color: C.textAssistive,
    fontVariant: ['tabular-nums'],
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  card: { backgroundColor: C.background, borderRadius: Radius.medium, padding: Spacing.four, gap: Spacing.three },
  cardCell: { flexGrow: 1, flexShrink: 1, flexBasis: CARD_MIN, minWidth: CARD_MIN },
  cardFull: { flexGrow: 1, flexShrink: 1, flexBasis: '100%', minWidth: '100%' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  cardHeadText: { flex: 1, minWidth: 0, gap: Spacing.half },
  cardTitle: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: '700', color: C.text },
  cardSub: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: C.textAssistive },
  cardAction: {
    height: 30,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    justifyContent: 'center',
    backgroundColor: C.backgroundSelected,
  },
  cardActionBrand: { backgroundColor: C.tint },
  cardActionLabel: { fontSize: FontSize.micro, fontWeight: '700', color: C.textSecondary },
  note: {
    fontSize: FontSize.tab,
    lineHeight: LineHeight.tab,
    color: C.textAssistive,
    maxWidth: FLOW_MAX,
  },

  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyMark: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.positiveBackground,
  },
  emptyMarkText: { fontSize: FontSize.t4, fontWeight: '700', color: C.positive },
  emptyTitle: { fontSize: FontSize.t7, fontWeight: '700', color: C.text },
  emptyDetail: { fontSize: FontSize.micro, color: C.textAssistive, maxWidth: FLOW_MAX, textAlign: 'center' },

  row: { flexDirection: 'row', gap: Spacing.three, minHeight: 52 },
  rowCenter: { alignItems: 'center', paddingVertical: Spacing.two },
  rowTop: { alignItems: 'flex-start', paddingVertical: Spacing.three },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, marginTop: 7 },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.half },
  rowName: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: C.text },
  bold: { fontWeight: '700' },
  rowMeta: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: C.textAssistive },
  rowNum: {
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rowBtn: { height: 30, paddingHorizontal: Spacing.three, borderRadius: Radius.control, justifyContent: 'center', backgroundColor: C.backgroundSelected },
  rowBtnDanger: { backgroundColor: C.negativeBackground },
  rowBtnBrand: { backgroundColor: C.tint },
  rowBtnLabel: { fontSize: FontSize.micro, fontWeight: '700', color: C.textSecondary },
  hr: { height: 1, backgroundColor: C.line },

  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.badge },
  badgeLabel: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, fontWeight: '700' },

  toggle: { width: 44, height: 26, borderRadius: Radius.pill, padding: Spacing.half, justifyContent: 'center' },
  toggleOn: { backgroundColor: C.positive, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: C.track, alignItems: 'flex-start' },
  knob: { width: 20, height: 20, borderRadius: Radius.pill, backgroundColor: C.background },

  tableScroll: { marginHorizontal: -Spacing.half },
  thead: { flexDirection: 'row', gap: Spacing.three, paddingBottom: Spacing.two },
  th: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, fontWeight: '700', color: C.textAssistive },
  tbody: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  td: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, fontVariant: ['tabular-nums'] },
  mono: { fontFamily: 'monospace', fontSize: FontSize.code },
  alignRight: { textAlign: 'right' },
  cellLeftBox: { alignItems: 'flex-start' },
  cellRightBox: { alignItems: 'flex-end' },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three, paddingTop: Spacing.three },
  barCol: { alignItems: 'center', gap: Spacing.two },
  bar: { width: 30, borderTopLeftRadius: Radius.badge, borderTopRightRadius: Radius.badge },
  barLabel: { fontSize: FontSize.tab, color: C.textAssistive, fontVariant: ['tabular-nums'] },

  confirmWrap: { alignItems: 'center', paddingTop: Spacing.three },
  confirmCard: {
    width: '100%',
    maxWidth: FLOW_MAX,
    backgroundColor: C.background,
    borderRadius: Radius.medium,
    padding: Spacing.five,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: C.track,
  },
  confirmTitle: { fontSize: FontSize.t5, lineHeight: LineHeight.t5, fontWeight: '700', color: C.text },
  confirmBody: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, color: C.textSecondary },
  confirmList: { gap: Spacing.two, paddingVertical: Spacing.two },
  confirmItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  confirmDot: { width: 5, height: 5, borderRadius: Radius.pill, marginTop: 8, backgroundColor: C.textDisabled },
  confirmItemText: { flex: 1, fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, color: C.text },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  btnGhost: { height: 44, paddingHorizontal: Spacing.four, borderRadius: Radius.control, justifyContent: 'center', backgroundColor: C.backgroundSelected },
  btnGhostLabel: { fontSize: FontSize.t7, fontWeight: '700', color: C.textSecondary },
  btnPrimary: { height: 44, paddingHorizontal: Spacing.four, borderRadius: Radius.control, justifyContent: 'center', backgroundColor: C.tint },
  btnDanger: { backgroundColor: C.negativeAction },
  btnPrimaryLabel: { fontSize: FontSize.t7, fontWeight: '700', color: C.onTint },

  loadError: { alignItems: 'center', gap: Spacing.three, padding: Spacing.five },
  loadErrorText: { fontSize: FontSize.t6, color: C.negative },
});
