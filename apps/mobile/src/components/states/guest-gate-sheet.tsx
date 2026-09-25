import { TERMS } from '@weddingpick/domain';
import { ActionButton, ThemedText } from '@weddingpick/ui';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';

export type GuestGateSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** 카카오 로그인 CTA. */
  onKakaoPress: () => void;
};

/**
 * WP-ST-001 — 비회원 게이트.
 *
 * 비회원이 Pick·저장 등 로그인이 필요한 행동을 했을 때 바텀시트로 로그인을 유도한다.
 * 비회원에게 개인화 영역을 보여주지 않는다 — 이 시트 밖에서는 실 제보만 열려 있다.
 */
export function GuestGateSheet({ visible, onDismiss, onKakaoPress }: GuestGateSheetProps) {
  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetPanel>
        <SheetHeader title="로그인하면 저장돼요" onClose={onDismiss} />
        <ThemedText type="body" themeColor="textSecondary">
          {TERMS.verifiedData}는 로그인 없이도 볼 수 있어요
        </ThemedText>
        <ActionButton
          variant="primary"
          size="xlarge"
          label="3초 만에 시작"
          onPress={onKakaoPress}
        />
      </SheetPanel>
    </BottomSheet>
  );
}
