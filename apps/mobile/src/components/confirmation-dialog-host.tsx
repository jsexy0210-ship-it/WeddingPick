import { usePathname } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CanonGray, FontSize, Layout, LineHeight, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import strings from '../../../../spec/strings.ko.json';

import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { updateNativeConfirmationScope } from './confirm-alert';
import {
  DIALOG_ICON,
  DIALOG_ICON_GLYPH,
  DIALOG_ICON_SIZE,
  DIALOG_ICON_STROKE,
  type DialogIcon,
} from './dialog-icon';
import {
  getNativeConfirmation,
  subscribeNativeConfirmation,
  type ActiveNativeConfirmation,
} from './native-confirmation-store';

const CANCEL = strings.common['cta.cancel'];
const CONFIRM = strings.common['cta.confirm'];

export function ConfirmationDialogHost() {
  const pathname = usePathname();
  const active = useSyncExternalStore(
    subscribeNativeConfirmation,
    getNativeConfirmation,
    getNativeConfirmation
  );

  useEffect(() => {
    updateNativeConfirmationScope(pathname);
  }, [pathname]);

  if (!active) return null;

  return <NativeConfirmation active={active} />;
}

function NativeConfirmation({ active }: { active: ActiveNativeConfirmation }) {
  const theme = useTheme();
  const { request, choose } = active;
  const cancelIndex = request.buttons.findIndex((button) => button.style === 'cancel');
  const actions = request.buttons
    .map((button, index) => ({ button, index }))
    .filter(({ button }) => button.style !== 'cancel');
  const danger = actions.some(({ button }) => button.style === 'destructive');
  const actionList = actions.length > 1;
  const cancel = () => choose(cancelIndex >= 0 ? cancelIndex : null);

  if (actionList) {
    const ordered = [...actions].sort(
      (a, b) =>
        Number(a.button.style === 'destructive') - Number(b.button.style === 'destructive')
    );

    return (
      <BottomSheet visible onRequestClose={cancel} testID="confirmation-action-sheet">
        <SheetPanel>
          {request.icon ? <DialogIconCircle icon={request.icon} /> : null}
          <View style={styles.sheetHead}>
            {/* WP-DLG-E titleStyle(sheet) — 22/30 · 700(`common.js:190`). */}
            <ThemedText type="t4" style={styles.sheetTitle}>{request.title}</ThemedText>
            {/* WP-DLG bodyStyle — 14/22 · MUTED(`common.js:192`). */}
            {request.message ? (
              <ThemedText type="f14" themeColor="textSecondary" style={styles.body}>
                {request.message}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.actionList}>
            {ordered.map(({ button, index }) => (
              <Pressable
                key={`${request.id}-${index}`}
                accessibilityRole="button"
                onPress={() => choose(index)}
                style={({ pressed }) => [
                  styles.actionRow,
                  { borderBottomColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="f16"
                  style={[
                    styles.actionLabel,
                    button.style === 'destructive' ? { color: theme.negativeAction } : null,
                  ]}>
                  {button.text}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <DialogButton
            label={request.buttons[cancelIndex]?.text ?? CANCEL}
            tone="cancel"
            onPress={cancel}
          />
        </SheetPanel>
      </BottomSheet>
    );
  }

  const action = actions[0] ?? null;
  const destructive = action?.button.style === 'destructive';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={danger ? noop : cancel}>
      <View style={[styles.modalRoot, { backgroundColor: theme.scrim }]}>
        {!danger ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={CANCEL}
            onPress={cancel}
          />
        ) : null}

        <View
          accessibilityRole={danger ? 'alert' : undefined}
          style={[styles.dialogPanel, { backgroundColor: theme.background }]}>
          {request.icon ? <DialogIconCircle icon={request.icon} centered /> : null}
          <ThemedText type="f20" style={[styles.dialogTitle, styles.centerText]}>
            {request.title}
          </ThemedText>
          {/*
           * WP-DLG-C 되돌릴 수 없음 — 「무엇이 사라지는지 항목으로」(`common.js:595`). web
           * (`confirm-alert.web.ts`)과 같이 호출자가 준 안내를 줄 단위로만 항목화한다.
           */}
          {danger && request.message ? (
            <View style={[styles.itemBox, { backgroundColor: theme.backgroundElement }]}>
              {request.message
                .split('\n')
                .filter((line) => line.trim())
                .map((line, index) => (
                  <View key={`${request.id}-item-${index}`} style={styles.itemRow}>
                    <View style={[styles.itemDot, { backgroundColor: theme.negativeAction }]} />
                    <ThemedText type="f14" themeColor="textSecondary" style={styles.itemText}>
                      {line}
                    </ThemedText>
                  </View>
                ))}
            </View>
          ) : null}
          {/* WP-DLG bodyStyle(alert/confirm) — 14/22 · MUTED · 가운데. */}
          {!danger && request.message ? (
            <ThemedText
              type="f14"
              themeColor="textSecondary"
              style={[styles.body, styles.centerText]}>
              {request.message}
            </ThemedText>
          ) : null}

          <View style={styles.buttonRow}>
            {cancelIndex >= 0 || danger ? (
              <DialogButton
                label={request.buttons[cancelIndex]?.text ?? CANCEL}
                tone="cancel"
                onPress={cancel}
              />
            ) : null}
            <DialogButton
              label={action?.button.text ?? CONFIRM}
              tone={destructive ? 'danger' : 'primary'}
              onPress={() => choose(action?.index ?? null)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DialogButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'cancel' | 'primary' | 'danger';
  onPress: () => void;
}) {
  const theme = useTheme();
  const backgroundColor =
    tone === 'cancel'
      ? CanonGray.gray100
      : tone === 'danger'
        ? theme.negativeAction
        : theme.tint;
  /* 정본 ghost — 배경 SEC #f2f3f6 · 글자 SUB #4d5159(`common.js:160`) — `CanonGray`. */
  const color = tone === 'cancel' ? CanonGray.gray700 : theme.onTint;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="f17" style={[styles.buttonLabel, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 정본 iconStyle — 원 48 · 글리프 24 · stroke 2.6(`common.js:151 · 186`). */
function DialogIconCircle({ icon, centered = false }: { icon: DialogIcon; centered?: boolean }) {
  const spec = DIALOG_ICON[icon];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.icon, { backgroundColor: spec.background }, centered && styles.iconCentered]}>
      <Svg
        width={DIALOG_ICON_GLYPH}
        height={DIALOG_ICON_GLYPH}
        viewBox="0 0 24 24"
        fill="none"
        stroke={spec.stroke}
        strokeWidth={DIALOG_ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round">
        {spec.paths.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}

function noop() {}

/** 정본 item mark 'del' — 5px 점 · margin-top 9(`common.js:170`). 공용 토큰에 5가 없다. */
const ITEM_DOT = 5;
const ITEM_DOT_TOP = 9;

/*
 * RN 정본 `docs/design/React_Native/common.js:156~197`(common frame-001~005 · 008).
 *   CENTER  좌우 32 · padding 28 24 20 · radius 14 · gap 10
 *   제목    20/28 · 700 · 가운데          본문  14/22 · MUTED
 *   버튼줄  gap 8 · 위 14                  버튼  높이 56 · radius 6 · 17 · 700
 *   행동 목록(action) 행  min-height 56 · 16 · 700 · 아래 1px BORDER
 */
const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  dialogPanel: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    borderRadius: Radius.pickCard,
    paddingTop: Layout.sectionGap,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.cardPadding,
    gap: Layout.iconTextGap,
  },
  dialogTitle: { fontWeight: '700' },
  body: { lineHeight: LineHeight.lh22 },
  centerText: { textAlign: 'center' },
  /* itemBox — padding 12 16 · radius 10 · REC · gap 8 / 항목 5px 빨강 점 · 위 9 · gap 10 · 14/21. */
  itemBox: {
    alignSelf: 'stretch',
    paddingVertical: Layout.inlineGap,
    paddingHorizontal: Layout.sectionBand,
    borderRadius: Radius.medium,
    gap: Layout.chipGap,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Layout.iconTextGap },
  itemDot: {
    width: ITEM_DOT,
    height: ITEM_DOT,
    marginTop: ITEM_DOT_TOP,
    borderRadius: Radius.pill,
  },
  itemText: { flex: 1, lineHeight: LineHeight.t7Loose },
  buttonRow: {
    flexDirection: 'row',
    gap: Layout.chipGap,
    paddingTop: Layout.sectionHeadGap,
  },
  button: {
    flex: 1,
    minHeight: Layout.ctaSheet,
    borderRadius: Radius.control,
    paddingHorizontal: Layout.iconTextGap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontWeight: '700', textAlign: 'center' },
  sheetHead: { gap: Layout.sheetHeadGap },
  sheetTitle: { fontSize: FontSize.sheetTitle, lineHeight: LineHeight.sheetTitle },
  actionList: { width: '100%' },
  actionRow: {
    minHeight: Layout.rowMinHeight,
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  actionLabel: { fontWeight: '700' },
  pressed: { opacity: 0.7 },
  icon: {
    width: DIALOG_ICON_SIZE,
    height: DIALOG_ICON_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCentered: { alignSelf: 'center' },
});
