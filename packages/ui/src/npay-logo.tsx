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
 *
 * **굵기 800은 저장소 전체에서 이 파일 두 줄뿐이다.** 2026-09-17에 대표님 지시로
 * `Pretendard-ExtraBold.ttf`(2.19MB)를 앱에서 뺐다 — 두 줄 때문에 2.19MB를 들고
 * 다니던 자리였다.
 *
 *     웹        가변 폰트(45~920) 한 벌이라 **그대로 800으로 그려진다**
 *     네이티브   800 파일이 없어 기기가 700으로 떨어뜨린다
 *
 * **숫자를 700으로 고치지 않는다.** 규격이 800이고(핸드오프 v3.22) 웹은 실제로 800을
 * 그린다 — 코드를 700으로 적으면 웹까지 같이 내려간다. 굵기 500도 파일 없이 같은
 * 방식으로 돌고 있다(`spec/tokens.json` `typography.$weights`).
 *
 * 네이티브에서도 정확히 800이어야 하면 TTF를 되돌린다. 그때는 2.19MB를 치르는 것이다.
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
