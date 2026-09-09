import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SKIN, Skins, type SkinId } from '@weddingpick/ui';

/**
 * 고른 스킨(WP-MY-005 · spec/tokens.json `color.skin`). **기기에 둔다.**
 *
 * 서버에 스킨 칸이 없다(`settingsSchema`에도 `currentUserSchema`에도). 화면 색은 잃어도 큰일이
 * 아니고, 기기마다 다른 것이 자연스럽다 — 혜택 안내 시트를 봤는지(`features/home/benefit-sheet-seen`)와
 * 같은 판단이다. 서버가 스킨을 갖게 되면 이 파일 안에서 저장 위치만 옮기면 된다.
 *
 * **읽거나 쓰지 못하면 기본값(Coral)이다.** 저장소가 막힌 기기에서 화면이 안 뜨는 것이 최악이다.
 */
const STORAGE_KEY = 'weddingpick.skin.v1';

export async function loadSkin(): Promise<SkinId> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);

    return isSkin(stored) ? stored : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export async function saveSkin(skin: SkinId): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, skin);
  } catch {
    // 못 써도 이번 화면에서는 고른 색이 보인다. 다음에 기본값으로 돌아갈 뿐이다.
  }
}

function isSkin(value: string | null): value is SkinId {
  return value !== null && Object.prototype.hasOwnProperty.call(Skins, value);
}
