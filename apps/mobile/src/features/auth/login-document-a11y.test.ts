/**
 * 2026-09-26 대표 감사 — /login에 문서 제목도 의미상 제목(heading)도 없었다.
 *
 * - 문서 제목: `+html.tsx`의 <title>보다 Expo Router head(`<title data-rh>`)가 먼저 찍혀 빈 값이
 *   이겼다. 뿌리 레이아웃이 웹에서 `SHARE_TITLE`을 head로 싣는다(모든 화면 공통).
 * - 제목: 히어로 문구가 `accessibilityRole="header"` — react-native-web이 role="heading"으로 낸다.
 *   모양(글자 크기 · 굵기 · 여백)은 그대로다.
 */

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => any;
declare const __dirname: string;

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const app = join(__dirname, '..', '..', 'app');
const read = (path: string): string => readFileSync(join(app, path), 'utf8');

describe('/login 문서 제목 · 제목 역할', () => {
  it('뿌리 레이아웃이 웹 문서 제목을 공유 제목으로 싣는다', () => {
    const layout = read('_layout.tsx');
    expect(layout).toContain("import Head from 'expo-router/head';");
    expect(layout).toContain('<title>{SHARE_TITLE}</title>');
  });

  it('로그인 히어로 문구가 제목 역할을 가진다', () => {
    const login = read('login/index.tsx');
    expect(login).toContain('<ThemedText type="f32" accessibilityRole="header" style={styles.title}>');
  });
});
