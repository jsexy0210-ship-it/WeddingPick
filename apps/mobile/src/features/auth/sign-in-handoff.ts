/**
 * 부팅(app/_layout.tsx)이 카카오 리다이렉트를 마무리하다 실패했을 때, 그 이유를
 * 로그인 화면에 넘기는 손잡이. 화면은 뜨자마자 한 번 꺼내 실패 시트를 띄운다.
 *
 * 모듈 변수다 — 같은 부팅 안에서 한 번 넘기고 끝이라 저장소까지 갈 이유가 없다.
 */
let pendingError: string | null = null;

export function setPendingSignInError(message: string): void {
  pendingError = message;
}

export function takePendingSignInError(): string | null {
  const message = pendingError;

  pendingError = null;

  return message;
}
