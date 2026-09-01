import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'weddingpick.pendingAction.v1';

/**
 * 로그인 때문에 멈춘 행동. 통합정책 v3.10 §3.
 *
 * 지연 로그인의 핵심은 "로그인하세요"가 아니라 **하려던 일을 대신 끝내주는 것**이다.
 * 로그인을 마치고 돌아왔는데 누른 Pick이 사라져 있으면, 사용자가 보기에 그 로그인은
 * 아무것도 해주지 않고 길만 막은 것이 된다.
 *
 * 기기에 적어둔다. 애플·카카오 로그인은 앱 밖으로 나갔다 오고, 그 사이 화면이
 * 메모리째 내려갈 수 있다 — 메모리에만 들고 있으면 그때 잃는다.
 *
 * **한 번에 하나만 기억한다.** 줄을 세우면 로그인 뒤에 사용자가 시킨 적 없는 일이
 * 줄줄이 일어난다. 마지막에 누른 것 하나면 맥락을 잇기에 충분하다.
 */
export type PendingAction = {
  kind: 'pick';
  vendorId: string;
  /** 안내 문구에 쓸 이름. 로그인 시트가 무엇 때문에 떴는지 말해준다. */
  vendorName: string;
};

export async function savePendingAction(action: PendingAction): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(action));
}

/** 꺼내면서 지운다. 남겨두면 다음 로그인 때 한 번 더 일어난다. */
export async function takePendingAction(): Promise<PendingAction | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  await AsyncStorage.removeItem(STORAGE_KEY);

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as PendingAction).kind === 'pick' &&
      typeof (parsed as PendingAction).vendorId === 'string'
    ) {
      const action = parsed as PendingAction;

      return { kind: 'pick', vendorId: action.vendorId, vendorName: action.vendorName ?? '' };
    }
  } catch {
    // 아래로 떨어져 null을 준다.
  }

  return null;
}

export async function clearPendingAction(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
