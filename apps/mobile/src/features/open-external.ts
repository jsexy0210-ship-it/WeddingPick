import { Linking, Platform } from 'react-native';

/**
 * 바깥 주소(약관 전문 등)를 연다. 웹에서는 **새 창**이다 — 같은 창에서 열면
 * 로그인·온보딩 도중이던 화면을 잃는다. 네이티브는 OS 브라우저로 넘긴다.
 */
export async function openExternal(url: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');

    return;
  }

  await Linking.openURL(url);
}
