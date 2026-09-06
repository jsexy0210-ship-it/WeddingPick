import Svg, { Path } from 'react-native-svg';

import type { SocialColors } from './theme';

type AuthProviderName = keyof typeof SocialColors;

/**
 * 소셜 로그인 버튼 로고. 디자인 핸드오프 v3.11(`current/html/01a-login.dc.html`)의
 * 확정 path다.
 *
 * `SocialColors`(버튼 배경·글자색)와 같은 이유로 고정값이다 — 제공자 브랜드
 * 마크는 앱 스킨·다크모드와 무관하다. Google만 로고 자체가 버튼 글자색
 * (`#212124`)이 아니라 구글 블루(`#4285F4`)를 쓴다 — 핸드오프 원본 그대로다.
 */
const LOGO = {
  kakao: { d: 'M12 3.6c-4.7 0-8.5 2.9-8.5 6.5 0 2.3 1.6 4.4 4 5.6l-.9 3.3c-.1.3.2.5.5.4l3.9-2.5c.3 0 .7.1 1 .1 4.7 0 8.5-2.9 8.5-6.5S16.7 3.6 12 3.6z', fill: '#191919' },
  naver: { d: 'M14.2 12.1 9.5 5.3H5.3v13.4h4.4v-6.9l4.8 6.9h4.2V5.3h-4.5v6.8z', fill: '#ffffff' },
  google: {
    d: 'M20.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h4.8c-.2 1.1-.8 2-1.8 2.6v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.4zM12 21c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H4v2.3C5.5 18.9 8.5 21 12 21zM6.9 13.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V8H4C3.4 9.2 3 10.6 3 12s.4 2.8 1 4l2.9-2.3zM12 6.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6C16.5 3.9 14.4 3 12 3 8.5 3 5.5 5.1 4 8l2.9 2.3c.7-2.2 2.7-3.7 5.1-3.7z',
    fill: '#4285F4',
  },
  apple: {
    d: 'M16.4 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.2 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.8-2.2.6-.9.9-1.7 1.1-2.3-2.6-1-2.4-3.6-2.4-3.8zM14.3 6.3c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z',
    fill: '#ffffff',
  },
} as const satisfies Record<AuthProviderName, { d: string; fill: string }>;

export function SocialLogo({ provider, size = 18 }: { provider: AuthProviderName; size?: number }) {
  const { d, fill } = LOGO[provider];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} fill={fill} />
    </Svg>
  );
}
