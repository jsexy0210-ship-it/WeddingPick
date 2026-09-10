import { Pressable, StyleSheet } from 'react-native';

import { Layout, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

import { openOutside, type InAppBrowserNotice as Notice } from './escape';

/**
 * `spec/strings.ko.json` `inAppBrowser.*`의 확정 카피.
 *
 * `OPEN`은 크롬·사파리를 이름으로 부르지 않는다 — 카카오톡은 그 사람이 기본으로
 * 쓰는 브라우저를 열고, 안드로이드 기타 인앱은 크롬을 연다. 한 문장이 두 경우를
 * 다 맞으려면 브라우저 이름이 없어야 한다.
 *
 * `GUIDE`는 iOS의 인스타그램·페이스북·라인 인앱에서만 보인다 — 사파리를 강제로
 * 띄우는 공개 API가 없어서 사람이 직접 여는 수밖에 없는 자리다(`detect.ts`).
 */
const OPEN = '브라우저에서 열기';
const GUIDE = '오른쪽 위 ···를 눌러 «Safari로 열기»를 선택해주세요';

/**
 * 인앱 브라우저에서 화면 맨 위에 얹는 한 줄.
 *
 * 화면을 덮지 않는다 — 인앱 브라우저에서도 앱을 볼 수는 있고, 막히는 것은
 * 로그인뿐이다. 위에 한 줄만 얹고 나머지는 그대로 쓰게 둔다.
 *
 * **자동으로 옮겼어도 누를 자리를 남긴다.** 인앱 브라우저가 스킴 이동을 막는
 * 경우가 있는데, 그때 화면에 아무것도 없으면 사람이 할 수 있는 일이 없다.
 */
export function InAppBrowserNotice({ notice }: { notice: Notice }) {
  if (notice.kind === 'none') return null;

  if (notice.kind === 'guide') {
    return (
      <Bar>
        <ThemedText type="t7" themeColor="textSecondary" style={styles.text}>
          {GUIDE}
        </ThemedText>
      </Bar>
    );
  }

  return (
    <Bar>
      <Pressable onPress={() => openOutside(notice.href)} accessibilityRole="button">
        <ThemedText type="t7" themeColor="tint" style={styles.text}>
          {OPEN}
        </ThemedText>
      </Pressable>
    </Bar>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundSelected" style={styles.bar}>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  text: { textAlign: 'center' },
});
