import { Platform, Share } from 'react-native';

/**
 * 시스템 공유 시트를 띄운다. 데스크톱 웹은 대부분 `navigator.share`가 없어서
 * (react-native-web의 `Share.share`가 그대로 reject한다) 클립보드 복사로
 * 대신한다. 사용자가 공유 시트를 취소한 경우(네이티브)는 조용히 넘어간다.
 */
export async function shareOrCopy(message: string): Promise<{ shared: boolean; copied: boolean }> {
  try {
    await Share.share({ message });
    return { shared: true, copied: false };
  } catch {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        return { shared: false, copied: true };
      } catch {
        return { shared: false, copied: false };
      }
    }
    return { shared: false, copied: false };
  }
}
