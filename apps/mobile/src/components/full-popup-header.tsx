import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CanonGray, Layout, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { CLOSE_ICON_SIZE, TOUCH_SLOT_SIZE } from '@/components/back-button';

/**
 * 공통 풀팝업 머리 — CLAUDE.md v3.29 「풀팝업」 행 · WP-AUTH-011(약관 상세)에서 뗐다.
 *
 *   높이 56 · 좌우 16 · 사이 8 · 아래 1px 선(gray200)
 *   좌측 36px 슬롯 — 회색(gray100) 원형 X · close 16 · 글자색
 *   가운데 제목 16 · 700 · 한 줄
 *   우측 36px 빈 칸 — 제목이 화면 가운데 앉는다
 *
 * 약관 상세(`features/auth/terms-detail-modal.tsx`)와 상담 예약(`search/[vendorId]/consult.tsx`)이
 * 같은 머리를 쓴다. 서브 문구는 넣지 않는다(Header 서브 문구 미사용).
 */
export function FullPopupHeader({
  title,
  onClose,
  closeDisabled = false,
  closeLabel = '닫기',
}: {
  title: ReactNode;
  onClose: () => void;
  /** 저장 · 전송 중처럼 지금은 닫으면 안 될 때. X를 흐리게 두고 누를 수 없다. */
  closeDisabled?: boolean;
  closeLabel?: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.nav, { borderBottomColor: CanonGray.gray200 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        accessibilityState={{ disabled: closeDisabled }}
        disabled={closeDisabled}
        onPress={onClose}
        style={({ pressed }) => [
          styles.close,
          { backgroundColor: CanonGray.gray100 },
          (pressed || closeDisabled) && styles.pressed,
        ]}>
        <ProductSymbol name="close" size={CLOSE_ICON_SIZE} color={theme.text} />
      </Pressable>
      <ThemedText type="f16" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      <View style={styles.pad} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: Spacing.two,
    borderBottomWidth: 1,
  },
  close: {
    width: TOUCH_SLOT_SIZE,
    height: TOUCH_SLOT_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, minWidth: 0, textAlign: 'center', fontWeight: 700 },
  pad: { width: TOUCH_SLOT_SIZE },
  pressed: { opacity: 0.8 },
});
