import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';

/**
 * v3.27 관리자 공통 규칙 넷을 그리는 부품. `22-admin-ops.dc.html`이 원본이다.
 *
 *   지금 봐야 할 것이 맨 위    `OpsAlert`  — 상단 배너가 상태를 먼저 말한다
 *   빈 상태가 정상 상태        `OpsEmpty`  — 「확인할 것이 없어요」를 반드시 그린다
 *   표는 카드 안에서만 스크롤   `OpsTable`  — 화면 전체가 흔들리지 않는다
 *   위험한 조작은 한 번 더     `OpsConfirm` — 무엇이 바뀌는지 항목으로 보인 뒤 진행
 *
 * 관리자 콘솔은 밝은 면만 쓰므로 `Colors.light`를 직접 든다 — 나머지 관리자 화면과 같은 방식이다.
 * 글자 크기는 8단 스케일 안에서 고른다. 시안의 15/21은 `t7`(14) + `t7Loose`(21)로 앉힌다.
 */

type OpsKind = 'ok' | 'warn' | 'bad';

const KIND = {
  ok: {
    background: Colors.light.positiveBackground,
    icon: Colors.light.positiveIcon,
    stroke: Colors.light.positive,
  },
  warn: {
    /* 시안 alertStyle warn은 #fff6e6 — 토큰 warningFg.boxBg(#FFF7E6)와 초록 채널이 1 다르다. 같은 역할이라 토큰을 쓴다. */
    background: Colors.light.cautionaryBoxBackground,
    icon: Colors.light.cautionaryIcon,
    stroke: Colors.light.cautionary,
  },
  bad: {
    background: Colors.light.negativeBackground,
    icon: Colors.light.negativeIcon,
    stroke: Colors.light.negative,
  },
} as const;

/**
 * 상단 상태 배너. 시안 `alertStyle`(L297) — 좌우 18 · 상하 16 · radius 10 · 아이콘 원 28.
 *
 * 화면에서 가장 먼저 읽히는 줄이다. 볼 것이 없으면 `kind="ok"`로 그대로 둔다 — 배너를
 * 통째로 빼면 「지금 봐야 할 것이 맨 위」가 화면마다 다르게 지켜진다.
 */
