import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeddingMark, useTheme } from '@weddingpick/ui';

/**
 * Bottom Navigation: 홈 | 검색 | 촬영 | 내 웨딩 | MY
 * 사업계획서 31번 App IA. 배우자 연결(Phase 3) 후 "내 웨딩" 라벨은 "우리 웨딩"으로 바뀐다.
 */
export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tintInactive,
        tabBarStyle: onCamera
          ? { display: 'none' }
          : {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom,
              height: 60 + insets.bottom,
            },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '검색',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size} />
          ),
        }}
      />
      {/*
        Pick. 통합정책 v3.2 §1이 루트를 홈/검색/Pick/우리웨딩/MY로 정했다.
        아이콘은 웨딩픽 심볼(하트 안에 체크)을 그대로 쓴다 — 앱 아이콘·스플래시와
        같은 마크라야 "Pick이 이 앱의 중심"이라는 말이 화면에서도 같은 모양으로
        읽힌다. 색은 다른 탭처럼 선택 상태를 따라간다.
       */}
      <Tabs.Screen
        name="pick"
        options={{
          title: 'Pick',
          tabBarIcon: ({ color, size }) => <WeddingMark size={size} color={color} />,
        }}
      />
      {/*
        제보는 루트에서 뺀다(v3.2 §1). 화면은 남아 있고 MY와 업체 상세, 데이터가
        모자란 자리에서 들어간다 — 맥락 없이 탭으로 세워두면 무엇을 제보하라는
        것인지 알 수 없다.
       */}
      <Tabs.Screen name="capture" options={{ href: null }} />
      <Tabs.Screen
        name="wedding"
        options={{
          title: '우리웨딩',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: 'MY',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
