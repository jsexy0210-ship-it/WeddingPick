import { confirmAlert } from '@/components/confirm-alert';

/**
 * DLG-B. 입력이 있을 때만 이탈을 묻고, 비어 있으면 바로 닫는다.
 * BottomSheet의 scrim/Android Back/명시적 닫기에서 같은 함수를 사용한다.
 */
export function requestDirtySheetClose(dirty: boolean, onDiscard: () => void): void {
  if (!dirty) {
    onDiscard();
    return;
  }

  confirmAlert('작성을 그만둘까요?', '입력한 내용은 저장되지 않아요.', [
    { text: '계속 작성', style: 'cancel' },
    { text: '그만두기', onPress: onDiscard },
  ]);
}
