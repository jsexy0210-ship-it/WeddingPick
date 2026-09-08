import { Tabs, useSegments } from 'expo-router';

import { RootTabBar } from '@/features/navigation/tab-bar';

/**
 * Bottom Navigation: 홈 | 검색 | Pick | 웨딩일정 | MY — 05-root 시안 1:1(`RootTabBar`).
 * 사업계획서 31번 App IA. 4번 탭은 «웨딩일정»(v3.16) — 혼자서도 전면 개방, 배우자 초대는 보조 기능.
 */
export default function TabLayout() {
  /*
   * 카메라는 전체 화면을 써야 문서를 화면에 맞추기 쉽다.
   *
   * 조각들을 문자열 배열로 받는다. 타입 생성기가 만드는 조각 유니온은 라우트를
   * 더할 때마다 좁아져서, 어느 날 `includes`가 아무 값도 못 받는 상태가 된다 —
   * 여기서 알고 싶은 것은 "카메라 화면인가" 하나뿐이라 그 유니온이 필요 없다.
   */
  const segments: readonly string[] = useSegments();
  const onCamera = segments.includes('camera');

  return (
    <Tabs
      tabBar={(props) => (onCamera ? null : <RootTabBar {...props} />)}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="search" options={{ title: '검색' }} />
      {/*
        Pick. 통합정책 v3.2 §1이 루트를 홈/검색/Pick/웨딩일정/MY로 정했다.
        아이콘은 웨딩픽 심볼(하트 안에 체크)을 그대로 쓴다 — 앱 아이콘·스플래시와
        같은 마크라야 "Pick이 이 앱의 중심"이라는 말이 화면에서도 같은 모양으로
        읽힌다. 아이콘·라벨·배지는 `RootTabBar`가 그린다.
       */}
      <Tabs.Screen name="pick" options={{ title: 'Pick' }} />
      {/*
        제보는 루트에서 뺀다(v3.2 §1). 화면은 남아 있고 MY와 업체 상세, 건수가
        모자란 자리에서 들어간다 — 맥락 없이 탭으로 세워두면 무엇을 제보하라는
        것인지 알 수 없다.
       */}
      <Tabs.Screen name="capture" options={{ href: null }} />
      {/*
        (home)은 홈에서 파고드는 하위 스택(피드 · TOP3)이다. 탭이 아니다 — 숨기지
        않으면 라우터가 "(home)"이라는 여섯 번째 탭을 만든다.
       */}
      <Tabs.Screen name="(home)" options={{ href: null }} />
      <Tabs.Screen name="wedding" options={{ title: '웨딩일정' }} />
      <Tabs.Screen name="my" options={{ title: 'MY' }} />
    </Tabs>
  );
}
