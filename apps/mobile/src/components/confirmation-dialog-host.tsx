import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, ThemedText, useTheme } from '@weddingpick/ui';
import strings from '../../../../spec/strings.ko.json';

import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import {
  getNativeConfirmation,
  subscribeNativeConfirmation,
  type ActiveNativeConfirmation,
} from './native-confirmation-store';

const CANCEL = strings.common['cta.cancel'];
const CONFIRM = strings.common['cta.confirm'];

export function ConfirmationDialogHost() {
  const active = useSyncExternalStore(
    subscribeNativeConfirmation,
    getNativeConfirmation,
    getNativeConfirmation
  );

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
      (a, b) => Number(a.button.style === 'destructive') - Number(b.button.style === 'destructive')
    );

    return (
      <BottomSheet visible onRequestClose={cancel} testID="confirmation-action-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <ThemedText type="t4">{request.title}</ThemedText>
            {request.message ? (
              <ThemedText type="body" themeColor="textSecondary">
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
                  type="t5"
                  style={button.style === 'destructive' ? { color: theme.negativeAction } : undefined}>
                  {button.text}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <DialogButton label={request.buttons[cancelIndex]?.text ?? CANCEL} tone="cancel" onPress={cancel} />
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
          <ThemedText type="t4" style={styles.centerText}>
            {request.title}
          </ThemedText>
          {request.message ? (
            <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>
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
      ? theme.backgroundSelected
      : tone === 'danger'
        ? theme.negativeAction
        : theme.tint;
  const color = tone === 'cancel' ? theme.textSecondary : theme.onTint;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="t5" style={{ color, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function noop() {}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Layout.gutter + Layout.iconTextGap,
  },
  dialogPanel: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    borderRadius: Radius.pickCard,
    padding: Layout.gutter,
    gap: Layout.iconTextGap,
  },
  centerText: { textAlign: 'center' },
  buttonRow: {
    flexDirection: 'row',
    gap: Layout.iconTextGap,
    paddingTop: Layout.iconTextGap,
  },
  button: {
    flex: 1,
    minHeight: Layout.controlXLarge,
    borderRadius: Radius.control,
    paddingHorizontal: Layout.iconTextGap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHead: { gap: Layout.sheetHeadGap },
  actionList: { width: '100%' },
  actionRow: {
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
