/**
 * 하이브리드 웹뷰 쉘 설정.
 *
 * `EXPO_PUBLIC_WEB_URL`: 호스팅된 `apps/mobile` 웹 export(react-native-web,
 * `npm run export:web`)의 기본 URL. `apps/mobile/src/api/config.ts`의
 * `API_URL`과 같은 패턴(빌드 타임 EAS 환경변수)이다.
 *
 * `EXPO_PUBLIC_WEBSHELL_SCREENS`: 웹뷰로 대체할 화면 id를 쉼표로 나열한
 * 목록(예: "home,pick"). 비어 있으면(기본값) 모든 화면이 네이티브로 남는다 —
 * 이미 완성된 네이티브 화면을 실수로 되돌릴 수 없게 opt-in으로 둔다.
 */
export const WEB_SHELL_URL = process.env.EXPO_PUBLIC_WEB_URL;
export const isWebShellConfigured = Boolean(WEB_SHELL_URL);

const enabledScreens = new Set(
  (process.env.EXPO_PUBLIC_WEBSHELL_SCREENS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

export function isWebShellScreen(id: string): boolean {
  return isWebShellConfigured && enabledScreens.has(id);
}