export function OpsAlert({
  kind,
  title,
  sub,
  cta,
  onCta,
}: {
  kind: OpsKind;
  title: string;
  sub?: string;
  cta?: string;
  onCta?: () => void;
}) {
  const c = KIND[kind];
  return (
    <View style={[styles.alert, { backgroundColor: c.background }]}>
      <View style={[styles.alertIcon, { backgroundColor: c.icon }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          {kind === 'ok' ? (
            <Path d="m5 12.5 4.5 4.5L19 7.5" />
          ) : (
            <>
              <Path d="M12 7.6v5.2" />
              <Path d="M12 16.8h.01" />
            </>
          )}
        </Svg>
      </View>
      <View style={styles.alertBody}>
        <Text style={[styles.alertTitle, { color: c.stroke }]}>{title}</Text>
        {sub ? <Text style={styles.alertSub}>{sub}</Text> : null}
      </View>
      {cta && onCta ? (
        <Pressable onPress={onCta} style={styles.alertCta} accessibilityRole="button">
          <Text style={[styles.alertCtaText, { color: c.stroke }]}>{cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * 빈 상태 상자. 시안 `emptyBox`(L748) — 상하 36 · 좌우 20 · radius 10 · 표식 원 44.
 *
 * 빈 것은 고장이 아니라 정상이다. 목록이 비었을 때 아무것도 그리지 않으면 화면이
 * 덜 그려진 것처럼 보이고, 담당자가 새로고침을 반복하게 된다.
 */
export function OpsEmpty({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.light.positive} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m5 12.5 4.5 4.5L19 7.5" />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );
}

/**
 * 카드 안에서만 가로로 도는 표. 시안 `tableScroll`(L757) + `tableWidth`(L711).
 *
 * 표를 화면 전폭에 두면 컬럼이 많은 화면(감사 기록 8열)에서 사이드바까지 함께 밀린다.
 * 카드가 스크롤을 가두면 흔들리는 것은 표뿐이다.
 */
export function OpsTable({ minWidth, children }: { minWidth: number; children: React.ReactNode }) {
  return (
    <View style={styles.tableCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth }}>
        <View style={{ minWidth, flex: 1 }}>{children}</View>
      </ScrollView>
    </View>
  );
}

/**
 * 위험한 조작을 한 번 더 묻는다. 시안 `confirmCard`(L766) — 520 · radius 10 · 패딩 24.
 *
 * **무엇이 바뀌는지 항목으로 먼저 보인다.** 「정말 하시겠어요?」만 묻는 확인은 읽히지
 * 않고 눌린다 — 바뀌는 것을 줄로 세워야 담당자가 멈출 기회를 갖는다.
 */
export function OpsConfirm({
  visible,
  title,
  body,
  items,
  confirmLabel,
  cancelLabel = '그만두기',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  items: string[];
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityRole="button" accessibilityLabel={cancelLabel}>
        <Pressable style={styles.confirmCard} onPress={() => {}}>
          <Text style={styles.confirmTitle}>{title}</Text>
          {body ? <Text style={styles.confirmBody}>{body}</Text> : null}
          <View style={styles.confirmList}>
            {items.map((item) => (
              <View key={item} style={styles.confirmItem}>
                <View style={styles.confirmDot} />
                <Text style={styles.confirmItemText}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={styles.confirmActions}>
            <Pressable onPress={onCancel} style={styles.btnGhost} accessibilityRole="button">
              <Text style={styles.btnGhostText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.btnDanger} accessibilityRole="button">
              <Text style={styles.btnDangerText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /* 시안 alertStyle — padding:16px 18px · radius 10 · gap 12 · 위 정렬. */
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 10 },
  alertIcon: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  alertBody: { flex: 1, minWidth: 0, gap: 2 },
  /* 시안 alertTitleStyle 15/21 — 8단 스케일 안에서 t7(14) + t7Loose(21). */
  alertTitle: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, fontWeight: '700' },
  alertSub: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textSecondary },
  /* 시안 alertCtaStyle — height 32 · 좌우 14 · 흰 바탕. */
  alertCta: { height: 32, paddingHorizontal: 14, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background },
  alertCtaText: { fontSize: FontSize.micro, fontWeight: '700' },

  /* 시안 emptyBox — padding:36px 20px · radius 10 · gray50. */
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.light.backgroundElement },
  emptyMark: { width: 44, height: 44, borderRadius: 999, backgroundColor: Colors.light.positiveBackground, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, fontWeight: '700', color: Colors.light.text },
  emptySub: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive, textAlign: 'center' },

  tableCard: { backgroundColor: Colors.light.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, overflow: 'hidden' },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  /* 시안 confirmCard — 520 · radius 10 · padding 24 · gap 12. */
  confirmCard: { width: 520, maxWidth: '100%', backgroundColor: Colors.light.background, borderRadius: 10, padding: 24, gap: 12 },
  confirmTitle: { fontSize: FontSize.t5, lineHeight: LineHeight.t5, fontWeight: '700', color: Colors.light.text },
  confirmBody: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, color: Colors.light.textSecondary },
  /* 시안 confirmList — radius 8 · padding 16 · 옅은 코랄 바탕. */
  confirmList: { gap: 8, padding: 16, borderRadius: 8, backgroundColor: Colors.light.tintSurface },
  confirmItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  confirmDot: { width: 5, height: 5, marginTop: 8, borderRadius: 999, backgroundColor: Colors.light.tint },
  confirmItemText: { flex: 1, fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textStrong },
  confirmActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', paddingTop: 4 },
  /* 시안 btnGhostLg — height 44 · 좌우 24. */
  btnGhost: { height: 44, paddingHorizontal: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.backgroundSelected },
  btnGhostText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textSecondary },
  btnDanger: { height: 44, paddingHorizontal: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.negativeAction },
  btnDangerText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
});
