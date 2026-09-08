/**
 * 웨딩픽은 **항상 라이트**다(2026-09-08 결정). 기기 다크 모드를 따르지 않는다 —
 * 스킨 6종(CLAUDE.md §5)은 코랄을 바꾸는 것이지 바탕을 검게 하는 것이 아니다.
 * `Colors.dark` 한 벌은 지우지 않고 남겨두되 여기서 고르지 않는다.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
