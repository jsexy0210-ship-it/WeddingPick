import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 혜택 안내 시트(WP-SHT-017)를 이미 봤는가 — **홈 최초 진입 1회**다.
 *
 * 기기에 둔다. 미션 완료 모달(`membership/mission-seen.ts`)과 같은 이유다 — 잃어도
 * 큰일이 아니고, 서버에 두면 홈이 뜰 때마다 한 번 더 기다린다. 「나중에」를 눌러도
 * 닫은 것이라 다시 뜨지 않는다 — 혜택 탭에서 볼 수 있다.
 *
 * **못 읽으면 봤다고 친다.** 저장소가 막힌 기기에서 홈에 들어갈 때마다 시트가
 * 올라오는 것이 최악이다.
 */

const STORAGE_KEY = 'weddingpick.benefitSheetSeen.v1';

export async function hasSeenBenefitSheet(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) !== null;
  } catch {
    return true;
  }
}

export async function markBenefitSheetSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // 못 써도 시트는 닫힌다. 다음에 한 번 더 뜨는 것이 최악이다.
  }
}
