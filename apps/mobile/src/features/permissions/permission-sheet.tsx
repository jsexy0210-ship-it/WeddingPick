import { PAYMENT_PROOF_RETENTION_HOURS } from '@weddingpick/domain';
import { Linking, StyleSheet, View } from 'react-native';

import { ActionButton, Spacing, ThemedText } from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

/**
 * 권한 요청 설명 · WP-SHT-016 · WP-APP-007 「요청 전 설명」 · 「영구 거부」.
 *
 * **운영체제 창을 띄우기 전에 먼저 왜 필요한지 말한다.** 기기가 묻는 창은 한 번뿐이고,
 * 거기서 거절당하면 다시 물을 수 없다 — 이유를 모른 채 받는 물음은 거절당하기 쉽다.
 *
 * 지금은 사진만이다. 알림(일정 알림 켤 때) · 캘린더(일정 등록할 때)도 같은 자리를 쓰지만
 * 시안에 그 두 개의 문구가 없어 만들지 않았다 — 없는 문구를 지어내지 않는다.
 */

export type PermissionPurpose = 'photo';

/** 시안 17-sheets-states WP-SHT-016 문구 그대로. 보관 시간만 실제 값에서 가져온다. */
const COPY: Record<PermissionPurpose, { title: string; body: string; allow: string; later: string }> = {
  photo: {
    title: '사진 접근을 허용해주세요',
    body: `올려주신 자료에서 금액과 업체만 읽고, 원본은 ${PAYMENT_PROOF_RETENTION_HOURS}시간 안에 지워요`,
    allow: '허용하기',
    later: '나중에',
  },
};

/** 기기가 다시 묻지 않는 상태에서는 설정으로 보낸다 — 여기서 「허용하기」를 눌러봐야 아무 일도 없다. */
const BLOCKED = {
  title: '설정에서 사진 접근을 켜주세요',
  body: '기기가 더 묻지 않도록 설정돼 있어요. 설정에서 켜면 바로 올릴 수 있어요.',
  allow: '설정 열기',
} as const;

export type PermissionSheetProps = {
  visible: boolean;
  purpose: PermissionPurpose;
  /** 기기가 더 묻지 않는 상태(영구 거부). 이때는 설정으로 보낸다. */
  blocked?: boolean;
  /** 「허용하기」 — 여기서 실제 운영체제 창을 띄운다. */
  onAllow: () => void;
  /** 「나중에」 · 딤 탭 · 뒤로가기. */
  onLater: () => void;
};

export function PermissionSheet({ visible, purpose, blocked, onAllow, onLater }: PermissionSheetProps) {
  const copy = COPY[purpose];
  const title = blocked ? BLOCKED.title : copy.title;
  const body = blocked ? BLOCKED.body : copy.body;

  return (
    <BottomSheet visible={visible} onRequestClose={onLater} testID="permission-sheet">
      <SheetPanel>
        <View style={styles.text}>
          {/* 시안 제목 24 · 본문 2줄. */}
          <ThemedText type="t3">{title}</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {body}
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <ActionButton
            variant="primary"
            size="xlarge"
            label={blocked ? BLOCKED.allow : copy.allow}
            onPress={() => {
              if (blocked) void Linking.openSettings();
              else onAllow();
            }}
          />
          <ActionButton size="xlarge" label={copy.later} onPress={onLater} />
        </View>
      </SheetPanel>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  text: { gap: Spacing.one },
  actions: { gap: Spacing.two },
});
