import { BackButton } from '@/components/back-button';

/**
 * 이메일 로그인 화면들(WP-AUTH-002~007)의 좌상단 뒤로가기 · 우상단 닫기.
 * 공통 `BackButton`을 그대로 쓴다 — 모양·터치 영역(40)이 같다.
 *
 * `variant="close"`는 비밀번호 찾기·메일 보냈어요 화면(WP-AUTH-006/007)이
 * 쓴다 — 그 둘은 순서를 되짚어가는 단계가 아니라 로그인 흐름 밖으로 빠지는
 * 자리라 "<" 대신 "✕"로 다르게 보여준다.
 */
export function AuthBackButton({ onPress, variant = 'back' }: { onPress: () => void; variant?: 'back' | 'close' }) {
  return <BackButton onPress={onPress} variant={variant} />;
}
