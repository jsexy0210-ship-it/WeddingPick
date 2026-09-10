import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Layout, Radius, Spacing } from '@weddingpick/ui';

/**
 * 서버 동작이 아직 없는 단추를 잠가 두는 곳.
 *
 * 왜 잠그나 — 관리자 화면의 «승인» · «재처리» · «공개» 같은 단추 스물두 개는
 * apps/api에 아직 없는 라우트를 부른다. 그런데 화면들이 그 실패를 전부 삼키도록
 * 돼 있어서(`catch`에서 무시한다), 지금은 눌러도 404가 조용히 버려지고 운영자
 * 눈에는 «눌렀는데 아무 일도 안 일어난다»로만 보인다. 동작하지 않는 것보다
 * 왜 동작하지 않는지 알 수 없는 것이 나쁘다. 그래서 아예 누르지 못하게 막고
 * 이유를 화면에 적는다.
 *
 * 서버가 붙으면 그 화면에서 `BACKEND_PENDING`을 쓰는 자리와 안내를 걷어내면 된다.
 * 상수로 둔 것은 나중에 grep 한 번으로 전부 찾기 위해서다.
 */
export const BACKEND_PENDING: boolean = true;

/**
 * 어떤 동작이 왜 막혀 있는지 화면 위쪽에 한 번만 알린다.
 *
 * 단추 이름은 그대로 둔다 — 스물두 개를 «준비 중»으로 바꾸면 그 단추가 원래
 * 무엇을 하는 자리인지가 사라진다. 흐리게 보이는 단추와 이 안내 한 줄이면
 * «무엇이 있어야 하는데 아직 안 된다»가 같이 읽힌다.
 */
export function PendingBackendNotice({ actions }: { actions: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>
        {actions} 동작은 아직 서버에 연결되지 않았어요. 지금은 조회만 됩니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.light.cautionaryBackground,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginHorizontal: Layout.gutter,
    marginTop: Spacing.two,
  },
  text: { color: Colors.light.cautionary, fontSize: FontSize.t7, fontWeight: '600' },
});
