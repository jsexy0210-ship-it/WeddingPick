import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 미션 완료 모달을 이미 봤는가. 디자인 핸드오프 18번 — **최초 1회**다.
 *
 * 기기에 둔다. 홈 편집과 같은 이유다 — 잃어도 큰일이 아니고, 서버에 두면 MY가
 * 뜰 때마다 한 번 더 기다린다. 기기를 바꾸면 축하를 한 번 더 받는다. 그건 손해가
 * 아니다.
 *
 * **못 읽으면 봤다고 친다.** 반대로 하면, 저장소가 막힌 기기에서는 MY에 들어갈
 * 때마다 축하 모달이 뜬다. 축하를 한 번 놓치는 쪽이 매번 가로막히는 쪽보다 낫다.
 */

const STORAGE_KEY = 'weddingpick.missionCelebrated.v1';

export async function hasSeenMissionComplete(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) !== null;
  } catch {
    return true;
  }
}

export async function markMissionCompleteSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // 못 써도 화면은 닫힌다. 다음에 한 번 더 뜨는 것이 최악이다.
  }
}
