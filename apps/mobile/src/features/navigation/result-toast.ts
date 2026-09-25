import { Platform, ToastAndroid } from 'react-native';

export type ResultToast = { id: number; message: string };
type Listener = (toast: ResultToast) => void;

let listener: Listener | null = null;
let nextId = 0;

/** 화면을 닫아도 남아야 하는 저장·수정·삭제 결과 안내. */
export function showResultToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  listener?.({ id: ++nextId, message });
}

export function subscribeResultToast(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}
