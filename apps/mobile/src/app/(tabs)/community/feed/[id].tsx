import { router } from 'expo-router';

import { ThemedText } from '@weddingpick/ui';
import { SubScreen } from '@/features/settings/my-kit';
import strings from '../../../../../../../spec/strings.ko.json';

const S = strings.community;

/**
 * 라운지 상세 · Figma `FlowScreens.tsx` `FeedDetailPage`(B등급 — 구성만 참고).
 *
 * **서버 계약이 없다.** 라운지 홈(`community/index.tsx`)이 글 목록을 못 보여주는 한
 * 이 화면에 진짜 `id`로 들어올 방법이 없다 — 링크가 잘못됐거나 지워진 글로 본다.
 */
export default function CommunityFeedDetailScreen() {
  return (
    <SubScreen title={S.title} onBack={() => router.back()}>
      <ThemedText type="t6" themeColor="textSecondary">
        {S['detail.notFound']}
      </ThemedText>
    </SubScreen>
  );
}
