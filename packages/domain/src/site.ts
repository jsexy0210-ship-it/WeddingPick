/**
 * 서비스 웹사이트 주소.
 *
 * 공개 주소는 빌드 시 `EXPO_PUBLIC_SITE_ORIGIN`으로 넣는다. 이 값은 비밀이 아니다.
 * 값이 없는 기존 빌드·테스트는 전환 완료 전 공개본인 Render 주소를 fallback으로 쓴다.
 *
 * KakaoCloud 정적 전환 후보는 `https://210.109.82.212:9443`을 넣어 빌드한다.
 */
export const SITE_ORIGIN = (
  process.env.EXPO_PUBLIC_SITE_ORIGIN || 'https://weddingpick-web.onrender.com'
).replace(/\/+$/, '');
