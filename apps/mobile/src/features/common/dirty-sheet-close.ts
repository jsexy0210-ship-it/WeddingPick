import { confirmAlert } from '@/components/confirm-alert';

/**
 * WP-DLG-B 확인 · 작성 중 이탈(`docs/design/React_Native/common.js:621`, common frame-008).
 * 입력이 있을 때만 이탈을 묻고, 비어 있으면 바로 닫는다. 문구는 정본 그대로다.
 * BottomSheet의 scrim/Android Back/명시적 닫기에서 같은 함수를 사용한다.
 */
export function requestDirtySheetClose(dirty: boolean, onDiscard: () => void): void {
  if (!dirty) {
    onDiscard();
    return;
  }

  confirmAlert('작성을 그만둘까요?', '쓰던 내용은 저장되지 않아요.', [
    { text: '이어서 쓰기', style: 'cancel' },
    { text: '그만두기', onPress: onDiscard },
  ]);
}
