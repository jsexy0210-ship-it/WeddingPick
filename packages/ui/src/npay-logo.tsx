import { StyleSheet, Text, View } from 'react-native';

import { NpayColors } from './theme';
import { FontSize, LineHeight } from './typography';

/**
 * Npay 로고 — 이미지 없이 그린다(핸드오프 v3.22 README).
 *
 *   pill   height 26 · padding 0 10 0 3 · radius 999 · #03C75A
 *   N      20×20 원 · #1E1E1E · 흰 글자 12px 800
 *   pay    14px 800 · #1E1E1E · translateY(-1)
 *
 * 사용자 화면 문구는 «Npay»다. «Npay» «Npay»는 쓰지 않는다.
 */
export function NpayLogo() {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Npay"
      style={[styles.pill, { backgroundColor: NpayColors.background }]}>
      <View style={[styles.circle, { backgroundColor: NpayColors.ink }]}>
        <Text style={[styles.n, { color: NpayColors.text }]}>N</Text>
      </View>
      <Text style={[styles.pay, { color: NpayColors.ink }]}>pay</Text>
    </View>
  );
}

const PILL_HEIGHT = 26;
const CIRCLE = 20;

const styles = StyleSheet.create({
  pill: {
    height: PILL_HEIGHT,
    paddingLeft: 3,
    paddingRight: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  n: { fontSize: FontSize.npayN, lineHeight: LineHeight.npayN, fontWeight: '800' },
  pay: {
    fontSize: FontSize.npayPay,
    lineHeight: LineHeight.npayPay,
    fontWeight: '800',
    letterSpacing: -0.14,
    transform: [{ translateY: -1 }],
  },
});
