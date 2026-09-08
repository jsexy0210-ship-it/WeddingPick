/**
 * 웨딩픽은 **항상 라이트**다(2026-09-08 결정). 브라우저 `prefers-color-scheme`을
 * 따르지 않는다 — 예전에는 hydration 뒤 기기 스킴을 읽었지만, 그 때문에 다크
 * 모드 폰에서 앱 전체가 검게 떴다. 정적 렌더링과 클라이언트가 같은 값을 내므로
 * hydration 분기도 필요 없다.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
