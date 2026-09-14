import type { VendorCandidate } from '@weddingpick/api-contract';
import { TERMS, regionLabel } from '@weddingpick/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Layout,
  Radius,
  Spacing,
  ThemedText,
  VendorImage,
  useTheme,
} from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { vendorImageCategory } from '@/features/search/vendor-image-category';

/**
 * Pick 버튼이 띄우는 두 시트 — 시안 17-sheets-states.dc.html · 07-pick.dc.html #17f.
 *
 *   WP-SHT-002 Pick 완료   «후보에 담았어요»       Pick 목록 보기 / 닫기
 *   WP-SHT-003 Pick 해제   «후보에서 뺄까요?»      빼기(danger) / 그대로 둘게요
 *
 * 패널은 공용 `SheetPanel`(padding 12 24 28 + safeBottom · 그래버 40×4) — 제목 24 · 본문 16/24 · 버튼 52. 문구는 spec/strings.ko.json `pick.unpickTitle` · `pick.unpickBody` · screens.json
 * WP-SHT-002/003.
 */

/** 시안 #17f 해제 시트의 썸네일 56. Layout 썸네일 토큰(52·44)에 없는 값. */
const UNPICK_THUMB = 56;

function SheetButton({
  label,
  kind,
  flex,
  onPress,
  disabled,
}: {
  label: string;
  kind: 'ghost' | 'primary' | 'danger';
  flex: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const background =
    kind === 'ghost' ? theme.backgroundSelected : kind === 'danger' ? theme.negative : theme.tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { flex, backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}>
      <ThemedText type="t5" themeColor={kind === 'ghost' ? 'textStrong' : 'onTint'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function PickDoneSheet({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetPanel>
        <ThemedText type="t3">후보에 담았어요</ThemedText>
        <View style={styles.actions}>
          <SheetButton label="닫기" kind="ghost" flex={1} onPress={onDismiss} />
          <SheetButton
            label={`${TERMS.pick} 목록 보기`}
            kind="primary"
            flex={1.3}
            onPress={() => {
              onDismiss();
              router.push('/pick');
            }}
          />
        </View>
      </SheetPanel>
    </BottomSheet>
  );
}

export function UnpickSheet({
  candidate,
  partnerName,
  busy,
  onConfirm,
  onDismiss,
}: {
  /** 뺄 후보. null이면 시트가 닫혀 있다. */
  candidate: VendorCandidate | null;
  /** 배우자 표시 이름. 연결 전이면 null. */
  partnerName: string | null;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const shared = candidate?.addedByPartner === true;
  const who = partnerName ? `${partnerName}님` : TERMS.spouse;

  return (
    <BottomSheet visible={candidate !== null} onRequestClose={onDismiss}>
      <SheetPanel>
        {candidate ? (
          <View style={styles.vendorRow}>
            <View style={styles.thumb}>
              <VendorImage
                source={candidate.imageUrl ? { uri: candidate.imageUrl } : undefined}
                category={vendorImageCategory(candidate.category)}
                width={UNPICK_THUMB}
                height={UNPICK_THUMB}
                radius={Radius.small}
              />
            </View>
            <View style={styles.vendorBody}>
              <ThemedText type="t5" numberOfLines={1}>{candidate.vendorName}</ThemedText>
              <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                {shared ? '둘 다 고른 곳' : regionLabel(candidate.region)}
              </ThemedText>
            </View>
          </View>
        ) : null}
        <ThemedText type="t3">후보에서 뺄까요?</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {shared ? `${who} 목록에서도 함께 사라져요. 다시 담을 수 있어요.` : '다시 담을 수 있어요.'}
        </ThemedText>
        <View style={styles.actions}>
          <SheetButton label="그대로 둘게요" kind="ghost" flex={1} onPress={onDismiss} disabled={busy} />
          <SheetButton label={busy ? '빼는 중…' : '빼기'} kind="danger" flex={1.2} onPress={onConfirm} disabled={busy} />
        </View>
      </SheetPanel>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Layout.cardGap,
  },
  button: {
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
  },
  thumb: {
    width: UNPICK_THUMB,
    height: UNPICK_THUMB,
    borderRadius: Radius.small,
    overflow: 'hidden',
  },
  vendorBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half + 1,
  },
});
